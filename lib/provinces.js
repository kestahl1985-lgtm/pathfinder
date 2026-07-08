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
  "ec": "Eastern Cape",

  "free state": "Free State",
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
  "nc": "Northern Cape",

  "north west": "North West",
  "north-west": "North West",
  "nw": "North West",
  "noordwes": "North West",

  "western cape": "Western Cape",
  "wc": "Western Cape",
  "wes-kaap": "Western Cape",
};

// Normalizes free-text province input to one of PROVINCES. Returns "Other"
// if nothing recognisable is found.
function normalizeProvince(text) {
  const key = String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return "Other";
  if (ALIASES[key]) return ALIASES[key];
  for (const [alias, province] of Object.entries(ALIASES)) {
    if (key.includes(alias)) return province;
  }
  return "Other";
}

module.exports = { PROVINCES, normalizeProvince };
