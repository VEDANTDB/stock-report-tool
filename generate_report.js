/**
 * generate_report.js
 * ──────────────────
 * Reads extracted_data.json + ai_analysis.json and produces a professional
 * investment research report as a .docx file.
 *
 * Usage:
 *   node generate_report.js \
 *     --data   extracted_data.json \
 *     --ai     ai_analysis.json \
 *     --out    Investment_Report.docx
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageBreak, LevelFormat
} = require('docx');
const fs   = require('fs');
const path = require('path');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = {};
process.argv.slice(2).forEach((v, i, a) => {
  if (v.startsWith('--')) args[v.slice(2)] = a[i + 1];
});
const dataFile = args.data || 'extracted_data.json';
const aiFile   = args.ai   || 'ai_analysis.json';
const outFile  = args.out  || 'Investment_Report.docx';

const D  = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const AI = JSON.parse(fs.readFileSync(aiFile,   'utf8'));

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  primary:    "1A3C6E",   // deep navy
  light:      "E8EEF7",   // light blue
  accent:     "1565C0",   // medium blue
  white:      "FFFFFF",
  dark:       "1A1A2E",
  mid:        "B0BEC5",
  red:        "B71C1C",
  green:      "1B5E20",
  amber:      "E65100",
  gray:       "F5F5F5",
  lightGreen: "E8F5E9",
  lightRed:   "FFEBEE",
  lightAmber: "FFF3E0",
  midBlue:    "BBDEFB",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const FULL_W = 9360; // content width DXA (8.5" − 2×0.75" margins)

const border1 = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const allBorders = { top: border1, bottom: border1, left: border1, right: border1 };

function fmt(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v % 1 === 0 ? v.toString() : v.toFixed(1);
  return String(v);
}
function fmtCr(v) {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function fmtPct(v) {
  if (v === null || v === undefined) return "—";
  return v.toFixed(1) + "%";
}

function tr(text, opts = {}) {
  return new TextRun({ text: String(text ?? ""), font: "Arial", size: opts.size || 20,
    bold: opts.bold, color: opts.color || C.dark, italics: opts.italic });
}

function para(runs_or_text, opts = {}) {
  const runs = typeof runs_or_text === "string"
    ? [tr(runs_or_text, opts)]
    : runs_or_text;
  return new Paragraph({
    children: runs,
    alignment: opts.align,
    spacing: { before: opts.before ?? 60, after: opts.after ?? 60 },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    border: opts.leftBorder ? {
      left: { style: BorderStyle.SINGLE, size: 20, color: opts.leftBorder }
    } : undefined,
    indent: opts.indent ? { left: opts.indent } : undefined,
    numbering: opts.bullet ? { reference: "bullets", level: 0 } : undefined,
  });
}

function h1(text, color = C.primary) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [tr(text, { bold: true, size: 30, color: C.white })],
    shading: { fill: color, type: ShadingType.CLEAR },
    spacing: { before: 300, after: 120 },
    indent: { left: 180 },
  });
}

function h2(text) {
  return new Paragraph({
    children: [tr(text, { bold: true, size: 24, color: C.accent })],
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.accent } },
  });
}

function spacer() {
  return new Paragraph({ children: [tr("")], spacing: { before: 60, after: 60 } });
}

// ── Table cell factories ──────────────────────────────────────────────────────
function tc(text, opts = {}) {
  const {
    w = 1000, fill = C.white, bold = false,
    color = C.dark, align = AlignmentType.LEFT, size = 18,
  } = opts;
  return new TableCell({
    borders: allBorders,
    width: { size: w, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: align,
      children: [tr(text, { bold, color, size })]
    })]
  });
}
function thc(text, w = 1000) {
  return tc(text, { w, fill: C.primary, bold: true, color: C.white, size: 18 });
}
function shc(text, w = 1000) {
  return tc(text, { w, fill: C.light, bold: true, color: C.dark, size: 17 });
}

function makeTable(headers, rows, widths, altRow = true) {
  const headerRow = new TableRow({
    children: headers.map((h, i) => thc(h, widths[i]))
  });
  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => {
      const isFirst = ci === 0;
      const fill = altRow && ri % 2 === 1 ? C.gray : C.white;
      return tc(cell, {
        w: widths[ci],
        fill,
        bold: isFirst,
        align: isFirst ? AlignmentType.LEFT : AlignmentType.RIGHT,
      });
    })
  }));
  return new Table({
    width: { size: FULL_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows]
  });
}

// ── Rating badge helper ───────────────────────────────────────────────────────
function ratingColor(r = "") {
  const upper = r.toUpperCase();
  if (upper.includes("STRONG BUY") || upper.includes("BUY"))  return C.green;
  if (upper.includes("SELL") || upper.includes("AVOID"))       return C.red;
  return C.amber;
}

function ratingBadge(rating) {
  const color = ratingColor(rating);
  return tc(rating, { w: 1440, bold: true, color, fill: C.gray, size: 19 });
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD DOCUMENT SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

const meta = D.meta;
const ann  = D.annual;
const qtr  = D.quarterly;
const bs   = D.balance_sheet;
const cf   = D.cash_flow;

const companyName = meta.company_name;
const cmp         = meta.cmp;
const mcap        = meta.mkt_cap_cr;

// ── 0. COVER PAGE ─────────────────────────────────────────────────────────────
function coverPage() {
  const items = [];

  // Big title bar
  items.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    shading: { fill: C.primary, type: ShadingType.CLEAR },
    spacing: { before: 600, after: 0 },
    children: [tr(companyName, { bold: true, size: 60, color: C.white })]
  }));
  items.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    shading: { fill: C.primary, type: ShadingType.CLEAR },
    spacing: { before: 0, after: 0 },
    children: [tr("Equity Research Report", { size: 28, color: C.midBlue })]
  }));
  items.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    shading: { fill: C.primary, type: ShadingType.CLEAR },
    spacing: { before: 60, after: 0 },
    children: [tr(`Generated: ${new Date().toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' })}`, { size: 22, color: C.mid })]
  }));
  items.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    shading: { fill: C.primary, type: ShadingType.CLEAR },
    spacing: { before: 60, after: 600 },
    children: [tr(`CMP: ₹${fmt(cmp)}  |  Market Cap: ₹${fmtCr(mcap)} Cr  |  FV: ₹${fmt(meta.face_value)}`, {
      bold: true, size: 24, color: C.white
    })]
  }));

  // Summary box
  const strat = AI.investment_strategy || [];
  const ratings = strat.map(s => `${s.horizon}: ${s.rating}`).join("  |  ");
  items.push(para([
    tr("INVESTMENT RATINGS  ", { bold: true, size: 22, color: C.amber }),
    tr(ratings, { bold: true, size: 22, color: C.dark })
  ], { fill: C.lightAmber, leftBorder: C.amber, indent: 200, before: 120, after: 0 }));
  items.push(para(
    AI.conclusion || "",
    { fill: C.lightAmber, leftBorder: C.amber, indent: 200, before: 0, after: 120 }
  ));

  return items;
}

// ── 1. COMPANY OVERVIEW ──────────────────────────────────────────────────────
function companyOverview() {
  const items = [h1("1. Company Overview")];
  items.push(para(AI.company_summary || "", { before: 80, after: 80 }));
  items.push(para(AI.sector_context  || "", { before: 60, after: 80 }));

  // Key stats row
  const kwids = [1560, 1560, 1560, 1560, 1560, 1560];
  const statsTable = new Table({
    width: { size: FULL_W, type: WidthType.DXA },
    columnWidths: kwids,
    rows: [
      new TableRow({ children: [
        thc("CMP (₹)", 1560), thc("Mkt Cap (₹ Cr)", 1560), thc("Face Value (₹)", 1560),
        thc("Trailing P/E", 1560), thc("P/Sales", 1560), thc("Shares (Cr)", 1560),
      ]}),
      new TableRow({ children: [
        tc(fmt(cmp),                        { w:1560, align: AlignmentType.RIGHT }),
        tc(fmtCr(mcap),                     { w:1560, align: AlignmentType.RIGHT }),
        tc(fmt(meta.face_value),            { w:1560, align: AlignmentType.RIGHT }),
        tc((meta.trailing_pe ? meta.trailing_pe + "x" : "—"), { w:1560, align: AlignmentType.RIGHT }),
        tc((meta.trailing_ps ? meta.trailing_ps + "x" : "—"), { w:1560, align: AlignmentType.RIGHT }),
        tc(fmt(meta.shares_cr),             { w:1560, align: AlignmentType.RIGHT }),
      ]})
    ]
  });
  items.push(statsTable);

  // Key highlights bullets
  if (AI.key_highlights?.length) {
    items.push(spacer());
    AI.key_highlights.forEach(h => items.push(para(h, { bullet: true })));
  }

  return items;
}

// ── 2. ANNUAL P&L ────────────────────────────────────────────────────────────
function annualPL() {
  const items = [h1("2. Annual P&L Performance")];
  items.push(para(
    `Revenue has grown at a 3-year CAGR of ${fmt(ann.sales_cagr_3y_pct)}% and 5-year CAGR of ${fmt(ann.sales_cagr_5y_pct)}%. ` +
    `PAT 3-year CAGR: ${fmt(ann.pat_cagr_3y_pct)}%. Latest OPM: ${fmtPct(ann.opm_pct?.slice(-1)[0])}.`,
    { before: 80, after: 80 }
  ));

  const n = ann.years.length;
  const colW = Math.floor(FULL_W / (n + 1));
  const firstW = FULL_W - colW * n;
  const widths = [firstW, ...Array(n).fill(colW)];

  const rows = [
    ["Revenue (₹ Cr)", ...ann.sales.map(fmtCr)],
    ["Operating Profit (₹ Cr)", ...ann.op_profit.map(fmtCr)],
    ["OPM %", ...ann.opm_pct.map(fmtPct)],
    ["PAT (₹ Cr)", ...ann.pat.map(fmtCr)],
    ["NPM %", ...ann.npm_pct.map(fmtPct)],
    ["EPS (₹)", ...ann.eps.map(v => v ? v.toFixed(1) : "—")],
    ["Depreciation (₹ Cr)", ...ann.depreciation.map(fmtCr)],
    ["Interest (₹ Cr)", ...ann.interest.map(fmtCr)],
  ];

  items.push(makeTable(["Metric", ...ann.years], rows, widths));
  return items;
}

// ── 3. QUARTERLY ─────────────────────────────────────────────────────────────
function quarterly() {
  const items = [h1("3. Quarterly Performance Trend")];
  items.push(para(AI.recent_quarter_commentary || "", { before: 80, after: 80 }));

  const n = qtr.periods.length;
  const colW = Math.floor(FULL_W / (n + 1));
  const firstW = FULL_W - colW * n;
  const widths = [firstW, ...Array(n).fill(colW)];

  const rows = [
    ["Revenue (₹ Cr)", ...qtr.sales.map(fmtCr)],
    ["Op. Profit (₹ Cr)", ...qtr.op_profit.map(fmtCr)],
    ["OPM %", ...qtr.opm_pct.map(fmtPct)],
    ["PAT (₹ Cr)", ...qtr.pat.map(fmtCr)],
  ];

  items.push(makeTable(["Metric", ...qtr.periods], rows, widths));
  return items;
}

// ── 4. BALANCE SHEET + CASH FLOW ─────────────────────────────────────────────
function balanceSheet() {
  const items = [h1("4. Balance Sheet & Cash Flow")];

  const n = bs.years.length;
  const colW = Math.floor(FULL_W / (n + 1));
  const firstW = FULL_W - colW * n;
  const widths = [firstW, ...Array(n).fill(colW)];

  const bsRows = [
    ["Total Equity (₹ Cr)", ...bs.equity.map(fmtCr)],
    ["Borrowings (₹ Cr)",   ...bs.borr.map(fmtCr)],
    ["Total Assets (₹ Cr)", ...bs.total_assets.map(fmtCr)],
    ["Cash & Bank (₹ Cr)",  ...bs.cash.map(fmtCr)],
    ["Receivables (₹ Cr)",  ...bs.recv.map(fmtCr)],
    ["Inventory (₹ Cr)",    ...bs.inventory.map(fmtCr)],
    ["Net Block (₹ Cr)",    ...bs.net_block.map(fmtCr)],
  ];
  items.push(makeTable(["Balance Sheet", ...bs.years], bsRows, widths));

  items.push(spacer());
  items.push(h2("Cash Flow Summary"));

  const cfn = cf.years.length;
  const cfColW = Math.floor(FULL_W / (cfn + 1));
  const cfFirstW = FULL_W - cfColW * cfn;
  const cfW = [cfFirstW, ...Array(cfn).fill(cfColW)];

  const cfRows = [
    ["From Operations (₹ Cr)", ...cf.ops.map(fmtCr)],
    ["From Investing (₹ Cr)",  ...cf.investing.map(fmtCr)],
    ["From Financing (₹ Cr)",  ...cf.financing.map(fmtCr)],
    ["Net Cash Flow (₹ Cr)",   ...cf.net.map(fmtCr)],
  ];
  items.push(makeTable(["Cash Flow", ...cf.years], cfRows, cfW));
  return items;
}

// ── 5. KEY RATIOS ─────────────────────────────────────────────────────────────
function ratios() {
  const items = [h1("5. Key Financial Ratios")];

  const n = bs.years.length;
  const colW = Math.floor(FULL_W / (n + 1));
  const firstW = FULL_W - colW * n;
  const widths = [firstW, ...Array(n).fill(colW)];

  const rows = [
    ["ROE %",          ...bs.roe_pct.map(fmtPct)],
    ["Debt / Equity",  ...bs.debt_eq.map(v => v ? v.toFixed(2) : "—")],
    ["Debtor Days",    ...bs.debtor_days.map(v => v ? v.toFixed(1) : "—")],
  ];
  items.push(makeTable(["Ratio", ...bs.years], rows, widths));
  return items;
}

// ── 6. REVENUE SEGMENTS ───────────────────────────────────────────────────────
function revenueSegments() {
  const segs = AI.revenue_segments || [];
  if (!segs.length) return [];

  const items = [h1("6. Revenue Mix & Segments")];
  const widths = [3120, 2120, 4120];
  const rows = segs.map(s => [s.segment || "", s.share || "", s.nature || ""]);
  items.push(makeTable(["Segment", "Revenue Share", "Characteristic"], rows, widths));
  return items;
}

// ── 7. INVESTMENT STRATEGY ────────────────────────────────────────────────────
function investmentStrategy() {
  const items = [h1("7. Multi-Horizon Investment Strategy")];
  items.push(para(
    "Our investment recommendation varies by time horizon, balancing current valuation, near-term catalysts, and long-term compounding potential.",
    { before: 80, after: 80 }
  ));

  const strat = AI.investment_strategy || [];
  const widths = [1440, 1800, 1440, 2340, 2340];

  const headerRow = new TableRow({ children: [
    thc("Horizon", 1440), thc("Period", 1800), thc("Rating", 1440),
    thc("Target Price", 2340), thc("Key Rationale", 2340),
  ]});

  const dataRows = strat.map((s, i) => {
    const fill = i % 2 === 1 ? C.gray : C.white;
    const rc = ratingColor(s.rating);
    return new TableRow({ children: [
      tc(s.horizon,  { w: 1440, bold: true, fill }),
      tc(s.period,   { w: 1800, fill }),
      tc(s.rating,   { w: 1440, bold: true, color: rc, fill }),
      tc(s.upside_text || `₹${s.target_low}–${s.target_high}`, { w: 2340, align: AlignmentType.RIGHT, fill }),
      tc(s.rationale || "", { w: 2340, fill }),
    ]});
  });

  items.push(new Table({
    width: { size: FULL_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows]
  }));

  // Per-horizon rationale blocks
  strat.forEach(s => {
    const rc = ratingColor(s.rating);
    items.push(spacer());
    items.push(para(
      [tr(`${s.horizon} — `, { bold: true, size: 22, color: rc }),
       tr(s.rating, { bold: true, size: 22, color: rc })],
      { before: 100, after: 0 }
    ));
    items.push(para(s.rationale || "", { before: 0, after: 60 }));
  });

  return items;
}

// ── 8. POSITIVES & NEGATIVES ─────────────────────────────────────────────────
function posNeg() {
  const items = [h1("8. Strengths & Risks")];

  items.push(h2("Key Positives"));
  (AI.positives || []).forEach(p => {
    items.push(para(
      [tr("✔ " + (p.title || ""), { bold: true, size: 20, color: C.green }),
       tr("  " + (p.detail || ""), { size: 20, color: C.dark })],
      { before: 60, after: 40 }
    ));
  });

  items.push(spacer());
  items.push(h2("Key Risks & Negatives"));
  (AI.negatives || []).forEach(n => {
    items.push(para(
      [tr("✖ " + (n.title || ""), { bold: true, size: 20, color: C.red }),
       tr("  " + (n.detail || ""), { size: 20, color: C.dark })],
      { before: 60, after: 40 }
    ));
  });

  return items;
}

// ── 9. ANALYST VIEWS ─────────────────────────────────────────────────────────
function analystViews() {
  const items = [h1("9. Analyst Views & Estimates")];
  items.push(para(
    `Street consensus as of report date. CMP: ₹${fmt(cmp)}.`,
    { before: 60, after: 80 }
  ));

  const views = AI.analyst_views || [];
  const widths = [1872, 1872, 1872, 1872, 1872];

  const headerRow = new TableRow({ children: [
    thc("Brokerage", 1872), thc("Rating", 1872), thc("Target", 1872),
    thc("Implied Upside", 1872), thc("Key Thesis", 1872),
  ]});

  const dataRows = views.map((v, i) => {
    const fill = i % 2 === 1 ? C.gray : C.white;
    const rc = ratingColor(v.rating);
    const tgt = parseFloat(String(v.target || "0").replace(/[₹,]/g, "")) || 0;
    const upside = tgt && cmp ? ((tgt / cmp - 1) * 100).toFixed(1) + "%" : "—";
    return new TableRow({ children: [
      tc(v.brokerage || "",  { w: 1872, bold: true, fill }),
      tc(v.rating || "",     { w: 1872, bold: true, color: rc, fill }),
      tc(v.target || "",     { w: 1872, align: AlignmentType.RIGHT, fill }),
      tc(upside,             { w: 1872, align: AlignmentType.RIGHT, color: tgt > cmp ? C.green : C.red, fill }),
      tc(v.thesis || "",     { w: 1872, fill }),
    ]});
  });

  items.push(new Table({
    width: { size: FULL_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows]
  }));

  return items;
}

// ── 10. VALUATION ─────────────────────────────────────────────────────────────
function valuation() {
  const items = [h1("10. Valuation Framework")];
  const val = AI.valuation || {};

  const widths = [2340, 2340, 2340, 2340];
  const rows = [];
  if (val.pe_method)      rows.push(["P/E Method",      val.pe_method.bull,      val.pe_method.base,      val.pe_method.bear]);
  if (val.evebitda_method) rows.push(["EV/EBITDA",      val.evebitda_method.bull, val.evebitda_method.base, val.evebitda_method.bear]);
  if (val.dcf_method)     rows.push(["DCF",             val.dcf_method.bull,     val.dcf_method.base,     val.dcf_method.bear]);

  // CMP row
  const peRow = new TableRow({ children: [
    tc("Current CMP", { w:2340, bold:true, fill: C.light }),
    tc(`₹${fmt(cmp)}`, { w:2340, fill: C.light, align: AlignmentType.RIGHT }),
    tc(`P/E: ${meta.trailing_pe || "—"}x`, { w:2340, fill: C.light, align: AlignmentType.RIGHT }),
    tc(`P/Sales: ${meta.trailing_ps || "—"}x`, { w:2340, fill: C.light, align: AlignmentType.RIGHT }),
  ]});

  items.push(makeTable(["Method", "Bull Case", "Base Case", "Bear Case"], rows, widths));
  const tbl = items[items.length - 1];
  // append CMP row manually by rebuilding (simpler: just add para)
  items.push(para(
    [tr("Current CMP: ", { bold: true }), tr(`₹${fmt(cmp)}  `, {}),
     tr("Trailing P/E: ", { bold: true }), tr(`${meta.trailing_pe || "—"}x  `, {}),
     tr("P/Sales: ", { bold: true }), tr(`${meta.trailing_ps || "—"}x`, {})],
    { fill: C.light, before: 80, after: 80, indent: 120 }
  ));

  if (val.pe_method?.note) {
    items.push(para(`P/E note: ${val.pe_method.note}`, { size: 18, italic: true }));
  }
  if (val.dcf_method?.note) {
    items.push(para(`DCF note: ${val.dcf_method.note}`, { size: 18, italic: true }));
  }

  return items;
}

// ── 11. MONITORABLES ──────────────────────────────────────────────────────────
function monitorables() {
  const items = [h1("11. Key Monitorables")];
  (AI.key_monitorables || []).forEach((m, i) => {
    items.push(para(`${i + 1}. ${m}`, { before: 60, after: 40 }));
  });
  return items;
}

// ── 12. CONCLUSION ─────────────────────────────────────────────────────────────
function conclusion() {
  const items = [h1("12. Summary & Conclusion")];

  const strat = AI.investment_strategy || [];
  const calls = strat.map(s => `${s.horizon}: ${s.rating} (${s.upside_text || `₹${s.target_low}–${s.target_high}`})`).join("  |  ");

  items.push(para(
    [tr("FINAL RATINGS  ", { bold: true, size: 22, color: C.accent }),
     tr(calls, { bold: true, size: 20, color: C.dark })],
    { fill: C.light, leftBorder: C.accent, indent: 200, before: 120, after: 0 }
  ));
  items.push(para(AI.conclusion || "", {
    fill: C.light, leftBorder: C.accent, indent: 200, before: 0, after: 120
  }));

  items.push(para(
    "DISCLAIMER: This report is generated automatically for informational purposes only and does not constitute financial advice. " +
    "Investing in equities involves risk of loss. Please consult a SEBI-registered investment advisor before making investment decisions. " +
    "All financial data is sourced from screener.in and company filings. Past performance is not indicative of future results.",
    { fill: C.lightRed, leftBorder: C.red, indent: 200, before: 120, after: 120, size: 16, color: "777777" }
  ));

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSEMBLE DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────

const allChildren = [
  ...coverPage(),
  new Paragraph({ children: [new PageBreak()] }),
  ...companyOverview(),
  ...annualPL(),
  ...quarterly(),
  ...balanceSheet(),
  ...ratios(),
  ...revenueSegments(),
  ...investmentStrategy(),
  ...posNeg(),
  ...analystViews(),
  ...valuation(),
  ...monitorables(),
  ...conclusion(),
];

const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
    }]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Arial", color: C.white },
        paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: C.accent },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    children: allChildren
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outFile, buf);
  console.log(`\n✅  Report written → ${outFile}`);
  console.log(`    Sections: 12  |  Company: ${companyName}`);
}).catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
