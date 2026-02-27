-- Ensure Ana (agent) has an entry in user_roles
-- Without this, AuthContext returns role=null and all RLS filters are skipped in the frontend
INSERT INTO user_roles (user_id, role)
SELECT '18d19c09-2624-4859-b76c-b34349f3ba79', 'agent'
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = '18d19c09-2624-4859-b76c-b34349f3ba79'
);
