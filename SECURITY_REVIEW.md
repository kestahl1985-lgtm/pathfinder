# Vula — Security Review

**Date:** 29 June 2026
**Scope:** Marketing website (`web/`), backend WhatsApp API (`api/`), admin dashboard (`admin/`), Supabase database, Twilio + third-party integrations.
**Reviewer:** Automated code review (Claude). This is a code-level review, not a penetration test or a formal audit. Given the platform processes the personal information of **minors** and shares it with third parties, a professional security assessment and legal review are recommended before public launch.

---

## Summary

| # | Finding | Severity |
|---|---------|----------|
| 1 | Public anon key + permissive RLS (`USING (true)`) exposes learner PII & leads | 🔴 Critical |
| 2 | No Twilio webhook signature validation (request forgery / message abuse) | 🟠 High |
| 3 | Secrets shared in plaintext should be rotated before production | 🟠 High |
| 4 | No rate limiting / abuse protection on `/webhook` | 🟡 Medium |
| 5 | No data-retention / deletion job for `whatsapp_sessions` (minors' PII) | 🟡 Medium |
| 6 | Admin authorization architecture relies on client + RLS, not server-side auth | 🟡 Medium |
| 7 | Missing hardening: security headers, input length limits | 🟢 Low |
| 8 | Dependency hygiene | 🟢 Low |

**What's already done well:** no secrets in git; `.env` gitignored; backend uses only Node built-ins (tiny attack surface); `whatsapp_sessions` correctly locked to the service role; TLS everywhere (Vercel); TwiML output is XML-escaped; the temporary `/diag` endpoint was removed.

---

## 1. 🔴 CRITICAL — Learner PII is world-readable via the public anon key

**Where:** `supabase/migrations/20260628000001_pathfinder_core.sql` (lines 134–150) and `admin/src/lib/supabase.ts`.

**What's wrong:**
The admin dashboard talks to Supabase directly from the browser using the **anon (public) key** (`VITE_SUPABASE_ANON_KEY`), which is embedded in the shipped JavaScript bundle and is therefore visible to anyone. Access is then governed by Row-Level Security policies — but the policies are:

```sql
CREATE POLICY "Admins can view students" ON students FOR SELECT USING (true);
CREATE POLICY "Admins can view leads"    ON leads    FOR SELECT USING (true);
CREATE POLICY "Admins can update leads"  ON leads    FOR UPDATE USING (true);
-- ...assessments, colleges, courses similarly
```

`USING (true)` means **"allow everyone, including unauthenticated `anon` requests."** The login screen in the admin app authenticates a user, but the data queries do **not** depend on that session — so anyone who has the admin URL (or just the public anon key) can read every learner's name, WhatsApp number, school, age, and area, and can modify lead statuses. **No login required.**

This is especially serious because the data subjects are **children**, and unauthorised access would be a reportable breach under POPIA.

**Current real-world exposure:** Today the live PII actually sits in `whatsapp_sessions` (correctly protected — see "what's done well"), and the `students`/`leads` tables are not yet populated by the bot. So there is **no active leak right now**, but these tables are the intended destination, and the policy is a loaded gun: the moment data flows there, it is public.

**Remediation (choose one; A is strongest):**

- **A — Don't expose data to the browser at all (recommended).** Move all admin data reads/writes behind the backend API using the **service-role key** server-side, protected by real admin authentication. Then remove the permissive policies so `anon` has no access:
  ```sql
  DROP POLICY "Admins can view students" ON students;
  DROP POLICY "Admins can view leads"    ON leads;
  DROP POLICY "Admins can update leads"  ON leads;
  -- ...and the rest. With RLS enabled and no anon policy, anon is denied by default.
  ```
- **B — Tie RLS to authenticated admins.** Keep Supabase Auth, but require an authenticated session AND an allowlist, e.g.:
  ```sql
  -- only logged-in users whose email is in admin_users may read
  CREATE POLICY "admins read students" ON students FOR SELECT
    USING (auth.role() = 'authenticated'
           AND auth.jwt()->>'email' IN (SELECT email FROM admin_users));
  ```
  Note: even with B, the anon key still ships publicly — that's normal and fine **only if** every table's policies are correctly restrictive. A is more robust because the database is never reachable from the browser.

---

## 2. 🟠 HIGH — `/webhook` does not verify requests come from Twilio

**Where:** `api/webhook.js` (handler) — no `X-Twilio-Signature` check.

**What's wrong:** The endpoint trusts any POST. An attacker who knows the URL (`/webhook`) can:
- Forge inbound messages with an arbitrary `From`, creating/overwriting sessions for any phone number (DB tampering, pollution).
- Cause your Twilio account to **send WhatsApp messages** (the bot replies to `From`) — i.e. use your account to message/harass arbitrary numbers and **run up cost**.
- Probe and drive the state machine at will.

**Remediation:** Validate Twilio's signature on every request using your auth token. Twilio signs the full URL + sorted POST params; compute the HMAC-SHA1 and compare to the `X-Twilio-Signature` header (constant-time). Reject with 403 on mismatch. (Either use the `twilio` SDK's `validateRequest`, or implement the HMAC directly to keep the zero-dependency setup.) Also enforce HTTPS-only (already true on Vercel).

