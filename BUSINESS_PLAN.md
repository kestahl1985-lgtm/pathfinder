# Vula Careers — Business Plan

*Vula Career Guide (Pty) Ltd · vulacareers.co.za · Prepared July 2026*

## 1. Executive Summary

Vula is a free, WhatsApp-native career-guidance assessment for South African high school learners (Grades 10–12). In under 5 minutes, a learner answers 30 tappable questions, receives a RIASEC-based career profile, a personalised PDF report (matched careers, required subjects, qualification paths), and — where relevant — sees courses from **sponsoring** colleges, universities and training providers matched to their city and their profile.

Vula is free for learners, forever. Revenue comes from **institutions and corporates who sponsor visibility** of their courses/programmes in learner results — not from selling learner data. This is a deliberate, lower-risk model given the POPIA sensitivity of working with minors: Vula never hands over a learner's personal details to a sponsor. The learner decides, on their own initiative, whether to reach out.

**The gap Vula closes**: most SA learners pick subjects in Grade 9/10 with little real information about what those choices lock in or out, and under-resourced schools (1 career counsellor for hundreds of learners, if any) can't fill that gap. Vula meets learners where they already are — WhatsApp, which has near-universal reach even on low-end phones and small data budgets — and turns a 5-minute chat into an actionable plan.

## 2. The Problem

- Career guidance capacity in SA public schools is thin to non-existent; Life Orientation teachers are rarely trained career counsellors.
- Learners frequently discover too late that a career they want (engineering, medicine, actuarial science) required Maths and Physical Science subject choices made years earlier.
- Existing career-guidance products assume a laptop, a stable connection, or a fee — all of which exclude the majority of SA learners, who are phone-first and data-conscious.
- Institutions and training providers want awareness among the *right* prospective students (by interest fit and geography) but have no efficient, low-cost channel to reach learners directly and early, before Grade 12 application season.

## 3. The Solution

- **Zero-friction delivery**: entirely inside WhatsApp — no app install, no login, minimal data usage, works on any phone.
- **Evidence-based profiling**: RIASEC (Holland Codes) interest inventory — a well-established, non-controversial career psychology framework — scored across 30 questions.
- **Actionable output**: matched careers with the specific subjects and marks each requires, a downloadable PDF report the learner can show a parent or teacher, and (new, per the sponsor model) locally relevant sponsor course options.
- **Privacy-by-design**: POPIA consent gate before any data is collected, parental-consent notice for minors, DELETE/STOP commands honoured immediately, no data sold or handed to third parties.

## 4. Business Model: Sponsorship, Not Lead Sales

Vula deliberately does **not** sell qualified leads. Instead:

