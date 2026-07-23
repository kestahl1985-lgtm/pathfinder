// Reconstruct the two key congruence indices from first principles and prove
// they reproduce Table 2 of Hartmann, Heine & Ertl (2021), Psych 3(4):728-750
// — all 20 person-codes compared against the environment code "RIA".

const HEX = "RIASEC"; // fixed hexagon order

// Cyclic hexagonal distance: 0 same, 1 adjacent, 2 alternate, 3 opposite.
function hexDist(a, b) {
  const i = HEX.indexOf(a), j = HEX.indexOf(b);
  const d = Math.abs(i - j);
  return Math.min(d, 6 - d);
}

// --- Iachan (1984) M index: position-match points, first letter weighted ---
// points[personPos][envPos], 0-indexed
const IACHAN = [
  [22, 10, 4],
  [10, 5, 2],
  [4, 2, 1],
];
function iachan(person, env) {
  let sum = 0;
  for (let p = 0; p < 3; p++) {
    const e = env.indexOf(person[p]);
    if (e !== -1) sum += IACHAN[p][e];
  }
  return sum;
}

// --- Brown & Gore (1994) C index: hexagon-aware, position weighted ---
// C = 3(3-d1) + 2(3-d2) + 1(3-d3)
function brownC(person, env) {
  const w = [3, 2, 1];
  let sum = 0;
  for (let p = 0; p < 3; p++) sum += w[p] * (3 - hexDist(person[p], env[p]));
  return sum;
}

// Published Table 2 values (env = RIA): [code, Brown-C, Iachan]
const TABLE2 = [
  ["RIA",18,28],["RIS",17,27],["RIE",16,27],["RIC",15,27],
  ["RAS",15,24],["RAE",14,24],["RAC",13,24],
  ["RSE",12,22],["RSC",11,22],["REC",9,22],
  ["IAS",12,12],["IAE",11,12],["IAC",10,12],
  ["ISE",9,10],["ISC",8,10],["IEC",6,10],
  ["ASE",6,4],["ASC",5,4],["AEC",3,4],
  ["SEC",0,0],
];

let pass = 0, fail = 0;
console.log("code   Brown-C (mine/pub)   Iachan (mine/pub)");
for (const [code, cPub, iPub] of TABLE2) {
  const c = brownC(code, "RIA"), i = iachan(code, "RIA");
  const ok = c === cPub && i === iPub;
  ok ? pass++ : fail++;
  console.log(`${code}    ${String(c).padStart(2)}/${String(cPub).padStart(2)}   ${ok&&c===cPub?"✓":"✗"}        ${String(i).padStart(2)}/${String(iPub).padStart(2)}   ${ok&&i===iPub?"✓":"✗"}`);
}
console.log(`\n${pass}/${pass+fail} rows reproduce the published table exactly` + (fail? "  — MISMATCH":""));
