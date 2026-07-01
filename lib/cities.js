// Canonical city list for sponsor matching — shared by the WhatsApp onboarding
// flow (api/webhook.js) and duplicated in the admin's city dropdown
// (admin/src/pages/SponsorsPage.tsx, kept in sync manually).

const CITIES = [
  "Cape Town",
  "Johannesburg",
  "Pretoria",
  "Durban",
  "Gqeberha",
  "Bloemfontein",
  "East London",
  "Polokwane",
  "Mbombela",
  "Kimberley",
  "Other",
];

// Aliases map free-text input to a canonical city above.
const ALIASES = {
  "cape town": "Cape Town",
  "capetown": "Cape Town",
  "cpt": "Cape Town",
  "kaapstad": "Cape Town",

  "johannesburg": "Johannesburg",
  "joburg": "Johannesburg",
  "jozi": "Johannesburg",
  "jhb": "Johannesburg",

  "pretoria": "Pretoria",
  "tshwane": "Pretoria",
  "pta": "Pretoria",

  "durban": "Durban",
  "dbn": "Durban",
  "ethekwini": "Durban",

  "gqeberha": "Gqeberha",
  "port elizabeth": "Gqeberha",
  "pe": "Gqeberha",

  "bloemfontein": "Bloemfontein",
  "bloem": "Bloemfontein",
  "bfn": "Bloemfontein",

  "east london": "East London",
  "el": "East London",

  "polokwane": "Polokwane",
  "pietersburg": "Polokwane",

  "mbombela": "Mbombela",
  "nelspruit": "Mbombela",

  "kimberley": "Kimberley",
};

// Normalizes free-text city input to one of CITIES. Returns "Other" if
// nothing recognisable is found.
function normalizeCity(text) {
  const key = String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return "Other";
  if (ALIASES[key]) return ALIASES[key];
  for (const [alias, city] of Object.entries(ALIASES)) {
    if (key.includes(alias)) return city;
  }
  return "Other";
}

module.exports = { CITIES, normalizeCity };
