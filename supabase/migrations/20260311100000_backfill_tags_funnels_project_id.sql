-- Backfill project_id on tags and funnels based on name matching
-- Tags/funnels whose name contains a project name are assigned to that project.
-- Others remain NULL (global = visible in all projects).

-- ── Tags ──────────────────────────────────────────────────────────────────────
UPDATE tags t
SET project_id = p.id
FROM projects p
WHERE t.project_id IS NULL
  AND t.company_id = p.company_id
  AND UPPER(t.name) LIKE '%' || UPPER(p.name) || '%';

-- ── Funnels ───────────────────────────────────────────────────────────────────
UPDATE funnels f
SET project_id = p.id
FROM projects p
WHERE f.project_id IS NULL
  AND f.company_id = p.company_id
  AND UPPER(f.name) LIKE '%' || UPPER(p.name) || '%';
