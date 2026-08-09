-- ============================================================================
-- TAP Placement CRM — Report Views (apply AFTER initial migration)
-- Run with: npx prisma db execute --schema prisma/schema.prisma --file prisma/views.sql
-- NOTE: Prisma created camelCase columns — they MUST be double-quoted in SQL.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Placement stats per branch + batch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_placement_stats AS
SELECT
  s.branch,
  s.batch AS "academicYear",
  COUNT(s.id) AS "totalStudents",
  COUNT(CASE WHEN ss."placementEligible" = TRUE THEN 1 END) AS eligible,
  COUNT(CASE WHEN ss."currentPlacementStatus" = 'PLACED' THEN 1 END) AS placed,
  COUNT(CASE WHEN ss."higherStudies" = TRUE THEN 1 END) AS "higherStudies",
  COUNT(CASE WHEN ss."governmentExams" = TRUE THEN 1 END) AS "governmentExams"
FROM students s
LEFT JOIN student_status ss ON ss."studentId" = s.id
GROUP BY s.branch, s.batch;

-- ---------------------------------------------------------------------------
-- 2. Placement funnel — Applied → OA → GD → Tech → HR → Offer → Selected
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_placement_funnel AS
SELECT
  COUNT(*) AS applied,
  COUNT(CASE WHEN "oaStatus" <> 'NOT_ATTEMPTED' THEN 1 END) AS "oaAttempted",
  COUNT(CASE WHEN "oaStatus" = 'CLEARED' THEN 1 END) AS "oaCleared",
  COUNT(CASE WHEN "gdStatus" = 'CLEARED' THEN 1 END) AS "gdCleared",
  COUNT(CASE WHEN "technicalRound" = 'CLEARED' THEN 1 END) AS "technicalCleared",
  COUNT(CASE WHEN "hrRound" = 'CLEARED' THEN 1 END) AS "hrCleared",
  COUNT(CASE WHEN "offerReleased" = TRUE THEN 1 END) AS "offerReleased",
  COUNT(CASE WHEN "finalStatus" = 'SELECTED' THEN 1 END) AS selected
FROM applications;

-- ---------------------------------------------------------------------------
-- 3. Company report — offers + total CTC per company
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_company_report AS
SELECT
  c.id AS "companyId",
  c.name AS "companyName",
  c.sector,
  COUNT(DISTINCT o.id) AS "totalOffers",
  COUNT(DISTINCT op.id) AS "totalOpportunities",
  COALESCE(SUM(o."finalCtcLpa"), 0) AS "totalCtcLpa",
  AVG(o."finalCtcLpa") AS "avgCtcLpa"
FROM companies c
LEFT JOIN opportunities op ON op."companyId" = c.id
LEFT JOIN offers o ON o."opportunityId" = op.id
GROUP BY c.id, c.name, c.sector
ORDER BY "totalCtcLpa" DESC;

-- ---------------------------------------------------------------------------
-- 4. Package stats — highest / average / median / lowest by academic year
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_package_stats AS
SELECT
  op."academicYear",
  MAX(o."finalCtcLpa") AS "highestCtcLpa",
  AVG(o."finalCtcLpa") AS "avgCtcLpa",
  MIN(o."finalCtcLpa") AS "lowestCtcLpa",
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o."finalCtcLpa") AS "medianCtcLpa"
FROM offers o
JOIN opportunities op ON op.id = o."opportunityId"
WHERE o.accepted = 'ACCEPTED'
GROUP BY op."academicYear"
ORDER BY op."academicYear" DESC;

-- ---------------------------------------------------------------------------
-- 5. Student report — applications + final status per student
--    NOTE: DISTINCT guards against join multiplication (2 apps × 3 offers ≠ 6)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_student_report AS
SELECT
  s.id AS "studentId",
  s."registrationNo",
  s.name,
  s.branch,
  s.batch,
  COUNT(DISTINCT a.id) AS "totalApplications",
  COUNT(DISTINCT CASE WHEN a."finalStatus" = 'SELECTED' THEN a.id END) AS selections,
  COUNT(DISTINCT o.id) AS "totalOffers"
FROM students s
LEFT JOIN applications a ON a."studentId" = s.id
LEFT JOIN offers o ON o."studentId" = s.id
GROUP BY s.id, s."registrationNo", s.name, s.branch, s.batch;

-- ---------------------------------------------------------------------------
-- 6. Unplaced / higher-studies / govt-exam lists (filters)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_unplaced_students AS
SELECT s.id, s."registrationNo", s.name, s.branch, s.batch, s.cgpa
FROM students s
JOIN student_status ss ON ss."studentId" = s.id
WHERE ss."currentPlacementStatus" = 'UNPLACED' AND ss."placementEligible" = TRUE;

CREATE OR REPLACE VIEW v_higher_studies AS
SELECT s.id, s."registrationNo", s.name, s.branch, s.batch
FROM students s
JOIN student_status ss ON ss."studentId" = s.id
WHERE ss."higherStudies" = TRUE;

CREATE OR REPLACE VIEW v_government_exams AS
SELECT s.id, s."registrationNo", s.name, s.branch, s.batch
FROM students s
JOIN student_status ss ON ss."studentId" = s.id
WHERE ss."governmentExams" = TRUE;
