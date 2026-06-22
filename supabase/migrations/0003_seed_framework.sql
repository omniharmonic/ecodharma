-- 0003_seed_framework.sql
-- Placeholder framework version so the FK/reference target exists from day one.
-- The REAL framework artifact is loaded later by the M0 Node loader (which uses
-- the service_role key and bypasses RLS). Do NOT block on it here.
insert into framework_versions (version, artifact_json, changelog)
values (
  '0.0.0-pending',
  '{}'::jsonb,
  'placeholder; replaced by M0 loader'
)
on conflict (version) do nothing;
