-- =====================================================================
-- 20260629000001_security_rls.sql seeded a placeholder admin address
-- (admin@pathfinder.local, marked ">>> Seed your real admin email(s)
-- here <<<") that was never replaced. Confirmed nobody uses it — swapping
-- it for the real admin login. Editing a new migration rather than the
-- historical one, since that file may already be applied.
-- =====================================================================

delete from admin_allowlist where email = 'admin@pathfinder.local';

insert into admin_allowlist (email) values ('kyal.stahl@tutanota.com')
  on conflict (email) do nothing;
