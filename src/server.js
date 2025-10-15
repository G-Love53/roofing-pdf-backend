import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { renderPdf } from "./pdf.js";
import { sendWithGmail } from "./email.js";

// no-op enricher to keep shape
const enrichFormData = (d) => d || {};

const FILENAME_MAP = {
  RoofingAccord125: "ACORD-125.pdf",
  RoofingAccord126: "ACORD-126.pdf",
  RoofingAccord140: "ACORD-140.pdf",
  RoofingForm: "RoofingForm.pdf",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP = express();
APP.use(express.json({ limit: "20mb" }));

// CORS (allow your sites)
const allowed = (process.env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
APP.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!allowed.length || (origin && allowed.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// --- Directories ---
const TPL_DIR = path.join(__dirname, "..", "templates");
const MAP_DIR = path.join(__dirname, "..", "mapping");

// --- Health check ---
APP.get("/healthz", (_req, res) => res.status(200).send("ok"));

// --- Optional mapping: mapping/<template>.json ---
async function maybeMapData(templateName, rawData) {
  try {
    const mapPath = path.join(MAP_DIR, `${templateName}.json`);
    const mapping = JSON.parse(await fs.readFile(mapPath, "utf8"));
    const mapped = {};
    for (const [tplKey, formKey] of Object.entries(mapping)) {
      mapped[tplKey] = rawData?.[formKey] ?? "";
    }
    return { ...rawData, ...mapped };
  } catch {
    return rawData;
  }
}

// --- Core: render PDFs and optionally email ---
async function renderBundleAndRespond({ templates, email }, res) {
  if (!Array.isArray(templates) || templates.length === 0) {
    return res.status(400).json({ ok: false, error: "NO_TEMPLATES" });
  }

  const results = [];
  for (const t of templates) {
    const name = t.name;
    console.log("RENDERING", name);
    const htmlPath = path.join(TPL_DIR, name, "index.ejs");
    const cssPath = path.join(TPL_DIR, name, "styles.css"); // optional
    const rawData = t.data || {};
    const unified = await maybeMapData(name, rawData);

    try {
      const buffer = await renderPdf({ htmlPath, cssPath, data: unified });
      const prettyName = FILENAME_MAP[name] || t.filename || `${name}.pdf`;
      results.push({ status: "fulfilled", value: { filename: prettyName, buffer } });
    } catch (err) {
      results.push({ status: "rejected", reason: err });
    }
  }

  const failures = results.filter(r => r.status === "rejected");
  if (failures.length) {
    console.error("RENDER_FAILURES", failures.map(f => String(f.reason)));
    return res.status(500).json({
      ok: false,
      success: false,
      error: "ONE_OR_MORE_ATTACHMENTS_FAILED",
      failedCount: failures.length,details
    });
  }

  const attachments = results.map(r => r.value);

  // Email branch (with try/catch)
  if (email?.to?.length) {
    try {
      await sendWithGmail({
        to: email.to,
        cc: email.cc,
        subject: email.subject || "Roofing Submission Packet",
        formData: email.formData,     // preferred: render email from form data
        html: email.bodyHtml,         // fallback
        attachments
      });
      return res.json({ ok: true, success: true, sent: true, count: attachments.length });
    } catch (err) {
      console.error("EMAIL_SEND_FAILED", err);
      return res.status(502).json({
        ok: false,
        success: false,
        error: "EMAIL_SEND_FAILED",
        detail: String(err?.message || err)
      });
    }
  }

  // Fallback: return first PDF directly
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${attachments[0].filename}"`);
  return res.send(attachments[0].buffer);
}

// --- Public routes ---

// JSON API: { templates:[{name,filename?,data}], email? }
APP.post("/render-bundle", async (req, res) => {
  try {
    await renderBundleAndRespond(req.body || {}, res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// Back-compat: { formData, segments[], email? }
APP.post("/submit-quote", async (req, res) => {
  try {
    let { formData = {}, segments = [], email } = req.body || {};
    formData = enrichFormData(formData);

    // segments must exactly match template folder names
    const templates = (segments || []).map((name) => ({
      name,
      filename: FILENAME_MAP[name] || `${name}.pdf`,
      data: formData,
    }));
    if (templates.length === 0) {
      return res.status(400).json({ ok: false, success: false, error: "NO_VALID_SEGMENTS" });
    }

    // Default email block so /submit-quote returns JSON (not a PDF stream)
    const defaultTo = process.env.CARRIER_EMAIL || process.env.GMAIL_USER;
    const cc = (process.env.UW_EMAIL || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const emailBlock = email?.to?.length
      ? email
      : {
          to: [defaultTo].filter(Boolean),
          cc,
          subject: `New Roofing Submission — ${formData.businessName || formData.applicant_name || ""}`,
          formData,
        };

    await renderBundleAndRespond({ templates, email: emailBlock }, res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, success: false, error: e.message || String(e) });
  }
});

// --- start server (use Render's PORT or fallback) ---
const PORT = process.env.PORT || 10000;

// Capture the server instance so we can close it on shutdown
const server = APP.listen(PORT, () => {
  console.log(`PDF service listening on ${PORT}`);
});

// --- graceful shutdown so npm doesn't log SIGTERM as an "error" ---
function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
  // Safety timeout in case connections hang
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
