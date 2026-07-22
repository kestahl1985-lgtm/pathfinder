# Vula — Twilio → Meta Cloud API Migration Runbook

**Why:** Meta Cloud API bills WhatsApp conversations at Meta's direct rates with no BSP markup. Twilio adds a per-message fee on top. At scale this is a large saving; at demo/pilot volume it's negligible — so **migrate deliberately, not urgently.**

**Status of the code:** DONE. `api/webhook-meta.js` is a complete Meta implementation sharing all the same logic as the Twilio bot (`lib/assessment.js`). It's already routed at `/webhook-meta`. `api/reengage-action.js` (re-engagement) already targets Meta too. Nothing needs to be written — this is purely account setup + a number cutover.

**Golden rule:** Do NOT release the live number (076 842 8433) from Twilio until every step below is validated on Meta's test number. A WhatsApp number lives on ONE platform at a time — releasing it from Twilio takes the live bot down, and it's slow to reverse.

---

## Deadline schedule — TARGET: end of August 2026

Working backwards from ~31 Aug. The critical path is **clearing the Meta account/access gate** — everything after it is fast. If the gate isn't cleared by early August, the deadline is at risk, so treat that as the one thing to force this week.

| By when | Milestone | Owner |
|---|---|---|
| **~1 Aug** | Meta account/access gate cleared — a trusted account can reach developer tools + Business Portfolio (see options below) | You |
| ~8 Aug | App created, WhatsApp product added, business verification confirmed under "Vula Career Guide (Pty) Ltd" | You |
| ~12 Aug | Templates (welcome/re-engagement) submitted + approved in WhatsApp Manager | You |
| ~15 Aug | `/webhook-meta` validated end-to-end on Meta's **free test number** (handshake + full assessment) | Me (needs test-number creds from you) |
| ~20 Aug | Permanent System User token generated; all 4 env vars staged | You set the 2 secrets; me the rest |
| **Last week Aug** | Number cutover: 076 842 8433 released from Twilio → registered on Meta WABA → env updated → full live test | You (Twilio/Meta consoles) + me (env + test) |

The gate is the long pole. Options to clear it, fastest first:
- **Add a trusted, long-established Facebook account (co-founder/partner) as an ADMIN on the existing Business Portfolio**, and do the developer/System-User steps from THAT account. Business verification is tied to the Portfolio, not the personal admin — so this preserves the verification work already done and sidesteps the blocked personal account. Fastest realistic unblock.
- **Meta Verified** (paid, ID-backed) on an account — bypasses much of the trust gating.
- **Meta Business Help Center** support escalation, citing the deadline and the persistent device-trust block + password-change lockout.
- Do NOT open a brand-new Facebook account — zero trust fails the gate harder and trips fraud detection.

---

## Phase 1 — Set up Meta (safe, live bot untouched)

### 1. Meta Business Manager
- Go to **business.facebook.com**. If you already have a Business portfolio for Vula, use it; otherwise create one.
- Business name: **Vula Career Guide (Pty) Ltd**. Have your CIPC reg (2026/021440/07) and business details ready.

### 2. Meta Developer account (this is the "registration" step)
- Go to **developers.facebook.com** → **Get Started**.
- It attaches to your personal Facebook account. Requirements that commonly trip people up:
  - You must have a Facebook account and be **logged in**.
  - You'll be asked to **verify** via phone or email — complete it.
  - You may be required to enable **two-factor authentication** on the Facebook account before it lets you register as a developer. Do that if prompted.
  - Accept the developer terms.
- If you're stuck here, note the exact screen/error — most blocks are the 2FA requirement or an unverified email/phone on the underlying Facebook account.

### 3. Create the app + add WhatsApp
- In the Developer console → **Create App** → type **Business** → link it to the Vula Business portfolio from step 1.
- In the app dashboard → **Add Product** → **WhatsApp** → Set up.
- This automatically provisions a **free test number** and a test WhatsApp Business Account (WABA). You'll see:
  - A **temporary access token** (valid ~24h — fine for testing).
  - A **Phone number ID** for the test number (this is `META_PHONE_NUMBER_ID`, NOT the phone number itself).

