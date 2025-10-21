// Generate formatted HTML email summary
function generateEmailSummary(formData) {
  // helpers (local to this function)
  const fmtUSD  = v => {
    const n = Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
    return n ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : 'N/A';
  };
  const fmtDate = s => (s ? new Date(s).toLocaleDateString('en-US') : 'N/A');

  // normalize fields from your form payload
  const name   = formData.applicant_name || 'N/A';
  const street = formData.applicant_address || formData.applicant_street || '';
  const city   = formData.applicant_city || '';
  const state  = formData.applicant_state || '';
  const zip    = formData.applicant_zip || '';
  const addressLine = [street, [city, state].filter(Boolean).join(', '), zip].filter(Boolean).join(', ');

  const phone  = formData.business_phone || formData.applicant_phone || 'N/A';
  const email  = formData.contact_email || 'N/A';

  const effectiveDisp = fmtDate(formData.policy_period_from || formData.effective_date);
  const grossRevenue  = fmtUSD(formData.total_gross_sales || formData.total_sales);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; }
        .header { background-color: #ff8c00; color: white; padding: 12px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 20px; background-color: #f5f5f5; margin: 20px; border-radius: 8px; }
        .field { margin: 10px 0; }
        .label { font-weight: bold; }
        .footer { padding: 20px; text-align: center; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Commercial Insurance Quote Request</h1>
      </div>

      <div class="content">
        <h3>Applicant Information:</h3>

        <div class="field"><span class="label">Business Name:</span> ${name}</div>
        <div class="field"><span class="label">Address:</span> ${addressLine || 'N/A'}</div>
        <div class="field"><span class="label">Phone:</span> ${phone}</div>
        <div class="field"><span class="label">Email:</span> ${email}</div>
        <div class="field"><span class="label">Effective Date:</span> ${effectiveDisp}</div>
        <div class="field"><span class="label">Gross Revenue:</span> ${grossRevenue}</div>
      </div>

      <p style="text-align: center; padding: 20px;">
        Please find the completed application forms attached. We look forward to your competitive quote.
      </p>

      <div class="footer">
        <strong>Commercial Insurance Direct LLC</strong><br/>
        Phone: (303) 932-1700<br/>
        Email: <a href="mailto:quote@roofingcontractorinsurancedirect.com">quote@roofingcontractorinsurancedirect.com</a>
      </div>
    </body>
    </html>
  `;
}
} // <= closes generateEmailSummary()

// --- exports (keep server.js happy) ---
export { generateEmailSummary };

export async function sendWithGmail({ to, subject, html, text, attachments = [] }) {
  // Wire real transport later (nodemailer or Gmail API)
  return { ok: true, skipped: true, to, subject };
}

