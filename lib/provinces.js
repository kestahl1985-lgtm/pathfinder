// Canonical South African province list — used to normalize the learner's
// self-reported province during onboarding (api/webhook.js via
// lib/assessment.js). Mirrors the alias-matching approach in lib/cities.js.

const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
  "Other",
];

// Aliases map free-text input to a canonical province above.
const ALIASES = {
  "eastern cape": "Eastern Cape",
  "eastern": "Eastern Cape",
  "ec": "Eastern Cape",

  "free state": "Free State",
  "free": "Free State",
  "fs": "Free State",
  "vrystaat": "Free State",

  "gauteng": "Gauteng",
  "gp": "Gauteng",

  "kwazulu-natal": "KwaZulu-Natal",
  "kwazulu natal": "KwaZulu-Natal",
  "kzn": "KwaZulu-Natal",
  "natal": "KwaZulu-Natal",

  "limpopo": "Limpopo",
  "lp": "Limpopo",

  "mpumalanga": "Mpumalanga",
  "mp": "Mpumalanga",

  "northern cape": "Northern Cape",
  "northern": "Northern Cape",
  "nc": "Northern Cape",

  "north west": "North West",
  "north-west": "North West",
  "nw": "North West",
  "noordwes": "North West",

  "western cape": "Western Cape",
  "western": "Western Cape",
  "wc": "Western Cape",
  "wes-kaap": "Western Cape",
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Normalizes free-text province input to one of PROVINCES. Returns "Other"
// if nothing recognisable is found.
//
// Bug fixed here (found during pre-launch testing): "western province" was
// silently normalizing to "Northern Cape". The old fallback used
// key.includes(alias), and the short 2-letter alias "nc" (Northern Cape) is
// a substring of the word "province" itself (pro-VIN-CE contains "nc") — so
// ANY answer containing the literal word "province" collided with it before
// ever reaching the real "western"/"western cape" aliases below. Two fixes:
// (1) strip a trailing "province" word before matching, since "<name>
// province" is a very natural way to answer "which province do you live
// in?"; (2) match aliases on word boundaries (\b) instead of raw substring
// containment, so a short alias can no longer match inside an unrelated
// word by coincidence.
function normalizeProvince(text) {
  let key = String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return "Other";
  key = key.replace(/\s*\bprovince\b\s*$/, "").trim();
  if (!key) return "Other";
  if (ALIASES[key]) return ALIASES[key];
  for (const [alias, province] of Object.entries(ALIASES)) {
    if (new RegExp(`\\b${escapeRegex(alias)}\\b`).test(key)) return province;
  }
  return "Other";
}

module.exports = { PROVINCES, normalizeProvince };
