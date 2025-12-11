// src/server.js
import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { renderPdf } from "./pdf.js";
import * as Email from "./email.js";
const sendWithGmail = Email.sendWithGmail || Email.default || Email.sendEmail;
if (!sendWithGmail) {
  throw new Error("email.js must export sendWithGmail (named) or a default sender.");
}

// --- LEG 2 / LEG 3 IMPORTS ADDED ---
import { processInbox } from "./quote-processor.js";
import { triggerCarrierBind } from "./bind-processor.js";
import { google } from 'googleapis'; // Used for the JWT client in /check-quotes
// -----------------------------------

/* ----------------------------- helpers & consts ---------------------------- */

// keep shape if no enricher is needed
const enrichFormData = (d) => d || {};
// ... rest of FILENAME_MAP, TEMPLATE_ALIASES, resolveTemplate, __filename, __dirname ...


// --- Existing routes (omitted for brevity) ---
// APP.get("/healthz", ...)
// maybeMapData(...)
// renderBundleAndRespond(...)

/* ------------------------------- public APIs ------------------------------- */

// JSON API: { templates:[{name,filename?,data}], email? }
APP.post("/render-bundle", async (req, res) => {
// ... existing logic
});

// Back-compat: { formData, segments[], email? }
APP.post("/submit-quote", async (req, res) => {
// ... existing logic 
// NOTE: Make sure the subject line is correctly set to 'New Roofing Submission'
// ...
});

// --- NEW LEG 2: Check Quotes Route ---
APP.post("/check-quotes", async (req, res) => {
  console.log("🤖 Robot Waking Up: Checking for new quotes...");

  // 1. Read Credentials
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  const serviceEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const impersonatedUser = (process.env.GMAIL_USER || "").trim();
  const privateKey = rawKey.replace(/\\n/g, '\n'); // Fix for Render newline issues

  // 2. Safety Checks
  if (!serviceEmail || !impersonatedUser || !rawKey || !process.env.OPENAI_API_KEY) {
    console.error("❌ Error: Missing configuration for LEG 2.");
    return res.status(500).json({ ok: false, error: "Missing Env Vars (Google/OpenAI)" });
  }

  try {
    // 3. Connect to Google (WITH IMPERSONATION)
    const jwtClient = new google.auth.JWT(
      serviceEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/gmail.modify'], 
      impersonatedUser 
    );

    // 4. Authorize and Run the Processor
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
    // 1. Capture the unique ID from the URL query string
    const quoteId = req.query.id;

    if (!quoteId) {
        return res.status(400).send("Quote ID is missing. Please contact support.");
    }

    try {
        // 2. Call the binding processor (LEG 3 Handoff)
        await triggerCarrierBind({ quoteId }); 

        // 3. Respond to the client with a confirmation page
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
                    .note { margin-top: 20px; font-size: 0.9em; color: #6b7280; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🎉 Binding Accepted!</h1>
                    <p>Thank you! Your request to bind this Roofer quote (ID: <b>${quoteId.substring(0, 8)}</b>) has been successfully recorded.</p>
                    <p>We are now preparing the final documents and processing payment. Your Certificate of Insurance will arrive shortly.</p>
                </div>
            </body>
            </html>
        `;
        res.status(200).send(confirmationHtml);
        
    } catch (e) {
        console.error(`BIND_FAILED for ID ${quoteId}:`, e);
        res.status(500).send("An error occurred during the binding process. Please contact support immediately.");
    }
});


/* ------------------------------- start server ------------------------------ */
// ... rest of the file (PORT and shutdown functions)