### 4. Validate /webhook-meta with the TEST number (no risk to live bot)
- Set these in the **backend** Vercel project env (Production), leaving Twilio untouched:
  - `META_ACCESS_TOKEN` = the temporary token (swap for a permanent one later, step 7)
  - `META_PHONE_NUMBER_ID` = the test number's Phone number ID
  - `META_APP_SECRET` = app's App Secret (App Settings → Basic)
  - `META_VERIFY_TOKEN` = any string you choose (e.g. a random 20-char value)
  - `META_GRAPH_VERSION` = optional, leave unset to use the default
- In the app's WhatsApp → Configuration → **Webhook**:
  - Callback URL: `https://api.vulacareers.co.za/webhook-meta`
  - Verify token: the same `META_VERIFY_TOKEN` string
  - Subscribe to the **messages** field.
- From the WhatsApp test console, add your own phone as a test recipient and message the test number. Confirm the assessment runs end-to-end via `/webhook-meta`. (Same bot, different pipe.)

### 5. Business Verification (run in background — takes days)
- Business Manager → **Security Centre** / **Business Verification** → submit CIPC doc, proof of address (1 Dorchester Drive, Parklands, 7441), business details.
- This is what raises your messaging tier and improves delivery — the same limits behind the "slow delivery / stuck on questions" issue on the current number.

### 6. Recreate + submit message templates on Meta
- The re-engagement and welcome templates from `WHATSAPP_PRODUCTION.md` (`grade_progress_nudge`, `welcome_optin`, etc.) must be created in **Business Manager → WhatsApp Manager → Message Templates** and approved. (Templates are Meta-side regardless of Twilio vs Cloud API — you're just recreating them under your own WABA now.)

### 7. Permanent access token
- The temp token expires in ~24h. For production, create a **System User** in Business Manager → assign the WABA → generate a **permanent token** with `whatsapp_business_messaging` + `whatsapp_business_management` permissions.
- Update `META_ACCESS_TOKEN` in Vercel with the permanent token.

---

## Phase 2 — Cut the live number over (the only risky step; do last, in a quiet window)

**Pre-flight:** Phase 1 fully validated on the test number, business verified, templates approved, permanent token set. You have started (or don't need) sponsor pitches. Pick a low-traffic window.

1. **Release 076 842 8433 from Twilio.** In Twilio Console → Messaging → WhatsApp senders → remove/deregister the sender. (This is the point of no easy return — the bot is down until step 3 completes.)
2. **Register 076 842 8433 on your Meta WABA.** WhatsApp Manager → Add phone number → verify via SMS/voice. Get its **Phone number ID**.
3. **Update Vercel env** on the backend: set `META_PHONE_NUMBER_ID` to the real number's ID (replacing the test number's). Redeploy.
4. **Point the webhook** for the real number to `https://api.vulacareers.co.za/webhook-meta` (if not already inherited).
5. **Switch the app off Twilio:** the active route is currently `/webhook` (Twilio). Either update Twilio's config (now moot after release) or confirm all inbound now hits `/webhook-meta`. The Twilio env vars can stay as a dormant fallback or be removed.
6. **Test end-to-end on the real number** immediately: full assessment, sponsor drill-in, PDF report, an admin message, a re-engagement send.

**Rollback:** if Meta delivery misbehaves, you can re-register the number on Twilio, but expect downtime and re-verification. This is why Phase 1 must be fully proven first.

---

## What you do NOT need
- You do **not** need a Meta Developer account to keep running on Twilio today.
- You do **not** need to touch any of this to pitch sponsors — the Twilio system is the working product.
- You do **not** migrate the number to "fix" the current delivery lag — that lag is new-number warmup + messaging tier; business verification (step 5) is the lever, and it works on either platform.
