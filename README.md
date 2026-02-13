# roofing-pdf-backend (Roofer segment)

**CID Leg 2 — Roofer segment.** Renders ACORD + supplemental PDFs from CID_HomeBase templates, emails via Gmail API. Same RSS pattern as Bar (pdf-backend).

* **Segment:** `roofer` (set via `SEGMENT` env; default `roofer`).
* **Canonical bundle:** `ROOFER_INTAKE` = SUPP_ROOFER + ACORD125, 126, 130, 140. Config in `src/config/bundles.json`.
* **Templates:** CID_HomeBase submodule. No local template duplication.

Deploy: Docker (Render). Build clones CID_HomeBase when submodules are not available.