---

## 3. 🟠 HIGH — Rotate secrets that were shared in plaintext

During setup, the **Twilio Auth Token** and the **Supabase service-role key** were pasted in plaintext (chat/terminal/logs). Treat them as potentially exposed.

**Remediation before production:**
- **Rotate the Twilio Auth Token** (Twilio Console → Account → API keys & tokens) and update `TWILIO_AUTH_TOKEN` in Vercel.
- **Rotate the Supabase service-role key** if your plan allows, or at minimum keep it strictly server-side (it already is) and monitor usage.
- Going forward, set secrets directly in the Vercel/Supabase dashboards, never in chat, commit messages, or client code.

---

## 4. 🟡 MEDIUM — No rate limiting / abuse protection on `/webhook`

**What's wrong:** Unlimited requests can drive database writes and outbound-message attempts (cost, potential DoS).

**Remediation:** Add basic rate limiting (per source IP and/or per `From` number) — e.g. a short-window counter in Supabase or an edge middleware. Combine with finding #2 (signature validation), which already blocks the majority of abuse.

---

## 5. 🟡 MEDIUM — No retention/deletion policy for `whatsapp_sessions`

**What's wrong:** `whatsapp_sessions` stores minors' personal information indefinitely. POPIA requires you not to keep personal information longer than necessary, and a smaller data footprint reduces breach impact.

**Remediation:**
- Add a scheduled job (Supabase `pg_cron` or a Vercel Cron) to delete sessions older than your stated retention period (the Privacy Policy has a placeholder for this — set it, e.g. 12–24 months of inactivity).
- Honour `DELETE` requests (already implemented in the bot) and surface them in any future admin tooling.

---

## 6. 🟡 MEDIUM — Admin authorization should be server-side

Tied to #1: authentication (who you are) and authorization (what you may access) currently live in the browser. Even after fixing RLS, the most defensible design is: the React admin calls **your backend**, the backend checks an authenticated admin session, and only the backend (service role) touches the database. This also lets you add audit logging of admin access (the `admin_logs` table already exists for this).

---

## 7. 🟢 LOW — Hardening

- **Security headers** on the static site: add `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy` via a `vercel.json` `headers` block. (HSTS/TLS are handled by Vercel.) Note the site loads Tailwind + Google Fonts from CDNs — a CSP must allow those or self-host them.
- **Input length limits:** cap stored free-text fields (name/school/suburb) to a sane length to prevent DB bloat and abuse. Values are already XML-escaped (TwiML) and JSON-encoded (Twilio Content), so injection risk is low.
- **`ADMIN_DEFAULT_PASSWORD` / default admin** references are legacy from the earlier build — ensure no default-credential path remains and that real admins use strong, unique passwords + (ideally) MFA via Supabase Auth.

---

## 8. 🟢 LOW — Dependency hygiene

