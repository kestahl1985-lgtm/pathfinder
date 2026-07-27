// Study-path helpers — powers the two non-assessment WhatsApp paths:
//   • "I already know what I want to study"  → pick a field, see requirements
//   • "What could I study from my subjects?"  → filter careers by Maths gate
//
// Reads the counsellor-reviewed data in careers.js + subject_requirements.js.
// Learner-facing "you qualify" logic only ever trusts confirmed entries
// (needs_review:false); a flagged entry can still be SHOWN, but carries a
// "confirm with the institution" caveat (see requirementText / isConfirmed).

const { CAREERS, careerById } = require("./careers.js");
const { SUBJECT_REQUIREMENTS } = require("./subject_requirements.js");
const i18n = require("./i18n.js");

// Primary Holland letter → the six category buckets. Every career has a
// 1–3 letter code; its FIRST letter is its home category, so each career
// appears in exactly one bucket (no duplicates, no gaps).
const CATEGORY_ORDER = ["R", "I", "A", "S", "E", "C"];

// Short interest-area labels for the WhatsApp list picker. WhatsApp caps a
// list-row title at 24 characters, which the full TRAIT_NAMES (esp. zu/xh)
// exceed — so these are deliberately compact; the full descriptive name is
// carried in the row DESCRIPTION instead. zu/xh/af mirror the pending
// native-speaker review that i18n.js already flags.
const CATEGORY_TITLES = {
  en: { R: "Practical & hands-on", I: "Analytical & curious", A: "Creative & expressive", S: "Helping people", E: "Business & leading", C: "Organised & detail" },
  zu: { R: "Izandla / Ukwenza", I: "Ukuhlaziya", A: "Ubuciko", S: "Ukusiza abantu", E: "Ibhizinisi & ubuholi", C: "Ukuhleleka" },
  xh: { R: "Ukwenza ngezandla", I: "Ukuhlalutya", A: "Ubuchule", S: "Ukunceda abantu", E: "Ishishini & ubunkokeli", C: "Ukucwangcisa" },
  af: { R: "Prakties & hands-on", I: "Analities & nuuskierig", A: "Kreatief", S: "Help mense", E: "Besigheid & leiding", C: "Georganiseerd" },
};

function categoryTitle(lang, trait) {
  const set = CATEGORY_TITLES[lang] || CATEGORY_TITLES.en;
  return set[trait] || CATEGORY_TITLES.en[trait] || trait;
}

// Rows for the interest-area list picker: id = RIASEC letter, a short title,
// and the fuller trait name as description.
function categoryRows(lang) {
  const names = i18n.TRAIT_NAMES[lang] || i18n.TRAIT_NAMES[i18n.DEFAULT_LANG];
  return CATEGORY_ORDER.map((tr) => ({
    id: tr,
    title: categoryTitle(lang, tr).slice(0, 24),
    description: (names[tr] || "").slice(0, 72),
  }));
}

function careersInCategory(trait) {
  return CAREERS
    .filter((c) => Array.isArray(c.traits) && c.traits[0] === trait)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.id);
}

// NSC level → the % floor learners actually recognise on a report card.
const LEVEL_PCT = { 1: 20, 2: 30, 3: 40, 4: 50, 5: 60, 6: 70, 7: 80 };
function levelLabel(lvl) {
  if (!lvl) return "";
  const pct = LEVEL_PCT[lvl];
  return pct ? ` — Level ${lvl}+ (${pct}%)` : ` — Level ${lvl}+`;
}

// Is this career's subject requirement confirmed for a "you qualify" decision?
// The 8 flagged entries are shown with a caveat rather than trusted outright.
function isConfirmed(careerId) {
  const r = SUBJECT_REQUIREMENTS[careerId];
  return Boolean(r) && r.needs_review === false;
}

// Which careers are reachable given the Maths a learner has.
//   have === "pure" : Pure Maths satisfies every gate → all careers
//   have === "lit"  : Maths Literacy → careers where Lit is accepted or none needed
//   have === "none" : no Maths      → only careers with no Maths gate
// Only confirmed entries are returned, since this path makes a reachability
// claim to the learner. Ordered by category then name for a stable listing.
function reachableByMaths(have) {
  const okMaths =
    have === "pure" ? new Set(["pure_required", "literacy_accepted", "either_accepted", "no_maths_gate"])
      : have === "lit" ? new Set(["literacy_accepted", "either_accepted", "no_maths_gate"])
        : new Set(["no_maths_gate"]);
  const ids = [];
  for (const trait of CATEGORY_ORDER) {
    for (const id of careersInCategory(trait)) {
      const r = SUBJECT_REQUIREMENTS[id];
      if (r && r.needs_review === false && okMaths.has(r.maths)) ids.push(id);
    }
  }
  return ids;
}

const MATHS_LABEL_KEY = {
  pure_required: "mathsPureRequired",
  literacy_accepted: "mathsEitherOk",
  either_accepted: "mathsEitherOk",
  no_maths_gate: "mathsNoneNeeded",
};

// The full "what it takes to study X" message — subjects + marks, the Maths
// rule in plain language, the qualification pathway, and (if the entry is
// flagged) an honest "confirm with the institution" line. Everything comes
// from the reviewed datasets; nothing is invented here.
function requirementText(lang, careerId) {
  const c = careerById(careerId);
  const r = SUBJECT_REQUIREMENTS[careerId];
  if (!c || !r) return i18n.t(lang, "studyNoData");

  let t = `📘 *${c.name}*\n`;

  // Subjects + levels (or an explicit "open entry" when there is no gate).
  if (Array.isArray(r.required) && r.required.length) {
    t += `\n${i18n.t(lang, "reqSubjectsHeader")}\n`;
    t += r.required.map((s) => `• ${s.subject}${levelLabel(s.min_level)}`).join("\n");
  } else {
    t += `\n${i18n.t(lang, "reqOpenEntry")}`;
  }

  // The Maths rule — the single most important line for an SA learner.
  const mk = MATHS_LABEL_KEY[r.maths];
  if (mk) t += `\n\n${i18n.t(lang, "reqMathsHeader")} ${i18n.t(lang, mk)}`;

  // Qualification pathway, from the career record.
  if (c.qual) t += `\n\n${i18n.t(lang, "careerQual")} ${c.qual}`;

  // Honesty caveat for the 8 flagged entries.
  if (r.needs_review) t += `\n\n${i18n.t(lang, "reqVerifyCaveat")}`;

  return t;
}

module.exports = {
  CATEGORY_ORDER,
  careersInCategory,
  categoryTitle,
  categoryRows,
  reachableByMaths,
  requirementText,
  isConfirmed,
};
