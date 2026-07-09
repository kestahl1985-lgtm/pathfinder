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
const { advance, QUESTION_TRAITS } = require(path.join(__dirname, "..", "lib", "assessment.js"));

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
const ONBOARDING_INPUTS = ["1", "agree", "Thabo", "Nkosi", "Vula High", "17", "Gauteng"];
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
    const expectedSteps = ["consent", "name", "surname", "school", "age", "province", "assessment"];
    for (let i = 0; i < ONBOARDING_INPUTS.length; i++) {
      await advance(s, ONBOARDING_INPUTS[i], ONBOARDING_INPUTS[i]);
      assert.strictEqual(s.step, expectedSteps[i], `after input ${i + 1} expected step '${expectedSteps[i]}', got '${s.step}'`);
    }
  });

  await check("grade and suburb are never asked and never stored", async () => {
    const s = freshSession("t-nograde");
    const allTexts = [];
    let pieces;
    for (const input of ONBOARDING_INPUTS) {
      pieces = await advance(s, input, input);
      pieces.forEach((p) => allTexts.push(p.text || ""));
    }
    assert.ok(!allTexts.some((t) => /what grade|which grade|suburb/i.test(t)), "a prompt mentioned grade or suburb");
    assert.strictEqual(s.data.grade, undefined, "grade was stored");
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
  for (const staleStep of ["grade", "suburb", "share_consent", "no_such_step"]) {
    await check(`stale session at removed step '${staleStep}' resets gracefully (no dead end)`, async () => {
      const s = { phone: "t-stale", step: staleStep, data: { lang: "en", name: "Old", grade: 11, suburb: "Somewhere" }, q: 17, responses: [1, 2, 0], report_token: "oldtoken" };
      const pieces = await advance(s, "10", "10");
      assert.strictEqual(s.step, "consent", "stale session did not reset to consent");
      assert.ok(pieces[0].text.includes("updated"), "no friendly update notice shown");
      assert.strictEqual(s.responses.length, 0, "old answers survived the reset");
      assert.strictEqual(s.report_token, null, "old report token survived the reset");
      assert.strictEqual(s.data.grade, undefined, "old grade data survived the reset");
      // ...and the reset session walks the NEW flow end-to-end
      for (const input of ["agree", "Thabo", "Nkosi", "Vula High", "17", "Gauteng"]) await advance(s, input, input);
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

  if (process.exitCode === 1) {
    console.error("\nFLOW SEQUENCE TESTS FAILED — deploy will be blocked.");
  } else {
    console.log(`\nAll ${testCount} flow-sequence checks passed.`);
  }
})();
