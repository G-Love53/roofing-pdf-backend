// src/server.js
import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { renderPdf } from "./pdf.js";
import * as Email from "./email.js";

// --- LEG 2 / LEG 3 IMPORTS ---
import { processInbox } from "./quote-processor.js";
import { triggerCarrierBind } from "./bind-processor.js";
import { google } from 'googleapis';

const sendWithGmail = Email.sendWithGmail || Email.default || Email.sendEmail;
if (!sendWithGmail) {
  throw new Error("email.js must export sendWithGmail (named) or a default sender.");
}

const enrichFormData = (d) => d || {};

const FILENAME_MAP = {
  RoofingAccord125: "ACORD-125.pdf",
  RoofingAccord126: "ACORD-126.pdf",
  RoofingAccord140: "ACORD-140.pdf",
  RoofingForm:      "RoofingForm.pdf",
};

const TEMPLATE_ALIASES = {
  Accord125: "RoofingAccord125",
  Accord126: "RoofingAccord126",
  Accord140: "RoofingAccord140",
  RoofingAccord125: "RoofingAccord125",
  RoofingAccord126: "RoofingAccord126",
  RoofingAccord140: "RoofingAccord140",
  RoofingForm:      "RoofingForm",
};
const resolveTemplate = (name) => TEMPLATE_ALIASES[name] || name;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// --- INITIALIZE APP (Must be before routes) ---
const APP = express();
APP.use(express.json({ limit: "20mb" }));

// --- CORS ---
const allowed = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

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

// --- Helper: Data Mapping ---
async function maybeMapData(templateName, raw) {
  try {
    const mapPath = path.join(MAP_DIR, `${templateName}.json`);
    const mapping = JSON.parse(await fs.readFile(mapPath, "utf8"));
    const mapped = {};
    for (const [tplKey, formKey] of Object.entries(mapping)) {
      mapped[tplKey] = raw?.[formKey] ?? "";
    }
    return { ...raw, ...mapped };
  } catch {
    return raw;
  }
}

// --- Helper: Render Bundle ---
async function renderBundleAndRespond({ templates, email }, res) {
  if (!Array.isArray(templates) || templates.length === 0) {
    return res.status(400).json({ ok: false, error: "NO_TEMPLATES" });
  }

  const results = [];

  for (const t of templates) {
    const name = resolveTemplate(t.name);
    const htmlPath = path.join(TPL_DIR, name, "index.ejs");
    const cssPath  = path.join(TPL_DIR, name, "styles.css");
    const rawData  = t.data || {};
    const unified  = await maybeMapData(name, rawData);

    try {
      const buffer = await renderPdf({ htmlPath, cssPath, data: unified });
      const filename = t.filename || FILENAME_MAP[name] || `${name}.pdf`;
      results.push({ status: "fulfilled", value: { filename, buffer } });
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
      failedCount: failures.length,
      details: failures.map(f => String(f.reason)),
    });
  }

  const attachments = results.map(r => r.value);

  if (email?.to?.length) {
    try {
      await sendWithGmail({
        to: email.to,
        cc: email.cc,
        subject: email.subject || "Roofing Submission Packet",
        formData: email.formData,
        html: email.bodyHtml,
        attachments,
      });
      return res.json({ ok: true, success: true, sent: true, count: attachments.length });
    } catch (err) {
      console.error("EMAIL_SEND_FAILED", err);
      return res.status(502).json({
        ok: false,
        success: false,
        error: "EMAIL_SEND_FAILED",
        detail: String(err?.message || err),
      });
    }
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${attachments[0].filename}"`);
  return res.send(attachments[0].buffer);
}

// --- Route: Render Bundle ---
APP.post("/render-bundle", async (req, res) => {
  try {
    await renderBundleAndRespond(req.body || {}, res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// --- Route: Submit Quote ---
APP.post("/submit-quote", async (req, res) => {
  try {
    let { formData = {}, segments = [], email } = req.body || {};
    formData = enrichFormData(formData);

    const templates = (segments || [])
      .map((n) => resolveTemplate(n))
      .map((name) => ({
        name,
        filename: FILENAME_MAP[name] || `${name}.pdf`,
        data: formData,
      }));

    if (!templates.length) {
      return res.status(400).json({ ok: false, success: false, error: "NO_VALID_SEGMENTS" });
    }

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

// --- NEW LEG 2: Check Quotes Route ---
APP.post("/check-quotes", async (req, res) => {
  console.log("🤖 Robot Waking Up: Checking for new quotes...");

  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  const serviceEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const impersonatedUser = (process.env.GMAIL_USER || "").trim();
  const privateKey = rawKey.replace(/\\n/g, '\n'); 

  if (!serviceEmail || !impersonatedUser || !rawKey || !process.env.OPENAI_API_KEY) {
    console.error("❌ Error: Missing configuration for LEG 2.");
    return res.status(500).json({ ok: false, error: "Missing Env Vars (Google/OpenAI)" });
  }

  try {
    const jwtClient = new google.auth.JWT(
      serviceEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/gmail.modify'], 
      impersonatedUser 
    );

    await jwtClient.authorize();
    const result = await processInbox(jwtClient); 

    console.log("✅ Robot finished checking inbox.");
    return res.json({ ok: true, ...result });

  } catch (error) {
    const errMsg = error.message || String(error);
    console.error("❌ Robot Global Error:", errMsg);
    return res.status(500).json({ ok: false, error: "LEG 2 Failure: " + errMsg });
  }
});

// --- NEW LEG 3: Client Bind Acceptance Endpoint ---
APP.get("/bind-quote", async (req, res) => {
    const quoteId = req.query.id;
    if (!quoteId) return res.status(400).send("Quote ID is missing.");

    try {
        await triggerCarrierBind({ quoteId }); 

        const confirmationHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Roofer Insurance Bind Confirmed</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background-color: #f0fdf4; }
                    .container { background-color: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px; margin: 0 auto; border-left: 5px solid #10b981; }
                    h1 { color: #10b981; }
                    p { color: #374151; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🎉 Binding Accepted!</h1>
                    <p>Thank you! Your request to bind this Roofer quote (ID: <b>${quoteId.substring(0, 8)}</b>) has been successfully recorded.</p>
                </div>
            </body>
            </html>
        `;
        res.status(200).send(confirmationHtml);
    } catch (e) {
        console.error(`BIND_FAILED for ID ${quoteId}:`, e);
        res.status(500).send("Error processing bind request.");
    }
});

// --- Start server ---
const PORT = process.env.PORT || 10000;
const server = APP.listen(PORT, () => {
  console.log(`PDF service listening on ${PORT}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref(); 
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
