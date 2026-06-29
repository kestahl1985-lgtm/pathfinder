// Generates a personalised Vula career-report PDF on demand.
// URL: /report?t=<report_token>  → looks up the session in Supabase and
// returns application/pdf. Token is random & unguessable, so only the owner's
// link works. Twilio fetches this URL to deliver the document on WhatsApp.

const https = require("https");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { TRAIT_NAMES, careerById } = require("../lib/careers.js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Brand colours
const BRAND = rgb(0.427, 0.369, 0.988);
const BRAND2 = rgb(0.078, 0.722, 0.831);
const DARK = rgb(0.043, 0.063, 0.125);
const GREY = rgb(0.42, 0.45, 0.55);
const LIME = rgb(0.714, 0.957, 0.0);

function supaGet(path) {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL);
    const req = https.request(
      { hostname: url.hostname, path: `/rest/v1/${path}`, method: "GET",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
      (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } }); }
    );
    req.on("error", () => resolve(null));
    req.end();
  });
}

// Word-wrap a string to a max width, returning an array of lines.
function wrap(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

module.exports = async (req, res) => {
  const token = new URL(req.url, "http://x").searchParams.get("t");
  if (!token) { res.statusCode = 400; res.end("Missing token"); return; }
  if (!SUPABASE_URL || !SUPABASE_KEY) { res.statusCode = 500; res.end("Not configured"); return; }

  const rows = await supaGet(`whatsapp_sessions?report_token=eq.${encodeURIComponent(token)}&select=data&limit=1`);
  if (!Array.isArray(rows) || !rows.length) { res.statusCode = 404; res.end("Report not found"); return; }
  const d = rows[0].data || {};
  const matches = d.matches || [];
  const top = d.top || [];

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([595, 842]); // A4
  const M = 48;            // margin
  const W = 595 - M * 2;   // content width
  let y = 842;

  const ensure = (need) => { if (y - need < 60) { page = pdf.addPage([595, 842]); y = 842 - M; } };
  const text = (s, x, yy, f, size, color) => page.drawText(s, { x, y: yy, size, font: f, color });

  // Header band
  page.drawRectangle({ x: 0, y: 762, width: 595, height: 80, color: DARK });
  page.drawRectangle({ x: 0, y: 758, width: 595, height: 4, color: LIME });
  // logo mark
  page.drawCircle({ x: 56, y: 792, size: 4, color: rgb(1, 1, 1) });
  page.drawLine({ start: { x: 56, y: 792 }, end: { x: 49, y: 812 }, thickness: 3, color: rgb(1, 1, 1) });
  page.drawLine({ start: { x: 56, y: 792 }, end: { x: 63, y: 812 }, thickness: 3, color: LIME });
  text("vula", 76, 794, bold, 22, rgb(1, 1, 1));
  text("Career Report", 76, 778, font, 11, rgb(0.7, 0.74, 0.85));
  text(new Date().toLocaleDateString("en-ZA"), 595 - M - font.widthOfTextAtSize(new Date().toLocaleDateString("en-ZA"), 10), 782, font, 10, rgb(0.7, 0.74, 0.85));

  y = 730;

  // Student name + profile line
  text(`Prepared for ${d.name || "you"}`, M, y, bold, 20, DARK); y -= 24;
  const profile = [d.school, d.grade ? `Grade ${d.grade}` : null, d.age ? `Age ${d.age}` : null, d.suburb].filter(Boolean).join("  ·  ");
  if (profile) { text(profile, M, y, font, 11, GREY); y -= 30; } else y -= 8;

  // Strengths
  text("YOUR TOP STRENGTHS", M, y, bold, 12, BRAND); y -= 6;
  page.drawLine({ start: { x: M, y: y }, end: { x: M + W, y: y }, thickness: 1, color: rgb(0.9, 0.91, 0.95) }); y -= 18;
  top.slice(0, 3).forEach((t) => {
    page.drawCircle({ x: M + 4, y: y + 3, size: 3, color: LIME });
    text(TRAIT_NAMES[t] || t, M + 16, y, font, 13, DARK);
    y -= 20;
  });
  y -= 12;

  // Career matches
  text("CAREERS THAT FIT YOU", M, y, bold, 12, BRAND); y -= 6;
  page.drawLine({ start: { x: M, y: y }, end: { x: M + W, y: y }, thickness: 1, color: rgb(0.9, 0.91, 0.95) }); y -= 22;

  const topNames = top.slice(0, 2).map((t) => TRAIT_NAMES[t]).filter(Boolean);
  const strengths = topNames.length ? `Your strengths in ${topNames.join(" and ")} point this way. ` : "";

  matches.forEach((id, i) => {
    const c = careerById(id);
    if (!c) return;
    ensure(110);
    // number chip + name
    text(`${i + 1}.`, M, y, bold, 13, BRAND);
    text(c.name, M + 20, y, bold, 13, DARK); y -= 18;

    const blocks = [
      ["Why it fits you:", strengths + c.why],
      ["Subjects you'll need:", c.subjects],
      ["How to qualify:", c.qual],
    ];
    blocks.forEach(([label, body]) => {
      ensure(28);
      text(label, M + 20, y, bold, 10, BRAND2); y -= 13;
      wrap(body, font, 10.5, W - 24).forEach((ln) => { ensure(14); text(ln, M + 20, y, font, 10.5, rgb(0.2, 0.23, 0.3)); y -= 13.5; });
      y -= 2;
    });
    y -= 14;
  });

  // Footer / next steps + disclaimer on a fresh area
  ensure(120);
  text("YOUR NEXT STEPS", M, y, bold, 12, BRAND); y -= 6;
  page.drawLine({ start: { x: M, y: y }, end: { x: M + W, y: y }, thickness: 1, color: rgb(0.9, 0.91, 0.95) }); y -= 18;
  ["Choose or keep the subjects listed above.",
   "Chat to your Life Orientation teacher about these careers.",
   "Research the institutions and bursaries that offer these courses.",
  ].forEach((s) => { page.drawCircle({ x: M + 4, y: y + 3, size: 2.5, color: LIME }); wrap(s, font, 11, W - 16).forEach((ln) => { text(ln, M + 16, y, font, 11, DARK); y -= 15; }); y -= 3; });

  y -= 10;
  wrap("This report is general career guidance based on a self-assessment and is not professional career counselling. Subject and qualification requirements vary by institution and change over time — always confirm current requirements with the relevant school, college, university or funder.", font, 8.5, W).forEach((ln) => { ensure(12); text(ln, M, y, font, 8.5, GREY); y -= 11; });

  const bytes = await pdf.save();
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="Vula-Career-Report.pdf"`);
  res.setHeader("Cache-Control", "no-store");
  res.end(Buffer.from(bytes));
};
