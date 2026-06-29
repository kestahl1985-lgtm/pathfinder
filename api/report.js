// Generates a personalised Vula career-report PDF on demand.
// URL: /report?t=<report_token>  → looks up the session in Supabase and
// returns application/pdf. Token is random & unguessable, so only the owner's
// link works. Twilio fetches this URL to deliver the document on WhatsApp.

const https = require("https");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { TRAIT_NAMES, careerById } = require("../lib/careers.js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ---- Brand palette ----
const BRAND = rgb(0.427, 0.369, 0.988); // #6d5efc
const BRAND2 = rgb(0.078, 0.722, 0.831); // #14b8d4
const DARK = rgb(0.043, 0.063, 0.125); // #0b1020
const LIME = rgb(0.714, 0.957, 0.0); // #b6f400
const INK = rgb(0.13, 0.16, 0.22);
const GREY = rgb(0.45, 0.48, 0.56);
const TRACK = rgb(0.9, 0.91, 0.95);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 595, PAGE_H = 842, M = 50;
const CW = PAGE_W - M * 2;

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

// Draw the Vula fork mark inside a brand-coloured tile at (x,y) of given size.
function drawLogoTile(page, x, y, s) {
  page.drawRectangle({ x, y, width: s, height: s, color: BRAND });
  const cx = x + s / 2, baseY = y + s * 0.28, topY = y + s * 0.72;
  page.drawCircle({ x: cx, y: baseY, size: s * 0.06, color: WHITE });
  page.drawLine({ start: { x: cx, y: baseY }, end: { x: cx - s * 0.18, y: topY }, thickness: s * 0.075, color: WHITE });
  page.drawCircle({ x: cx - s * 0.18, y: topY, size: s * 0.06, color: WHITE });
  page.drawLine({ start: { x: cx, y: baseY }, end: { x: cx + s * 0.18, y: topY }, thickness: s * 0.075, color: LIME });
  page.drawCircle({ x: cx + s * 0.18, y: topY, size: s * 0.075, color: LIME });
}

async function buildReportPdf(d) {
  const matches = d.matches || [];
  const top = d.top || [];
  const scores = d.scores || {};

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = 0;

  const T = (s, x, yy, f, size, color) => page.drawText(String(s), { x, y: yy, size, font: f, color });
  const TR = (s, xRight, yy, f, size, color) => page.drawText(String(s), { x: xRight - f.widthOfTextAtSize(String(s), size), y: yy, size, font: f, color });

  // ---- Header band ----
  function header() {
    page.drawRectangle({ x: 0, y: PAGE_H - 96, width: PAGE_W, height: 96, color: DARK });
    page.drawRectangle({ x: 0, y: PAGE_H - 100, width: PAGE_W, height: 4, color: LIME });
    drawLogoTile(page, M, PAGE_H - 70, 38);
    T("Vula", M + 50, PAGE_H - 44, bold, 26, WHITE);
    T("Open your future.", M + 51, PAGE_H - 60, font, 10, rgb(0.62, 0.66, 0.78));
    TR("CAREER REPORT", PAGE_W - M, PAGE_H - 42, bold, 11, BRAND2);
    TR(new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }), PAGE_W - M, PAGE_H - 58, font, 10, rgb(0.62, 0.66, 0.78));
    y = PAGE_H - 130;
  }
  header();

  const newPage = () => { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; };
  const ensure = (need) => { if (y - need < 70) newPage(); };

  // Section heading with accent
  function section(title) {
    ensure(40);
    page.drawRectangle({ x: M, y: y - 2, width: 4, height: 15, color: BRAND });
    T(title, M + 12, y, bold, 13, DARK);
    y -= 12;
    page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.8, color: TRACK });
    y -= 20;
  }

  // ---- Intro ----
  T(`Prepared for ${d.name || "you"}`, M, y, bold, 22, DARK); y -= 22;
  const profile = [d.school, d.grade ? `Grade ${d.grade}` : null, d.age ? `Age ${d.age}` : null, d.suburb].filter(Boolean).join("   ·   ");
  if (profile) { T(profile, M, y, font, 11, GREY); y -= 12; }
  y -= 22;

  // ---- Strengths bar chart ----
  section("YOUR STRENGTHS");
  const order = ["R", "I", "A", "S", "E", "C"].sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
  const MAXSCORE = 10;
  const labelW = 150, barX = M + labelW + 6, barW = CW - labelW - 46, barH = 11;
  order.forEach((t, i) => {
    ensure(24);
    const val = Math.max(0, Math.min(MAXSCORE, scores[t] || 0));
    const fillW = Math.max(2, (val / MAXSCORE) * barW);
    const isTop = i === 0;
    T(TRAIT_NAMES[t] || t, M, y - 1, font, 10, isTop ? DARK : INK);
    page.drawRectangle({ x: barX, y: y - 4, width: barW, height: barH, color: TRACK });
    page.drawRectangle({ x: barX, y: y - 4, width: fillW, height: barH, color: isTop ? LIME : BRAND });
    TR(`${val}/10`, M + CW, y - 1, bold, 9, isTop ? rgb(0.42, 0.55, 0) : BRAND);
    y -= 22;
  });
  y -= 6;
  const topNames = top.slice(0, 2).map((t) => TRAIT_NAMES[t]).filter(Boolean);
  if (topNames.length) {
    const line = `Your standout strengths are ${topNames.join(" and ")}.`;
    wrap(line, font, 10.5, CW).forEach((ln) => { T(ln, M, y, font, 10.5, GREY); y -= 14; });
  }
  y -= 18;

  // ---- Careers ----
  section("CAREERS THAT FIT YOU");
  const strengths = topNames.length ? `Your strengths in ${topNames.join(" and ")} point this way. ` : "";
  matches.forEach((id, i) => {
    const c = careerById(id);
    if (!c) return;
    ensure(108);
    // number chip
    page.drawRectangle({ x: M, y: y - 4, width: 20, height: 20, color: BRAND });
    TR(`${i + 1}`, M + 14, y + 1, bold, 12, WHITE);
    T(c.name, M + 30, y + 1, bold, 13, DARK); y -= 24;

    [["Why it fits you", strengths + c.why], ["Subjects you'll need", c.subjects], ["How to qualify", c.qual]].forEach(([label, body]) => {
      ensure(26);
      T(label.toUpperCase(), M + 30, y, bold, 8.5, BRAND2); y -= 12;
      wrap(body, font, 10.5, CW - 36).forEach((ln) => { ensure(13); T(ln, M + 30, y, font, 10.5, INK); y -= 13; });
      y -= 3;
    });
    y -= 8;
    if (i < matches.length - 1) { page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.6, color: TRACK }); y -= 16; }
  });
  y -= 10;

  // ---- Next steps ----
  section("YOUR NEXT STEPS");
  ["Choose or keep the subjects listed above.",
   "Chat to your Life Orientation teacher about these careers.",
   "Research institutions and bursaries that offer these courses.",
  ].forEach((s) => {
    ensure(18);
    page.drawCircle({ x: M + 4, y: y + 3, size: 2.5, color: LIME });
    T(s, M + 16, y, font, 11, INK); y -= 18;
  });
  y -= 14;

  // ---- Disclaimer ----
  ensure(50);
  page.drawRectangle({ x: M, y: y - 38, width: CW, height: 46, color: rgb(0.96, 0.97, 0.99) });
  let dy = y - 4;
  wrap("This report is general career guidance based on a self-assessment and is not professional career counselling. Subject and qualification requirements vary by institution and change over time — always confirm current requirements with the relevant school, college, university or funder.", font, 8.5, CW - 24).forEach((ln) => { T(ln, M + 12, dy, font, 8.5, GREY); dy -= 11; });

  // ---- Footer on every page ----
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 44 }, end: { x: M + CW, y: 44 }, thickness: 0.6, color: TRACK });
    p.drawText("Vula  ·  Open your future.", { x: M, y: 32, size: 8.5, font: bold, color: BRAND });
    const pg = `Page ${i + 1} of ${pages.length}`;
    p.drawText(pg, { x: M + CW - font.widthOfTextAtSize(pg, 8.5), y: 32, size: 8.5, font, color: GREY });
    p.drawText("vulacareers.co.za", { x: PAGE_W / 2 - font.widthOfTextAtSize("vulacareers.co.za", 8.5) / 2, y: 32, size: 8.5, font, color: GREY });
  });

  return await pdf.save();
}

module.exports = async (req, res) => {
  const token = new URL(req.url, "http://x").searchParams.get("t");
  if (!token) { res.statusCode = 400; res.end("Missing token"); return; }
  if (!SUPABASE_URL || !SUPABASE_KEY) { res.statusCode = 500; res.end("Not configured"); return; }

  const rows = await supaGet(`whatsapp_sessions?report_token=eq.${encodeURIComponent(token)}&select=data&limit=1`);
  if (!Array.isArray(rows) || !rows.length) { res.statusCode = 404; res.end("Report not found"); return; }

  const bytes = await buildReportPdf(rows[0].data || {});
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="Vula-Career-Report.pdf"');
  res.setHeader("Cache-Control", "no-store");
  res.end(Buffer.from(bytes));
};

module.exports.buildReportPdf = buildReportPdf;