- Colleges, universities, TVET colleges and corporate bursary/training programmes pay a **sponsorship fee** to have their relevant courses surfaced when a learner's RIASEC profile and city match.
- Sponsors get **awareness and top-of-mind positioning** with the exact audience they want (subject-relevant, geographically relevant, at the moment they're choosing a path) — not a database export.
- This sidesteps the two biggest legal/reputational risks of the old lead-sale model: (a) POPIA exposure from transferring minors' personal data to third parties, and (b) the perception of "selling children's data," which would be a serious brand and legal liability in the SA market.
- It also maps cleanly onto how large SA corporates already budget: **Skills Development spend under the B-BBEE scorecard** and **CSI/ESG education budgets** are both natural fits for "sponsor visibility to prospective students/apprentices," and are usually easier to unlock than a data-purchase line item.

### Pricing structure (proposed, to validate with first sponsors)
| Tier | What's included | Suggested price |
|---|---|---|
| **City Sponsor** | 1 institution, up to 3 courses, shown to learners in one city | R5,000/month |
| **National Sponsor** | Shown to all learners regardless of city | R20,000/month |
| **Founding Sponsor** (first 5–10 sponsors) | Discounted rate, logo on marketing site, case-study collaboration | 50% off Year 1 |

These are starting hypotheses, not fixed — validate against what a marketing/recruitment department already spends per acquired student via other channels (open days, print, digital ads), which is typically far higher than these figures.

## 5. Market

- ~1.6M learners are enrolled across Grades 10–12 in South Africa in any given year (DBE annual survey, order-of-magnitude).
- WhatsApp is used by the vast majority of SA smartphone owners across all income bands — it is the de facto national messaging layer, unlike app-based competitors.
- No dominant, free, WhatsApp-native career guidance product currently exists at scale in SA; adjacent tools (career quiz websites, paid psychometric assessments, in-school programmes) require infrastructure most target learners don't reliably have.

## 6. Competitive Landscape

| Category | Examples | Vula's edge |
|---|---|---|
| Paid psychometric/career assessments | Traditional psychologist-administered assessments | Free, instant, no appointment needed |
| Career-quiz websites | Various international/local quiz sites | Requires data + a browser; not tailored to SA subjects/qualifications; no WhatsApp delivery |
| In-school career days / university open days | Individual institution events | One-off, geographically limited, not personalised |
| Bursary/aggregator sites | Studytrust, FundiConnect-type listings | Learner has to already know what to search for; Vula surfaces relevant options unprompted based on profile |

Vula's structural advantage is distribution (WhatsApp) + personalisation (RIASEC-matched) + zero cost to the end user.

## 7. Traction To Date

- Production-ready platform live: WhatsApp assessment flow, PDF report generation, admin dashboard.
- Domain, brand, legal entity (Vula Career Guide (Pty) Ltd, reg 2026/021440/07) and core POPIA documentation in place.
- Marketing site live at vulacareers.co.za with a pre-launch waitlist.
- Moving from Twilio sandbox to a production WhatsApp Business sender (Meta Business verification in progress).
- Admin **Sponsors** module built: institutions and courses can be added, geographically tagged, and toggled on/off depending on active sponsorship status.

## 8. Go-To-Market (summary — see MARKETING_PLAN.md for detail)

Launch city-first (Cape Town), recruit an initial cohort of "founding sponsors" from local universities, TVET colleges and corporate bursary programmes at a discounted rate in exchange for case studies, then expand city-by-city as sponsor coverage grows, always keeping the learner experience free and non-empty (never show a city with zero relevant sponsors as a dead end — fall back to national sponsors and generic career guidance).

## 9. Team & Operations

- Founder-operated at this stage (Kyal Stahl, Information Officer). Solo/lean team is appropriate for an MVP-to-early-traction stage; plan to bring in a part-time sponsor/partnerships lead once the first 3–5 paying sponsors are signed (sales cycle for institutional budgets is relationship-heavy and time-consuming).
- Legal/compliance: attorney review of POPIA/consent flows and the sponsorship agreement template completed and confirmed fit for purpose (10 July 2026).

## 10. Financial Plan (high-level)

**Costs** (current, lean):
- Vercel hosting (serverless, likely near-free at current volume)
- Supabase (likely free/low tier at current volume)
- Twilio WhatsApp messaging (per-conversation cost once off sandbox — the main variable cost that scales with learner volume)
- Claude API (report generation, minimal per-report cost)

**Revenue**: sponsor fees per the tiering above. Unit economics only work once Twilio's production messaging cost is known — track cost-per-completed-assessment closely once live, since it scales with usage and is currently the largest true cost driver.

**Break-even logic**: a handful of sponsors (3–5 City Sponsors, or 1–2 National Sponsors) likely covers infrastructure + messaging costs at moderate learner volume; growth beyond that is what funds a part-time partnerships hire.

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| POPIA/legal exposure (minors) | Attorney review of consent flow and privacy pages completed (10 July 2026); RLS-locked DB; DELETE/STOP always honoured |
| Meta/WhatsApp Business approval delay | Templates and business verification already submitted; sandbox remains a fallback in the interim |
| Sponsor sales cycle is slow (institutional budgets, procurement) | Start with smaller, more agile private colleges/training providers alongside university outreach; corporate CSI/Skills Development budgets often move faster than academic marketing budgets |
| Twilio messaging costs scale with learner growth | Monitor cost-per-assessment from day one of production launch; consider WhatsApp's free-tier "service conversation" windows to minimise paid template sends |
| Reputational risk if positioning is misread as "selling learner data" | Sponsorship-not-leads model is the core differentiator — keep all marketing and legal copy explicit that no personal data is shared with sponsors |