The backend (`api/`) has **no third-party runtime dependencies** (uses Node's built-in `https`) — excellent. The admin uses React, Supabase JS, and TanStack Query; keep them patched (`npm audit`, Dependabot) and pin versions.

---

## Remediation status (29 June 2026)

| # | Finding | Code status | Your action to activate |
|---|---------|-------------|-------------------------|
| 1 | Permissive RLS | ✅ **APPLIED & VERIFIED** (29 Jun 2026) — lockdown SQL run; confirmed the anon key can no longer read student PII (`[]`), service role still works. Allowlist seeded with `admin@pathfinder.local`. | Done |
| 2 | Webhook signature | ✅ Implemented & tested | Set `WEBHOOK_URL=https://pathfinder-backend-one.vercel.app/webhook` in Vercel; redeploy |
| 3 | Rotate secrets | ⚠️ You only | Rotate Twilio Auth Token + (if possible) Supabase service key; update Vercel env |
| 4 | Rate limiting | ✅ Implemented & tested | None (active on deploy) |
| 5 | Retention job | ✅ Implemented | Set `CRON_SECRET` (and optional `RETENTION_DAYS`) in Vercel; redeploy |
| 6 | Server-side admin authz | ◻️ Mitigated by #1 | Future: move admin reads behind backend (optional once #1 is applied) |
| 7 | Security headers | ✅ Added (web/admin/backend) | Verify the admin still loads after deploy (CSP allows Tailwind CDN; self-hosting Tailwind would let us drop `unsafe-eval`) |
| 8 | Dependency hygiene | ◻️ Ongoing | Enable Dependabot / run `npm audit` periodically |

After #1 is applied and #3 is done, the critical and high-severity issues are closed.

## Full re-inspection — 30 June 2026 (post-launch)

Probed the live system top-to-bottom after the domain, waitlist, and PDF report were added.

### ✅ Verified secure
- **No secrets in git**; `.env*` and `.vercel` are gitignored; Twilio token & Supabase service key confirmed absent from the repo.
- **Database fully locked from the public anon key** — `students`, `leads`, `waitlist`, `whatsapp_sessions`, `admin_allowlist`, `assessments` all return `[]` to anon.
- **Webhook** rejects forged/unsigned requests → `403`.
- **/report** is token-gated → `400` without token, `404` on a bad token (80-bit random tokens).
- **/cleanup** requires `CRON_SECRET` → `401` without it.
- **Security headers** (CSP, HSTS, X-Frame-Options, etc.) live on `vulacareers.co.za`; valid TLS cert; `www`→apex 308 redirect.

### 🔧 Fixed this pass
- **PDF report could crash on emoji / non-Latin names** (WinAnsi encoding) → user text is now sanitised; render wrapped in try/catch. (Medium)
- **Waitlist had no abuse protection** → added per-IP rate limit (6/min), a honeypot field, and contact-format validation. (Medium)
- **Free-text fields uncapped** → name/school/suburb now length-limited. (Low)
- **Enabled the retention job** (`CRON_SECRET`) and **exact webhook signature matching** (`WEBHOOK_URL`).

### ⚠️ Still requires you (cannot be done in code)
1. **Rotate the Twilio Auth Token + Supabase service-role key** (shared in plaintext during setup). — High
2. **Disable public sign-ups in Supabase Auth** (`disable_signup` is currently false; only allow-listed admins need accounts). — Medium
3. **Enable the registrar lock** on the domain at domains.co.za (status is `ok`, not `clientTransferProhibited`) to prevent domain hijack; optionally enable **DNSSEC**. — Low/Med
4. **When email is set up**, add **SPF, DKIM and DMARC** records to stop spoofing/phishing from your domain. — Med (future)
5. **Attorney review** of the legal pages + register the entity / Information Officer with the Information Regulator. — Ongoing

## Recommended order of remediation

1. **Lock down the database (Finding #1)** — highest impact, do first.
2. **Validate Twilio signatures (#2)** and **rotate shared secrets (#3)**.
3. **Rate limiting (#4)** and **retention job (#5)**.
4. **Move admin reads server-side (#6)** and **add headers/limits (#7)**.

I can implement #1, #2, #4, #5 and #7 directly in this codebase on request — #3 (rotation) is done by you in the Twilio/Supabase dashboards.
