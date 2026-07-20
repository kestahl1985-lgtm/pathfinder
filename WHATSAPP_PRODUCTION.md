# WhatsApp Production Launch — Vula Careers

Moving from the Twilio WhatsApp **sandbox** to a **production** WhatsApp Business sender.

## Sender number
- **Number:** 076 842 8433 → international format **+27 76 842 8433** (standard SA mobile).
- ✅ Standard mobile: **SMS verification works** — no voice-call workaround needed.
- ⚠️ Must **NOT** be on a personal WhatsApp account. Standard mobiles often already have WhatsApp — if so, open WhatsApp → Settings → Account → **Delete my account** first, wait a few minutes, then verify as an API sender.

## Accounts needed
- **Meta Business Manager** (business.facebook.com) — free.
- **Twilio** account (already have — SID stored in Vercel env vars, not documented here).

## Business verification documents (Meta)
- CIPC registration certificate — Vula Career Guide (Pty) Ltd, reg **2026/021440/07**
- Proof of address: 1 Dorchester Drive, Parklands, 7441
- Business website: vulacareers.co.za
- Business email: hello@vulacareers.co.za

## Steps (do in order)
1. **Twilio Console → Messaging → Senders → WhatsApp senders → Create new sender.**
2. Connect/create the **Meta Business Manager** and **WhatsApp Business Account (WABA)**.
3. Enter the sender number (+27 76 842 8433) → verify via **SMS code**.
4. Set **Display name**: `Vula Careers` (Meta reviews — must match the business, no superlatives/URLs).
5. Set profile: logo, business description, website, email, category = Education.
6. Submit **business verification** (upload CIPC docs above).
7. Submit **message templates** (below) for approval.
8. Once approved, point the sender's inbound webhook to: `https://api.vulacareers.co.za/webhook`
9. Update Vercel env `TWILIO_PHONE_NUMBER` to the new production number (currently sandbox +14155238886).
10. Remove the sandbox join requirement from any user-facing instructions / wa.me links.

## Message templates to submit

The core assessment is **user-initiated** (student messages first), so all the Q&A happens free-form inside the 24-hour service window — those don't need templates. Templates are only needed when **Vula** sends the first message or messages after 24h. Submit these so re-engagement and report resends keep working:

### 1. Re-engagement reminder (Category: Utility)
Name: `assessment_reminder`
```
Hi {{1}} 👋 You started your Vula career assessment but didn't finish. Reply *CONTINUE* to pick up where you left off and unlock your free career report. 🎓
```
Sample {{1}} = "Thabo"

### 2. Report ready / resend (Category: Utility)
Name: `report_ready`
```
Hi {{1}}, your Vula career report is ready! 📄 Reply *REPORT* to get your personalised PDF with your top career matches and study pathways.
```
Sample {{1}} = "Thabo"

### 3. Welcome / opt-in confirmation (Category: Utility)
Name: `welcome_optin`
```
Welcome to Vula 🌟 Free career guidance for South African learners. Reply *START* to begin your assessment, or *INFO* to learn how we protect your privacy.
```

### 4. Re-engagement check-in (Category: Utility, but see note)
Name: `grade_progress_nudge` (kept the original name to avoid a code/docs mismatch — no longer grade-specific; wording changed after the onboarding flow dropped the grade question entirely, so there's no grade value left to reference)
```
Hi {{1}} 👋 It's been a while! Reply *MENU* to revisit your matched careers on Vula, or *RESTART* to redo the assessment fresh.
```
Sample {{1}} = "Thabo"

**Sending is manual, not automatic.** `api/reengage.js` (Vercel Cron, daily) only decides who's *due* for a nudge (~10 months since they finished, capped at 2 nudges ever) and adds them to the `reengagement_queue` table — an admin reviews the queue on the "Re-engagement Schedule" screen and clicks Send (or Skip) per learner, which calls `api/reengage-action.js` to actually deliver this template. See that file's header comment for why this was made manual rather than auto-sent.

> Notes for approval: keep them Utility (not Marketing) where possible — faster approval, no opt-in restrictions. No promotional language, no external URLs in the body, correct {{n}} variable format with samples. **`grade_progress_nudge` specifically is proactive re-engagement outreach the learner didn't just ask for** — Meta may classify it as Marketing rather than Utility on review, which would add per-conversation cost and stricter opt-in requirements. Submit as Utility first since it's genuinely a service-continuation message (revisiting an assessment they already started), but be prepared to argue the case or accept a Marketing categorisation if rejected.

## After launch
- Test the full flow end-to-end on the production number.
- Update marketing site CTA from "Join the waitlist" → "Start on WhatsApp" with a `wa.me/27768428433?text=START` link.
- Monitor Twilio + Meta quality rating (stay above "Medium").
