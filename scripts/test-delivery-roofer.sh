#!/usr/bin/env bash
# Roofer segment — test delivery and printing
# Sends ROOFER_INTAKE bundle (SUPP_ROOFER + ACORD125/126/130/140) to segment quote email
# Usage: ./scripts/test-delivery-roofer.sh   (or set BASE_URL if Roofer Render URL differs)

set -e
BASE_URL="${BASE_URL:-https://cid-pdf-roofer.onrender.com}"
TO="${TO:-quotes@roofingcontractorinsurancedirect.com}"

echo "Roofer test delivery: POST $BASE_URL/submit-quote → $TO"
echo ""

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/submit-quote" \
  -H "Content-Type: application/json" \
  -d '{
  "bundle_id": "ROOFER_INTAKE",
  "formData": {
    "applicant_name": "Test Roofer Ops",
    "insured_name": "Test Roofer Ops",
    "premises_name": "Test Roofer LLC",
    "premise_address": "456 Job Site Rd",
    "organization_type": "LLC",
    "business_phone": "555-000-0001",
    "contact_email": "test@example.com",
    "effective_date": "2025-02-13",
    "square_footage": "5000",
    "num_employees": "12"
  },
  "email": {
    "to": ["'"$TO"'"],
    "subject": "CID Roofer — Ops test delivery"
  }
}')

HTTP_BODY=$(echo "$RESP" | head -n -1)
HTTP_CODE=$(echo "$RESP" | tail -n 1)

echo "HTTP $HTTP_CODE"
echo "$HTTP_BODY" | jq -r '.' 2>/dev/null || echo "$HTTP_BODY"

if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
  echo ""
  echo "OK — Check inbox: $TO (subject: CID Roofer — Ops test delivery)"
else
  echo ""
  echo "Request failed (HTTP $HTTP_CODE). Check body above."
  exit 1
fi
