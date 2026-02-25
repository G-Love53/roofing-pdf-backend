#!/usr/bin/env bash
# Roofer segment — test delivery and printing
# Sends ROOFER_INTAKE bundle (SUPP_ROOFER + ACORD125/126/130/140) to segment quote email
# Usage: ./scripts/test-delivery-roofer.sh   (or set BASE_URL if Roofer Render URL differs)

set -e
BASE_URL="${BASE_URL:-https://roofing-pdf-backend.onrender.com}"
TO="${TO:-quotes@roofingcontractorinsurancedirect.com}"

echo "Roofer test delivery: POST $BASE_URL/submit-quote → $TO"
echo ""

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/submit-quote" \
  -H "Content-Type: application/json" \
  -d '{
  "bundle_id": "ROOFER_INTAKE",
  "formData": {
    "applicant_name": "Test Roofer Ops",
    "applicant_address": "123 Roofing Way",
    "applicant_city": "Denver",
    "applicant_state": "CO",
    "applicant_zip": "80202",
    "applicant_phone": "555-000-0001",
    "web_address": "https://test-roofer.example.com",
    "inspection_contact": "Jane Inspector",
    "inspection_phone": "555-000-0002",
    "policy_period_from": "2025-03-01",
    "to": "2026-02-28",
    "entity_type_llc": "Yes",
    "location_1_address": "123 Roofing Way",
    "location_1_city": "Denver",
    "location_1_state": "CO",
    "location_1_zip": "80202",
    "years_in_business": "10",
    "Years_of_Experience": "15",
    "max_building_height": "3 stories",
    "num_employees": "12",
    "full_time_employees": "10",
    "part_time_employees": "2",
    "gross_sales_year_1": "500000",
    "gross_sales_year_2": "480000",
    "gross_sales_year_3": "460000",
    "insured_name": "Test Roofer Ops",
    "contact_email": "test@example.com",
    "wrap_up_projects": "No",
    "written_safety_program": "Yes",
    "completion_inspection": "Yes",
    "work_restricted_states": "No",
    "asbestos_work": "No",
    "cranes_used": "Yes",
    "crane_maintenance": "Yes",
    "crane_training": "Yes",
    "osha_compliance": "Yes",
    "draw_plans_designs": "No",
    "sub_lower_coverage": "No",
    "certificates_required": "Yes",
    "lease_equipment": "No",
    "warranties_offered": "Yes"
  },
  "email": {
    "to": ["'"$TO"'"],
    "subject": "CID Roofer — SUPP_ROOFER test delivery"
  }
}')

# macOS-compatible: last line is HTTP code, rest is body
HTTP_CODE=$(echo "$RESP" | tail -1)
HTTP_BODY=$(echo "$RESP" | sed '$d')

echo "HTTP $HTTP_CODE"
echo "$HTTP_BODY" | jq -r '.' 2>/dev/null || echo "$HTTP_BODY"

if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
  echo ""
  echo "OK — Check inbox: $TO (subject: CID Roofer — SUPP_ROOFER test delivery)"
else
  echo ""
  echo "Request failed (HTTP $HTTP_CODE). Check body above."
  exit 1
fi
