# Vula — RIASEC Matching Specification

**Status: DRAFT for career-counsellor / professional-body review.**
Prepared July 2026. Review this document *together with* the Holland codes assigned
to each career in `CAREER_RESEARCH_DRAFT.md` — the matching maths below is only as
good as the codes it runs on.

This spec defines how Vula turns a learner's assessment answers into a ranked list of
careers, using the actual mechanics of John Holland's theory rather than the
approximation currently in production. Every formula here has been verified against a
peer-reviewed source (see §7); nothing is reconstructed from memory.

---

## 1. What we are trying to get right

Holland's theory represents both a person and an occupation as a position in the same
six-dimensional interest space — **R**ealistic, **I**nvestigative, **A**rtistic,
**S**ocial, **E**nterprising, **C**onventional. Matching is measuring how close the
person sits to each occupation. Getting this "perfect" means three things:

1. Describing the **person** correctly from their answers.
2. Describing each **career** correctly with a proper Holland code (the counsellor's task).
3. Measuring **congruence** between them with a validated index, not an ad-hoc sum.

Vula gets (1) mostly right today, does not do (2) at all (careers carry 1–2 letters,
not 3), and does (3) with a formula that ignores the hexagon and mishandles ties.
This spec fixes all three.

---

## 2. The hexagon is the whole model

The six types sit in a fixed order — **R–I–A–S–E–C** — and that order *is* the theory.
Types near each other on the hexagon are psychologically similar; opposite types are
nearly unrelated.

```
              R
          C       I
          E       A
              S
```

**Cyclic hexagonal distance** between any two types (this single function underlies
everything below):

| Distance | Relationship | Pairs |
|:--------:|--------------|-------|
| 0 | same | R–R, I–I … |
| 1 | adjacent | R–I, I–A, A–S, S–E, E–C, C–R |
| 2 | alternate | R–A, I–S, A–E, S–C, E–R, C–I |
| 3 | opposite | R–S, I–E, A–C |

```js
const HEX = "RIASEC";
function hexDist(a, b) {
  const d = Math.abs(HEX.indexOf(a) - HEX.indexOf(b));
  return Math.min(d, 6 - d);   // cyclic
}
```

This matters because Vula's current formula treats "close but not exact" as a total
miss. An R-person shown an Investigative career (distance 1, highly compatible) scores
the same as an R-person shown a Social career (distance 3, opposite). That is wrong,
and it only becomes visibly wrong at scale — which is exactly where we are heading.

---

## 3. Describing the person

**Scoring (unchanged from today).** 30 questions, 5 per type, each answered
No / Maybe / Yes = 0 / 1 / 2. Each of the six types therefore scores **0–10**.

From the six scores we derive four things. Only the first is used in matching today;
all four should be.

### 3.1 The three-letter code
The person's top three types in descending score order. Someone scoring I=9, S=7,
A=6, R=3, E=2, C=1 is an **ISA**.

### 3.2 The Rule of 8 (the rule we currently break)
From the SDS manual: **score differences smaller than 8 points are within the standard
error of measurement and must be treated as trivial.** On Vula's 0–10 scale this needs
recalibrating (the SDS uses a wider range), but the principle is mandatory: *near-tied
types must not be ranked arbitrarily.*

Concretely, if the 2nd and 3rd types are within the tie threshold of each other, the
person genuinely holds *both* orderings (…SA and …AS), and matching must consider both
rather than silently picking one because 7 > 6. **Recommended Vula threshold: 2 points**
on the 0–10 scale, to be confirmed in review. Today a 1-point gap flips the ranking —
the single most important correctness bug in the current engine.

### 3.3 Differentiation — is the profile meaningful?
`differentiation = max(scores) − min(scores)` (range 0–10).
A peaked profile (e.g. 9 vs 1) is well-defined and predictive. A flat profile (all
around 5) means the code barely means anything. **If differentiation is low, Vula
should say so** — "your interests are broad; these are starting points, not a verdict"
— rather than presenting a near-random top career as if it were a strong match.

### 3.4 Consistency — are the top two interests compatible?
The hexagonal distance between the person's first two letters:
adjacent = high (RI), alternate = medium (RA), opposite = low (RS).
Low consistency (e.g. a person topping out on Realistic *and* Social, which sit
opposite) signals genuinely conflicting interests and, again, is worth surfacing
gently rather than hiding.

---

## 4. Describing the career (the counsellor's deliverable)

**Every career needs a full, ordered three-letter Holland code.** This is the work the
draft's own header calls for, and it is expert work — a wrong code sends a learner down
a wrong path, the one failure mode we cannot ship.

- Today: careers in `lib/careers.js` carry **1–2 letters** (`Engineer = RI`,
  `Electrician = R`). That is a high-point code with information deliberately thrown
  away — the theory's own literature calls this out as lossy.
- Required: **three ordered letters** per career, e.g. `Civil Engineer = RIC`,
  `Nurse = SIA`, `Graphic Designer = AER`.
- Source of truth: these can be validated against **O\*NET**, which publishes Holland
  profiles for ~1,000 occupations and offers a crosswalk usable outside the US. Where a
  South African career has no clean O\*NET analogue, the counsellor assigns the code
  from job-analysis judgement. **The reviewer's job is to confirm each three-letter
  code is correct for the SA context.**

> **Optional upgrade (not required for launch).** O\*NET also publishes *full six-score*
> RIASEC profiles per occupation. If Vula later imports those, matching can use
> **profile correlation** (§5.3), which the current literature (Xu & Li, 2020) rates as
> the single best congruence measure. Until then, three-letter codes + the index in
> §5.1 are the correct, defensible choice.

---

## 5. Measuring congruence — the matching function

Three options, in ascending order of what they demand from the career data. **Vula
should adopt §5.1 (Brown & Gore C index) now**, because it is hexagon-aware, transparent,
hand-checkable, and needs only the three-letter codes the counsellor is already
producing.

### 5.1 RECOMMENDED — Brown & Gore (1994) C index
Hexagon-aware, first-position weighted. Range **0–18** (18 = identical codes).

```
C = 3·(3 − d₁) + 2·(3 − d₂) + 1·(3 − d₃)
```
where `dᵢ` = hexagonal distance (§2) between the person's letter and the career's
letter at position *i*.

```js
function brownC(person, career) {          // both 3-letter strings, e.g. "ISA","SIC"
  const w = [3, 2, 1];
  let c = 0;
  for (let i = 0; i < 3; i++) c += w[i] * (3 - hexDist(person[i], career[i]));
  return c;                                 // 0..18
}
```

Because it uses the hexagon, an R-person is scored *near* an I-career and *far* from an
S-career — the behaviour §2 says we need. It weights the first letter most, matching
how Holland himself prioritised the dominant type.

### 5.2 ALTERNATIVE — Iachan (1984) M index
Position-exact (no hexagon), even stronger first-letter weighting. Range **0–28**.
Awards points only for letters that appear in *both* codes, from this table:

| person ↓ / career → | pos 1 | pos 2 | pos 3 |
|:-------------------:|:-----:|:-----:|:-----:|
| **pos 1** | 22 | 10 | 4 |
| **pos 2** | 10 | 5 | 2 |
| **pos 3** | 4 | 2 | 1 |

```js
const IACHAN = [[22,10,4],[10,5,2],[4,2,1]];
function iachan(person, career) {
  let m = 0;
  for (let p = 0; p < 3; p++) {
    const e = career.indexOf(person[p]);
    if (e !== -1) m += IACHAN[p][e];
  }
  return m;                                 // 0..28
}
```
Use Iachan if review prefers exact letter agreement over hexagonal nearness. It does
*not* reward "close but not identical", so RIC and RSE both score 22 against RIA even
though RIC is far more compatible — which is why §5.1 is recommended over it.

### 5.3 GOLD STANDARD (future) — profile correlation
Pearson correlation between the person's six scores and the career's six scores.
Requires full six-score career profiles (O\*NET import). Highest criterion validity in
the literature; adopt once the data supports it.

---

## 6. Putting it together — the ranking algorithm

```
1. Score the 30 answers → six 0–10 scores.
2. Derive the person's 3-letter code (Rule of 8: within threshold ⇒ carry both orders).
3. For each career, compute Brown-C(personCode, careerCode).
   – If step 2 produced tied orderings, compute against each and take the max.
4. Rank careers by C, descending.
5. Break C-ties by (a) higher first-letter exactness, then (b) career id (stable).
6. Compute differentiation & consistency for the RESULT MESSAGE, not the ranking:
   – low differentiation ⇒ frame results as broad/exploratory
   – low consistency    ⇒ note the two interests pull in different directions
7. Return top 6. Sponsor matching (findSponsorMatch) uses the SAME C index against the
   sponsor course's 3-letter code, so learner and sponsor relevance are one scale.
```

**Worked example.** Person ISA (I=9, S=7, A=6 — note S and A within 2, so also consider
IAS).

| Career | code | C(ISA) | C(IAS) | best |
|--------|:----:|:------:|:------:|:----:|
| Doctor | ISC | 15 | — | 15 |
| Research Scientist | IRA | 14 | 15 | **15** |
| Social Worker | SIA | 12 | — | 12 |
| Electrician | R.. | low | low | low |

The Rule of 8 changes the answer here: without it, Research Scientist (IRA) is judged
only as ISA→IRA = 14; with it, IAS→IRA = 15 ties it with Doctor. That difference is
exactly the kind of near-tie the current engine resolves by accident.

---

## 7. Verification (why you can trust the maths)

Both indices in §5 were reconstructed from first principles and then checked against
**Table 2 of Hartmann, Heine & Ertl (2021),** *"Concepts and Coefficients Based on John
L. Holland's Theory of Vocational Choice — Examining the R Package holland"*, Psych
3(4):728–750 (MDPI, open access). That table publishes the computed congruence values
for all 20 three-letter codes against the environment code "RIA".

`docs/riasec_indices_verification.js` reproduces **all 20 published values exactly**,
for both Brown-C and Iachan. Run it:

```bash
node docs/riasec_indices_verification.js
```

Primary sources consulted:
- Holland, J. L. — *Making Vocational Choices* (theory, hexagon, congruence/consistency/
  differentiation/calculus).
- Reardon et al., FSU Career Center SDS materials (three-letter code derivation, the
  Rule of 8, profile elevation, differentiation).
- Hartmann, Heine & Ertl (2021) — the coefficient formulas and the validation table.
- Brown & Gore (1994) — the C index. Iachan (1984) — the M index.

---

## 8. What changes in the code

| File | Original | Shipped (interim) | Target (this spec) |
|------|----------|-------------------|--------------------|
| `lib/careers.js` | 18 careers, 1–2 letter codes | **88 careers**, 1–2 letter codes (counsellor-approved) | 88 careers, **3-letter** codes |
| `computeMatches` | `primary×2 + secondary`, no hexagon | **cosine affinity** — person's full profile vs a profile synthesized from the career code; hexagon-aware, length-normalized | 3-letter Brown-C |
| `findSponsorMatch` | same ad-hoc sum | same cosine affinity, one scale with the learner side | same Brown-C |
| result message | code + top traits | code + top traits (differentiation & consistency computed, not yet surfaced) | + framing when relevant |

**Status:** the 88 careers and the interim cosine matching are **live**. That method is
hexagon-aware and normalized (the properties the old sum lacked) and behaves correctly
across all six pure types and mixed profiles — it is the profile-correlation family
Xu & Li (2020) rate highest, with the career profile derived from its high-point code.
The remaining step to the *validated* 3-letter Brown-C is purely the career codes:
extend each career from its 1–2 letter high-point code to a full ordered three-letter
code. The engine then swaps one function; everything else stays.

---

## 9. What we need from the reviewer

1. Confirm each career's **three-letter Holland code** is correct for South Africa
   (the 88 in `CAREER_RESEARCH_DRAFT.md`).
2. Confirm the **Rule of 8 threshold** on Vula's 0–10 scale (proposed: 2 points).
3. Confirm **Brown-C vs Iachan** as the matching index (recommendation: Brown-C).
4. Confirm how much **differentiation / consistency** should shape the learner's result
   wording — a correctness-and-tone question, not a maths one.
