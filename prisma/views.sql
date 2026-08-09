-- ============================================================================
-- TAP Placement CRM — Report Views (apply AFTER initial migration)
-- Run with: npx prisma db execute --file prisma/views.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Placement stats per branch + academic year
--    Source: Dashboard sheet "CHART DATA — Branch / Placed"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_placement_stats AS
SELECT
  s.branch,
  s.batch AS academic_year,
  COUNT(s.id) AS total_students,
  COUNT(CASE WHEN ss.placement_eligible = TRUE THEN 1 END) AS eligible,
  COUNT(CASE WHEN ss.current_placement_status = 'PLACED' THEN 1 END) AS placed,
  COUNT(CASE WHEN ss.higher_studies = TRUE THEN 1 END) AS higher_studies,
  COUNT(CASE WHEN ss.government_exams = TRUE THEN 1 END) AS government_exams
FROM students s
LEFT JOIN student_status ss ON ss.student_id = s.id
GROUP BY s.branch, s.batch;

-- ---------------------------------------------------------------------------
-- 2. Placement funnel — Applied → OA → GD → Tech → HR → Offer → Selected
--    Source: Dashboard sheet "PLACEMENT FUNNEL"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_placement_funnel AS
SELECT
  COUNT(*) AS applied,
  COUNT(CASE WHEN oa_status IN ('CLEARED','PENDING') THEN 1 END) AS oa_attempted,
  COUNT(CASE WHEN oa_status = 'CLEARED' THEN 1 END) AS oa_cleared,
  COUNT(CASE WHEN gd_status = 'CLEARED' THEN 1 END) AS gd_cleared,
  COUNT(CASE WHEN technical_round = 'CLEARED' THEN 1 END) AS technical_cleared,
  COUNT(CASE WHEN hr_round = 'CLEARED' THEN 1 END) AS hr_cleared,
  COUNT(CASE WHEN offer_released = TRUE THEN 1 END) AS offer_released,
  COUNT(CASE WHEN final_status = 'SELECTED' THEN 1 END) AS selected
FROM applications;

-- ---------------------------------------------------------------------------
-- 3. Company report — offers + total CTC per company
--    Source: Reports sheet "Company Report"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_company_report AS
SELECT
  c.id AS company_id,
  c.name AS company_name,
  c.sector,
  COUNT(DISTINCT o.id) AS total_offers,
  COUNT(DISTINCT op.id) AS total_opportunities,
  COALESCE(SUM(o.final_ctc_lpa), 0) AS total_ctc_lpa,
  AVG(o.final_ctc_lpa) AS avg_ctc_lpa
FROM companies c
LEFT JOIN opportunities op ON op.company_id = c.id
LEFT JOIN offers o ON o.opportunity_id = op.id
GROUP BY c.id, c.name, c.sector
ORDER BY total_ctc_lpa DESC;

-- ---------------------------------------------------------------------------
-- 4. Package stats — highest / average / median / lowest by academic year
--    Source: Dashboard sheet "KEY METRICS"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_package_stats AS
SELECT
  op.academic_year,
  MAX(o.final_ctc_lpa) AS highest_ctc_lpa,
  AVG(o.final_ctc_lpa) AS avg_ctc_lpa,
  MIN(o.final_ctc_lpa) AS lowest_ctc_lpa,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.final_ctc_lpa) AS median_ctc_lpa
FROM offers o
JOIN opportunities op ON op.id = o.opportunity_id
WHERE o.accepted = 'ACCEPTED'
GROUP BY op.academic_year
ORDER BY op.academic_year DESC;

-- ---------------------------------------------------------------------------
-- 5. Student report — applications + final status per student
--    Source: Reports sheet "Student Report"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_student_report AS
SELECT
  s.id AS student_id,
  s.registration_no,
  s.name,
  s.branch,
  s.batch,
  COUNT(DISTINCT a.id) AS total_applications,
  COUNT(DISTINCT CASE WHEN a.final_status = 'SELECTED' THEN a.id END) AS selections,
  COUNT(DISTINCT o.id) AS total_offers
FROM students s
LEFT JOIN applications a ON a.student_id = s.id
LEFT JOIN offers o ON o.student_id = s.id
GROUP BY s.id, s.registration_no, s.name, s.branch, s.batch;

-- ---------------------------------------------------------------------------
-- 6. Unplaced / higher-studies / govt-exam lists (filters)
--    Source: Reports sheet
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_unplaced_students AS
SELECT s.id, s.registration_no, s.name, s.branch, s.batch, s.cgpa
FROM students s
JOIN student_status ss ON ss.student_id = s.id
WHERE ss.current_placement_status = 'UNPLACED' AND ss.placement_eligible = TRUE;

CREATE OR REPLACE VIEW v_higher_studies AS
SELECT s.id, s.registration_no, s.name, s.branch, s.batch
FROM students s
JOIN student_status ss ON ss.student_id = s.id
WHERE ss.higher_studies = TRUE;

CREATE OR REPLACE VIEW v_government_exams AS
SELECT s.id, s.registration_no, s.name, s.branch, s.batch
FROM students s
JOIN student_status ss ON ss.student_id = s.id
WHERE ss.government_exams = TRUE;
