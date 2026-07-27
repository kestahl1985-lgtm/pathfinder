# Vula — Subject-Based Study Paths: Spec & Review

**Status: DRAFT foundation for career-counsellor review.**
Prepared July 2026. The data lives in `lib/subject_requirements.js` (first-pass,
extracted from `CAREER_RESEARCH_DRAFT.md`). This spec explains what it powers, how
matching works, and — most importantly — what the reviewer must confirm before any
of it drives advice to a real learner.

---

## 1. What this enables

Two new WhatsApp paths, offered as a menu after onboarding (name → age → province),
alongside the existing 30-question assessment:

1. **"What could I study based on my subjects?"** — the learner picks the NSC subjects
   they take; Vula shows the careers/fields those subjects qualify them for.
2. **"I already know what I want to study"** — the learner picks their intended field;
   Vula shows the exact subjects and marks needed, the qualification pathway, and any
   matching sponsor course.

Both consume the same structured data. Both give a learner a concrete "you can / here's
what it takes" answer — which is precisely why the data must be correct.

## 2. Why this is review-gated (the honest part)

Getting a subject requirement wrong is the one failure mode the career research draft
warns about: telling a learner they qualify for medicine on Maths Literacy (they don't),
or that a trade needs Pure Maths when it doesn't, steers a real person wrong.

A first-pass automated extraction is **not** safe to ship. Of the 88 careers,
**63 (72%) are flagged `needs_review`**, broken down as:

| Flag reason | Count | What the reviewer does |
|---|---|---|
| Maths type unclear (Pure vs Literacy) | ~43 | Confirm which maths, and the minimum level |
| Source found no firm NSC requirement | ~10 | Confirm the real entry gate, or mark "open entry" |
| Low confidence / "verify" in the source | ~several | Verify against the institution's current admissions |
| No subjects detected | ~few | Fill in from the qualification's real requirements |

`source_text` on every entry is the verbatim research note and is the source of truth;
the structured fields are the parser's best guess and exist to be corrected.

## 3. The data schema (`lib/subject_requirements.js`)

Keyed by the same career `id` as `lib/careers.js`:

```js
engineer: {
  maths: "pure_required",         // pure_required | literacy_accepted | either_accepted
                                  //   | maths_needed_type_unclear | no_maths_gate
  required: [                     // best-effort NSC gates
    { subject: "Mathematics (Pure)", min_level: 5 },
    { subject: "Physical Sciences",  min_level: 5 },
  ],
  no_firm_requirement: false,     // true = source found no authoritative gate
  needs_review: false,            // true = a human must confirm before live use
  confidence: "High on subjects/structure",
  source_text: "Mathematics (Pure, not Lit) Level 5-6; Physical Sciences Level 5; …",
}
```

**NSC levels** run 1–7 (Level 4 ≈ 50%, Level 5 ≈ 60%, Level 6 ≈ 70%). Where the source
gave a percentage, it was converted roughly and flagged — confirm these.

## 4. How matching will work (the flow, stage 2)

Built once the data is approved. No new maths, just set logic over the reviewed data:

**Path 1 — subjects → careers.** The learner taps the subjects they take (WhatsApp list
picker; the fixed SA NSC set). A career *qualifies* when every entry in its `required`
is satisfied (subject present at ≥ `min_level`), with the Pure-vs-Literacy rule enforced
via `maths`. Show qualifying careers; optionally show "one subject away" as a nudge.
Careers with `no_firm_requirement` are shown as "open entry — no strict subject gate."

**Path 2 — known field → requirements.** The learner picks a field from a list; Vula
shows that career's `required` subjects and levels (in plain language), the `qual`
pathway from `lib/careers.js`, and runs the existing `findSponsorMatch` to surface a
sponsor course. This path can partly launch even while `needs_review` is being cleared,
because it *shows* a requirement rather than *judging* a learner against it — but it
should carry a "confirm with the institution" line until the entry is reviewed.

## 5. What we need from the reviewer

For each career (prioritise the 63 flagged):
1. **Maths: Pure, Literacy-accepted, or either** — and the minimum level. This is the
   single most important field; ~43 are currently unclear.
2. **Confirm each required subject + level**, and add any the parser missed.
3. **For "no firm requirement" careers**, state the real entry gate or confirm open entry.
4. **Flip `needs_review` to false** once an entry is confirmed — that is the signal the
   flow uses to decide an entry is safe to match on.

## 6. Sequencing

- **Stage 1 (this doc + `lib/subject_requirements.js`):** structured foundation, ready
  for review. Nothing is wired into the live flow yet.
- **Stage 2 (after review):** build the 3-way menu and both paths against the approved
  data, gated so only `needs_review: false` entries drive "you qualify" decisions.
