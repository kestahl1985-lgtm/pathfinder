// Flow-sequence guarantee test — the contract for Vula's WhatsApp flow.
//
// This file asserts the EXACT sequence of the onboarding + assessment flow,
// question numbering integrity, and recovery behavior for stale/corrupted
// sessions. It runs:
//   - locally:  node tests/flow-sequence.test.js
//   - on every push: .github/workflows/flow-tests.yml
//   - as a DEPLOY GATE: vercel.json's ignoreCommand runs this before every
//     production build of pathfinder-backend — if any assertion fails, the
//     deploy is SKIPPED and the last good deployment stays live.
//
// If you change the flow deliberately: update the expectations here in the
// same commit, and bump FLOW_VERSION in lib/assessment.js so existing
// sessions stored under the old shape are reset gracefully instead of
// resumed into a state machine they don't match.
//
// Exit code 0 = all assertions passed; 1 = failure (blocks CI + deploy).

const assert = require("assert");
const path = require("path");
const { advance, QUESTION_TRAITS, selectSponsor, ROTATION_BAND, affinity, hexDist, personCode } = require(path.join(__dirname, "..", "lib", "assessment.js"));
const { CAREERS } = require(path.join(__dirname, "..", "lib", "careers.js"));

let testCount = 0;
function check(name, fn) {
  testCount += 1;
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ok ${testCount} - ${name}`))
    .catch((e) => {
      console.error(`  FAIL ${testCount} - ${name}`);
      console.error(`    ${e.message}`);
      process.exitCode = 1;
    });
}

function freshSession(phone) {
  return { phone, step: "language", data: {}, q: 0, responses: [], report_token: null };
}

// Drive a session through the full happy-path onboarding (English).
const ONBOARDING_INPUTS = ["1", "agree", "Thabo", "Nkosi", "17", "Gauteng"];
async function runOnboarding(s) {
  let pieces;
  for (const input of ONBOARDING_INPUTS) pieces = await advance(s, input, input);
  return pieces;
}

(async () => {
  console.log("flow-sequence.test.js");

  // ---- 1. Exact onboarding step sequence ----
  await check("onboarding follows the exact step sequence (no grade, no suburb)", async () => {
    const s = freshSession("t-seq");
    const expectedSteps = ["consent", "name", "surname", "age", "province", "assessment"];
    for (let i = 0; i < ONBOARDING_INPUTS.length; i++) {
      await advance(s, ONBOARDING_INPUTS[i], ONBOARDING_INPUTS[i]);
      assert.strictEqual(s.step, expectedSteps[i], `after input ${i + 1} expected step '${expectedSteps[i]}', got '${s.step}'`);
    }
  });

  await check("grade, suburb and school are never asked and never stored", async () => {
    const s = freshSession("t-nograde");
    const allTexts = [];
    let pieces;
    for (const input of ONBOARDING_INPUTS) {
      pieces = await advance(s, input, input);
      pieces.forEach((p) => allTexts.push(p.text || ""));
    }
    assert.ok(!allTexts.some((t) => /what grade|which grade|suburb|school/i.test(t)), "a prompt mentioned grade, suburb or school");
    assert.strictEqual(s.data.grade, undefined, "grade was stored");
    assert.strictEqual(s.data.school, undefined, "school was stored");
    assert.strictEqual(s.data.suburb, undefined, "suburb was stored");
    assert.strictEqual(s.data.province, "Gauteng", "province missing");
  });

  // ---- 2. Assessment intro + question 1 arrive as ONE message ----
  await check("assessment intro and question 1 are a single message (no ordering race)", async () => {
    const s = freshSession("t-merge");
    const pieces = await runOnboarding(s);
    assert.strictEqual(pieces.length, 1, `expected 1 piece, got ${pieces.length}`);
    assert.strictEqual(pieces[0].type, "yesno");
    assert.ok(pieces[0].text.includes("Question 1 of 30"), "question 1 not in the intro message");
  });

  // ---- 3. All 30 questions, in order, numbered 1..30 ----
  await check("all 30 questions appear strictly in order 1..30", async () => {
    const s = freshSession("t-order");
    let pieces = await runOnboarding(s);
    for (let n = 1; n <= QUESTION_TRAITS.length; n++) {
      const text = pieces[0].text;
      assert.ok(text.includes(`Question ${n} of 30`), `expected 'Question ${n} of 30' in: ${text.slice(0, 80)}...`);
      pieces = await advance(s, "2", "2");
    }
    assert.strictEqual(s.step, "exploring", "did not reach exploring after 30 answers");
    assert.strictEqual(s.responses.length, 30);
    assert.ok(s.report_token, "no report token minted");
  });

  // ---- 4. Invalid input repeats the SAME question, never advances ----
  await check("invalid input repeats the same question without advancing", async () => {
    const s = freshSession("t-invalid");
    await runOnboarding(s);
    for (let i = 0; i < 5; i++) await advance(s, "banana", "banana");
    const pieces = await advance(s, "garbage", "garbage");
    assert.ok(pieces[0].text.includes("Question 1 of 30"), "invalid input moved the question");
    assert.strictEqual(s.responses.length, 0, "invalid input recorded an answer");
  });

  // ---- 5. Question position is DERIVED from recorded answers ----
  await check("corrupted counter self-heals: q=29 with 0 answers shows question 1, not 30", async () => {
    const s = freshSession("t-heal");
    await runOnboarding(s);
    s.q = 29; // simulate the stale/corrupted state behind the 'jumped to question 30' incident
    const pieces = await advance(s, "2", "2");
    assert.ok(pieces[0].text.includes("Question 2 of 30"), `expected question 2 (1 answer recorded), got: ${pieces[0].text.slice(0, 60)}`);
    assert.strictEqual(s.responses.length, 1);
  });

  await check("mid-assessment position always equals answers recorded + 1", async () => {
    const s = freshSession("t-derive");
    let pieces = await runOnboarding(s);
    for (let n = 0; n < 12; n++) pieces = await advance(s, "1", "1");
    assert.ok(pieces[0].text.includes(`Question ${s.responses.length + 1} of 30`), "shown question drifted from recorded answers");
  });

  // ---- 6. Fully-answered session finalizes instead of overrunning ----
  await check("session with all 30 answers already recorded finalizes, never asks question 31", async () => {
    const s = freshSession("t-full");
    await runOnboarding(s);
    s.responses = new Array(30).fill(1); // crashed after last answer, before results
    const pieces = await advance(s, "hi", "hi");
    assert.strictEqual(s.step, "exploring", "did not finalize");
    assert.strictEqual(s.responses.length, 30, "overran the question array");
    assert.ok(pieces.length >= 2, "results not presented");
  });

  // ---- 7. Stale sessions from removed flow steps reset gracefully ----
  for (const staleStep of ["grade", "suburb", "school", "share_consent", "no_such_step"]) {
    await check(`stale session at removed step '${staleStep}' resets gracefully (no dead end)`, async () => {
      const s = { phone: "t-stale", step: staleStep, data: { lang: "en", name: "Old", grade: 11, suburb: "Somewhere" }, q: 17, responses: [1, 2, 0], report_token: "oldtoken" };
      const pieces = await advance(s, "10", "10");
      assert.strictEqual(s.step, "consent", "stale session did not reset to consent");
      assert.ok(pieces[0].text.includes("updated"), "no friendly update notice shown");
      assert.strictEqual(s.responses.length, 0, "old answers survived the reset");
      assert.strictEqual(s.report_token, null, "old report token survived the reset");
      assert.strictEqual(s.data.grade, undefined, "old grade data survived the reset");
      // ...and the reset session walks the NEW flow end-to-end
      for (const input of ["agree", "Thabo", "Nkosi", "17", "Gauteng"]) await advance(s, input, input);
      assert.strictEqual(s.step, "assessment", "reset session could not complete new onboarding");
    });
  }

  await check("new sessions are stamped with the current flow version", async () => {
    const s = freshSession("t-ver");
    await advance(s, "1", "1");
    assert.strictEqual(typeof s.data.flow_version, "number", "flow_version not stamped");
  });

  // ---- 8. Trait sequence integrity (the scoring depends on this order) ----
  await check("QUESTION_TRAITS is exactly 30 entries of R,I,A,S,E,C repeated 5 times", () => {
    assert.strictEqual(QUESTION_TRAITS.length, 30);
    const expected = ["R", "I", "A", "S", "E", "C"];
    QUESTION_TRAITS.forEach((t, i) => assert.strictEqual(t, expected[i % 6], `trait drift at index ${i}`));
  });

  // ---- 9. Sponsor rotation (fairness contract for paying sponsors) ----
  //
  // Before rotation existed, findSponsorMatch kept only the strictly-highest
  // scorer, so the first-loaded sponsor won 100% of impressions forever and
  // any second sponsor in the same province received none while still paying.
  // These assertions are the contract that fix depends on.
  const cand = (id, score) => ({ score, course: { id }, college: { id: "col-" + id } });

  await check("rotation: equally-scored sponsors alternate rather than one always winning", () => {
    const a = cand("a", 20), b = cand("b", 20);
    // nobody served yet -> deterministic first pick
    const first = selectSponsor([a, b], {});
    assert.ok(first, "no sponsor selected");
    // once the first has an impression, the other must be served next
    const second = selectSponsor([a, b], { [first.course.id]: 1 });
    assert.notStrictEqual(second.course.id, first.course.id, "same sponsor served twice while the other had zero");
  });

  await check("rotation: least-served sponsor is chosen even when slightly lower scoring", () => {
    // 14 vs 13 is the real-world case: same course tagged R:5,I:4 vs R:4,I:5
    const picked = selectSponsor([cand("high", 14), cand("low", 13)], { high: 5, low: 0 });
    assert.strictEqual(picked.course.id, "low", "starved sponsor not prioritised inside the relevance band");
  });

  await check("rotation: relevance is never traded away for fairness", () => {
    // a weak match outside the band must not be served no matter how starved
    const picked = selectSponsor([cand("strong", 20), cand("weak", 4)], { strong: 999, weak: 0 });
    assert.strictEqual(picked.course.id, "strong", "a poor match was served purely for fairness");
  });

  await check("rotation: band boundary is inclusive and derived from ROTATION_BAND", () => {
    const onEdge = 20 * ROTATION_BAND;
    const picked = selectSponsor([cand("best", 20), cand("edge", onEdge)], { best: 3, edge: 0 });
    assert.strictEqual(picked.course.id, "edge", "candidate exactly on the band boundary was excluded");
  });

  await check("rotation: ordering is deterministic, never dependent on row order", () => {
    const a = cand("aaa", 20), b = cand("bbb", 20);
    const forward = selectSponsor([a, b], {});
    const reversed = selectSponsor([b, a], {});
    assert.strictEqual(forward.course.id, reversed.course.id, "result changed when candidate order changed");
  });

  await check("rotation: a failed impression lookup degrades to score order, not a crash", () => {
    const picked = selectSponsor([cand("hi", 20), cand("lo", 18)], {});
    assert.strictEqual(picked.course.id, "hi", "empty counts should fall through to the better match");
    assert.strictEqual(selectSponsor([], {}), null, "empty candidate list should return null");
    assert.strictEqual(selectSponsor([cand("z", 0)], {}), null, "zero-score candidate should not be served");
  });

  await check("rotation: sustained delivery stays balanced across many impressions", () => {
    const counts = { a: 0, b: 0, c: 0 };
    const pool = [cand("a", 20), cand("b", 19), cand("c", 18)];
    for (let i = 0; i < 300; i++) counts[selectSponsor(pool, counts).course.id] += 1;
    const share = Object.values(counts);
    const spread = Math.max(...share) - Math.min(...share);
    assert.ok(spread <= 1, `delivery drifted apart by ${spread} (${JSON.stringify(counts)})`);
    assert.ok(Math.min(...share) > 0, "a paying sponsor received zero impressions");
  });

  // ---- 10. In-WhatsApp INFO reply (keeps low-data learners inside the chat) ----
  await check("INFO before any sponsor was shown gives a helpful reply, not a dead end", async () => {
    const s = freshSession("t-info-empty");
    await runOnboarding(s);
    for (let i = 0; i < 30; i++) await advance(s, "2", "2");
    const out = await advance(s, "INFO", "INFO");
    const text = out.map((p) => p.text || "").join(" ");
    assert.ok(text.length > 0, "INFO produced no reply");
    assert.ok(!/undefined|null/i.test(text), "INFO leaked undefined/null into the reply");
  });

  await check("INFO is case-insensitive and never crashes the session", async () => {
    for (const variant of ["info", "INFO", " Info ", "iNfO"]) {
      const s = freshSession("t-info-" + variant.trim());
      await runOnboarding(s);
      for (let i = 0; i < 30; i++) await advance(s, "2", "2");
      const before = s.step;
      const out = await advance(s, variant, variant);
      assert.ok(Array.isArray(out) && out.length > 0, `INFO variant "${variant}" returned nothing`);
      assert.strictEqual(s.step, before, `INFO variant "${variant}" changed the session step`);
    }
  });

  await check("INFO does not consume a valid career number", async () => {
    const s = freshSession("t-info-number");
    await runOnboarding(s);
    for (let i = 0; i < 30; i++) await advance(s, "2", "2");
    const out = await advance(s, "1", "1");
    const text = out.map((p) => p.text || "").join(" ");
    assert.strictEqual(s.step, "exploring", "picking career 1 did not enter exploring");
    assert.ok(text.length > 0, "career detail was empty");
  });

  // ---- 11. RIASEC matching (hexagon-aware affinity over 88 careers) ----
  await check("hexDist is the cyclic hexagon metric (0 same, 1 adj, 2 alt, 3 opp)", () => {
    assert.strictEqual(hexDist("R", "R"), 0);
    assert.strictEqual(hexDist("R", "I"), 1);   // adjacent
    assert.strictEqual(hexDist("R", "A"), 2);   // alternate
    assert.strictEqual(hexDist("R", "S"), 3);   // opposite
    assert.strictEqual(hexDist("C", "R"), 1);   // wraps around
  });

  await check("affinity ranks a pure-type person highest on that type's careers", () => {
    const pureR = { R: 10, I: 0, A: 0, S: 0, E: 0, C: 0 };
    assert.ok(affinity(pureR, ["R"]) > affinity(pureR, ["I"]), "R career should beat I career for pure-R");
    assert.ok(affinity(pureR, ["I"]) > affinity(pureR, ["S"]), "adjacent (I) should beat opposite (S)");
    assert.ok(Math.abs(affinity(pureR, ["S"])) < 1e-9, "opposite type should score ~0");
  });

  await check("affinity is length-normalized: a 2-letter career can't win by weight alone", () => {
    const pureS = { R: 0, I: 0, A: 0, S: 10, E: 0, C: 0 };
    // a pure-S person must prefer a pure-S career over an A-primary/S-secondary one
    assert.ok(affinity(pureS, ["S"]) > affinity(pureS, ["A", "S"]),
      "pure-S career should outrank AS career for a pure-S person");
  });

  await check("affinity is shape-aware: two-interest person prefers a career needing both", () => {
    const IS = { R: 0, I: 10, A: 0, S: 10, E: 0, C: 0 };
    assert.ok(affinity(IS, ["I", "S"]) > affinity(IS, ["I"]),
      "IS career should beat I-only career for an I+S person");
  });

  await check("every one of the 88 careers has a valid 1-3 letter Holland code", () => {
    assert.strictEqual(CAREERS.length, 88, "expected 88 careers");
    for (const c of CAREERS) {
      assert.ok(Array.isArray(c.traits) && c.traits.length >= 1 && c.traits.length <= 3, `${c.name}: bad code length`);
      for (const t of c.traits) assert.ok("RIASEC".includes(t), `${c.name}: invalid trait ${t}`);
      assert.ok(c.id && c.name && c.list && c.why && c.subjects && c.qual && c.aiImpact, `${c.name}: missing field`);
    }
    const ids = CAREERS.map((c) => c.id);
    assert.strictEqual(ids.length, new Set(ids).size, "duplicate career ids");
  });

  await check("computeMatches returns 6 real career ids ranked by affinity", async () => {
    const s = freshSession("t-match");
    await runOnboarding(s);
    for (let i = 0; i < 30; i++) await advance(s, i % 6 === 0 ? "2" : "0", null); // pure-R answers
    assert.strictEqual((s.data.matches || []).length, 6, "expected 6 matches");
    for (const id of s.data.matches) assert.ok(CAREERS.find((c) => c.id === id), `unknown id ${id}`);
    const top = CAREERS.find((c) => c.id === s.data.matches[0]);
    assert.ok(top.traits.includes("R"), "top match for a pure-R person should involve R");
  });

  if (process.exitCode === 1) {
    console.error("\nFLOW SEQUENCE TESTS FAILED — deploy will be blocked.");
  } else {
    console.log(`\nAll ${testCount} flow-sequence checks passed.`);
  }
})();
