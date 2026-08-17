# Roofing Contractor Insurance Direct — Instantly email creatives

Hosted on **roofingcontractorinsurancedirect.com** via `roofing-pdf-backend/Netlify/email/`.

## Active creative (new campaigns)

| Field | Value |
|-------|--------|
| **Version folder** | `archive/2026-08-connect-v1/` |
| **JPEG** | `CID_Roofer_Creative.jpg` |
| **Instantly HTML** | `instantly_step3.html` |
| **Public JPEG URL** | https://roofingcontractorinsurancedirect.com/email/archive/2026-08-connect-v1/CID_Roofer_Creative.jpg |
| **Prefill variable** | `{{connectquote_url}}` on image + CTA |

**Status:** Structure only — add JPEG to `archive/2026-08-connect-v1/` before sending.


## Do not delete old versions

Instantly steps keep pointing at old URLs. Add new folders under `archive/YYYY-MM-slug/`; update this README when switching active creative.

## Legacy root files

If `../CID_*_Creative.jpg` or `../instantly_*_step3.html` exist at `email/` root, they are **legacy mirrors** for campaigns already live. Prefer versioned paths for new work.

## Regenerate from pdf-backend

```bash
cd ~/GitHub/pdf-backend
node scripts/generate-instantly-email.mjs --segment roofer --version 2026-08-connect-v1
node scripts/extract-creative-jpg.mjs \
  --input ~/Downloads/CID_Creative_Roofer_Embedded.html \
  --output ~/GitHub/roofing-pdf-backend/Netlify/email/archive/2026-08-connect-v1/CID_Roofer_Creative.jpg
```

See `pdf-backend/docs/outreach-claude-playbook.md`.
