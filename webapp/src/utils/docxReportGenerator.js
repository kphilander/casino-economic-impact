/**
 * Word (.docx) Report Generator for GEMS (Gaming Economic Modeling System)
 *
 * Produces a full, long-form consultant-grade economic impact report — a
 * structured written document of roughly 25 pages with a title page, table of
 * contents, numbered sections, substantial narrative on the economics and
 * methodology, results exhibits, fiscal analysis, discussion, limitations,
 * technical appendices, a glossary, and references.
 *
 * The prose is parameterized: every figure, multiplier, and qualitative claim
 * is derived from the same `results` / `inputs` objects the dashboard and the
 * PPTX deck use, so the written narrative always matches the underlying model.
 *
 * The output opens in Microsoft Word / Google Docs / LibreOffice, and can be
 * "Saved as PDF" in one step — covering both the Word and PDF deliverables.
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, VerticalAlign,
  ShadingType, Header, Footer, PageNumber, TabStopType, TabStopPosition,
  FootnoteReferenceRun, LevelFormat,
} from 'docx';
import { formatNumber, formatCurrency, formatJobs } from './calculations';
import { BRAND, PRODUCT_NAME_VERSIONED, getSuggestedCitation } from '../brand';

// ---- palette --------------------------------------------------------------
const C = {
  navy: '14304F',
  navyDeep: '0E1D31',
  brass: 'B7892F',
  ink: '1F2733',
  body: '252C36',
  accent: '2563A8',
  muted: '5B6573',
  faint: '8A93A0',
  hairline: 'D7DCE3',
  rowAlt: 'F5F7FA',
  panel: 'EEF2F7',
  white: 'FFFFFF',
};
const SERIF = 'Georgia';   // headings + body — formal report feel
const SANS = 'Calibri';    // eyebrows, table headers, captions, furniture

// ---- inline builders ------------------------------------------------------
const r = (text, o = {}) => new TextRun({ text, font: SERIF, size: 21, color: C.body, ...o });
const rs = (text, o = {}) => new TextRun({ text, font: SANS, size: 21, color: C.body, ...o });

/** Justified body paragraph. `content` is a string or an array of runs. */
function P(content, o = {}) {
  const children = Array.isArray(content) ? content : [r(content)];
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 288 }, children, ...o });
}
/** Slightly larger lead-in paragraph. */
function lead(content) {
  const children = Array.isArray(content) ? content : [r(content, { size: 23, color: C.ink })];
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 200, line: 300 }, children });
}
function H1(text, { brk = true } = {}) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: brk, keepNext: true, spacing: { after: 80 }, children: [new TextRun({ text, font: SERIF, bold: true, color: C.navy, size: 32 })] });
}
function appendixH1(text, { brk = false } = {}) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: brk, keepNext: true, spacing: { before: 280, after: 80 }, children: [new TextRun({ text, font: SERIF, bold: true, color: C.navy, size: 28 })] });
}
function H2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text, font: SERIF, bold: true, color: C.navy, size: 25 })] });
}
function bullet(content) {
  return new Paragraph({ bullet: { level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 90, line: 280 },
    children: Array.isArray(content) ? content : [r(content)] });
}
function numItem(content, ref) {
  return new Paragraph({ numbering: { reference: ref, level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 90, line: 280 },
    children: Array.isArray(content) ? content : [r(content)] });
}
const fnref = (id) => new FootnoteReferenceRun(id);
const spacer = (h = 120) => new Paragraph({ spacing: { after: h }, children: [r('')] });

/** Exhibit caption above a table/figure. */
function caption(text) {
  return new Paragraph({ spacing: { before: 120, after: 80 }, keepNext: true,
    children: [new TextRun({ text, font: SANS, bold: true, size: 17, color: C.navy, allCaps: false })] });
}
/** Source line beneath a table. */
function sourceLine(text) {
  return new Paragraph({ spacing: { before: 60, after: 200 },
    children: [new TextRun({ text: `Source: ${text}`, font: SANS, italics: true, size: 16, color: C.muted })] });
}

// ---- table helpers --------------------------------------------------------
const noB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const thin = { style: BorderStyle.SINGLE, size: 4, color: C.hairline };

function cell(content, { header, align = AlignmentType.LEFT, shade, bold, color } = {}) {
  const runs = Array.isArray(content) ? content : [new TextRun({
    text: String(content), font: SANS, size: 18, bold: bold || header,
    color: color || (header ? C.white : C.body),
  })];
  return new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    shading: shade ? { type: ShadingType.CLEAR, fill: shade } : undefined,
    margins: { top: 70, bottom: 70, left: 120, right: 120 },
    children: [new Paragraph({ alignment: align, children: runs })],
  });
}

function dataTable(headers, rows, { colWidths } = {}) {
  const headerRow = new TableRow({ tableHeader: true, children: headers.map((h, i) =>
    cell(h, { header: true, shade: C.navy, align: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT })) });
  const bodyRows = rows.map((row, ri) => new TableRow({ children: row.map((c, i) =>
    cell(c, {
      align: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
      shade: row.isTotal ? C.panel : (ri % 2 === 1 ? C.rowAlt : undefined),
      bold: row.isTotal || i === 0,
      color: row.isTotal ? C.navy : (i === 0 ? C.ink : C.body),
    })) }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: colWidths,
    layout: colWidths ? 'fixed' : undefined,
    borders: { top: thin, bottom: thin, left: noB, right: noB, insideHorizontal: thin, insideVertical: noB },
    rows: [headerRow, ...bodyRows],
  });
}

const dataRow = (a) => { a.isTotal = false; return a; };
const totalRow = (a) => { a.isTotal = true; return a; };

// ---- data-bar visualizations ----------------------------------------------
// Effect ramp for the stacked composition bars (on-brand: navy → blue → brass).
const BAR = { direct: '14304F', indirect: '2563A8', induced: 'B7892F' };

/** A horizontal stacked bar showing direct/indirect/induced composition of a
 *  metric. Segment widths are proportional to value; share labels appear in
 *  segments wide enough to hold them. */
function stackedBar({ direct, indirect, induced }) {
  const segs = [
    { v: Math.max(direct, 0), color: BAR.direct },
    { v: Math.max(indirect, 0), color: BAR.indirect },
    { v: Math.max(induced, 0), color: BAR.induced },
  ];
  const total = segs.reduce((s, x) => s + x.v, 0) || 1;
  const fullW = 9360;
  let widths = segs.map((s) => Math.max(Math.round((s.v / total) * fullW), 70));
  const sum = widths.reduce((a, b) => a + b, 0);
  widths[widths.length - 1] += fullW - sum; // true up to full width
  const cells = segs.map((s, i) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: s.color },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 20, bottom: 20, left: 30, right: 30 },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({
      text: widths[i] > 620 ? `${Math.round((s.v / total) * 100)}%` : '',
      font: SANS, bold: true, color: 'FFFFFF', size: 16,
    })] })],
  }));
  return new Table({
    width: { size: fullW, type: WidthType.DXA }, columnWidths: widths, layout: 'fixed',
    borders: { top: noB, bottom: noB, left: noB, right: noB, insideHorizontal: noB,
      insideVertical: { style: BorderStyle.SINGLE, size: 8, color: 'FFFFFF' } },
    rows: [new TableRow({ height: { value: 320, rule: 'atLeast' }, children: cells })],
  });
}

/** Legend for the stacked bars. */
function barLegend() {
  const item = (color, label, last) => [
    new TextRun({ text: '■ ', font: SANS, color, size: 20 }),
    new TextRun({ text: label + (last ? '' : '       '), font: SANS, color: C.muted, size: 16 }),
  ];
  return new Paragraph({ spacing: { before: 80, after: 220 }, children: [
    ...item(BAR.direct, 'Direct'), ...item(BAR.indirect, 'Indirect'), ...item(BAR.induced, 'Induced', true),
  ] });
}

// ---- value formatters -----------------------------------------------------
const n = (v) => formatNumber(v, 1);
const j = (v) => formatJobs(v);
const x = (v) => (typeof v === 'number' && isFinite(v) ? `${formatNumber(v, 2)}x` : '—');
const m$ = (v) => formatCurrency(v);
const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

// ===========================================================================
export async function generateDocxReport(results, inputs, authorInfo = {}) {
  const inputMode = inputs.inputMode || 'department';
  const totalRevenue = inputMode === 'total' && inputs.revenues?.total
    ? inputs.revenues.total
    : Object.entries(inputs.revenues || {}).filter(([k]) => k !== 'total').reduce((s, [, v]) => s + (v || 0), 0);

  const isSample = !!inputs.isSample;
  const stateName = inputs.state || 'the state';
  const project = inputs.casinoName || '';
  const typeLabel = inputs.propertyTypeLabel || 'gaming establishment';
  const typeLower = typeLabel.toLowerCase();
  const isOnline = ['ONLINE_CASINO', 'ONLINE_SPORTSBOOK'].includes(inputs.propertyType);
  const op = project || 'the subject operation';
  const opCap = project || 'The operation';
  const longDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const yr = new Date().getFullYear();

  const t = results.totals;
  const mlt = results.multipliers;
  const byRevenue = Array.isArray(results.byRevenue) ? results.byRevenue.filter((b) => (b.revenue || 0) > 0) : [];
  const gaming = inputs.gamingTaxResult;
  const payroll = inputs.payrollTaxResult;
  const household = inputs.householdTaxResult;

  const indOut = t.output.indirect + t.output.induced; // ripple output
  const totalTax = (gaming?.amount || 0) + t.tax.total + (payroll?.total || 0) + (household?.total || 0);

  // Derived metrics for richer narrative (full-dollar values where noted)
  const usd0 = (v) => '$' + Math.round(v).toLocaleString('en-US');
  const compPerFteDirect = t.employment.direct ? (t.wages.direct * 1e6) / t.employment.direct : 0;
  const compPerFteTotal = t.employment.total ? (t.wages.total * 1e6) / t.employment.total : 0;
  const outputPerFteDirect = t.employment.direct ? (t.output.direct * 1e6) / t.employment.direct : 0;
  const rippleJobs = t.employment.indirect + t.employment.induced;
  const gamingShare = totalTax ? (gaming?.amount || 0) / totalTax : 0;

  const licenseLine = isSample ? 'SAMPLE — FOR EVALUATION ONLY'
    : project ? `Prepared for ${project}` : `${PRODUCT_NAME_VERSIONED} Economic Impact Report`;

  // ---------------------------------------------------------------- TITLE
  const titlePage = [
    new Paragraph({ spacing: { before: 200, after: 0 }, border: { bottom: { color: C.brass, space: 10, style: BorderStyle.SINGLE, size: 24 } }, children: [
      new TextRun({ text: BRAND.publisher.toUpperCase(), font: SANS, bold: true, color: C.navy, size: 24, characterSpacing: 80 }),
    ] }),
    new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: BRAND.publisherTagline, font: SANS, color: C.muted, size: 18, characterSpacing: 20 })] }),
    new Paragraph({ spacing: { before: 1600, after: 80 }, children: [
      new TextRun({ text: 'Economic Impact Analysis', font: SERIF, bold: true, color: C.navy, size: 60 }),
    ] }),
    new Paragraph({ spacing: { after: 60 }, children: [
      new TextRun({ text: isOnline ? `Online Gaming Operations in ${stateName}` : `${typeLabel} Operations in ${stateName}`, font: SERIF, color: C.ink, size: 32 }),
    ] }),
    new Paragraph({ spacing: { after: 1400 }, children: [
      new TextRun({ text: `An estimate of the direct, indirect, and induced effects on output, gross state product, employment, labor income, and public revenue`, font: SERIF, italics: true, color: C.muted, size: 22 }),
    ] }),
  ];
  const meta = [
    ['Subject', project || `${typeLabel}, ${stateName}`],
    ['Jurisdiction', stateName],
    ['Operation type', typeLabel],
    ['Revenue analyzed', m$(totalRevenue)],
    ['Prepared by', `${authorInfo.name || 'Dr. Kahlil Simeon-Rose'}, ${authorInfo.institution || BRAND.publisher}`],
    ['Date', longDate],
  ];
  for (const [k, v] of meta) {
    titlePage.push(new Paragraph({ spacing: { after: 70 }, children: [
      new TextRun({ text: `${k}:  `, font: SANS, bold: true, color: C.muted, size: 19 }),
      new TextRun({ text: v, font: SANS, color: C.ink, size: 19 }),
    ] }));
  }
  titlePage.push(new Paragraph({ spacing: { before: 240 }, children: [
    new TextRun({ text: isSample ? 'SAMPLE REPORT — FOR EVALUATION ONLY · NOT FOR DISTRIBUTION' : 'CONFIDENTIAL — PREPARED FOR THE NAMED RECIPIENT', font: SANS, bold: true, color: isSample ? C.brass : C.muted, size: 16, characterSpacing: 30 }),
  ] }));
  titlePage.push(new Paragraph({ spacing: { before: 60 }, children: [
    new TextRun({ text: `Modeled with ${PRODUCT_NAME_VERSIONED} — ${BRAND.productFullName}`, font: SANS, color: C.accent, size: 16 }),
  ] }));

  // ---------------------------------------------------------------- CONTENTS
  // A static, hand-built contents list. This renders reliably in every viewer
  // (Word, Google Docs, LibreOffice) without depending on a field update, which
  // a dynamic TOC field would require on each recipient's machine.
  const tocEntries = [
    ['1', 'Executive Summary'], ['2', 'Introduction and Scope'],
    ['3', 'The Economic Role of Gaming Operations'], ['4', 'Analytical Framework'],
    ['5', 'Data and Methodology'], ['6', 'Results: Economic Impacts'],
    ['7', 'Results: Fiscal Impacts'], ['8', 'Discussion'],
    ['9', 'Limitations'], ['10', 'Conclusion'],
  ];
  const tocAppendix = [
    ['Appendix A', 'Technical Notes on Input-Output Modeling'],
    ['Appendix B', 'Glossary of Key Terms'],
    ['Appendix C', 'About the Author and GP Consulting'],
    ['Appendix D', 'Model Inputs and Parameters'],
    ['', 'References'],
  ];
  const tocLine = (num, title) => new Paragraph({
    spacing: { after: 140, line: 264 },
    tabStops: [{ type: TabStopType.LEFT, position: 900 }],
    children: [
      new TextRun({ text: num, font: SANS, bold: true, color: C.brass, size: 21 }),
      new TextRun({ text: '\t', font: SANS }),
      new TextRun({ text: title, font: SERIF, color: C.ink, size: 22 }),
    ],
  });
  const tocPage = [
    new Paragraph({ pageBreakBefore: true, spacing: { after: 260 }, border: { bottom: { color: C.brass, space: 8, style: BorderStyle.SINGLE, size: 18 } }, children: [
      new TextRun({ text: 'Contents', font: SERIF, bold: true, color: C.navy, size: 36 }),
    ] }),
    ...tocEntries.map(([num, title]) => tocLine(num, title)),
    new Paragraph({ spacing: { before: 200, after: 140 }, children: [new TextRun({ text: 'Appendices', font: SANS, bold: true, color: C.muted, size: 18, characterSpacing: 20 })] }),
    ...tocAppendix.map(([num, title]) => tocLine(num, title)),
  ];

  // ---------------------------------------------------------------- BODY
  const B = [];
  const sec = (...kids) => kids.forEach((k) => B.push(k));
  // Sequential exhibit/figure numbering, robust to which optional sections appear.
  let exN = 0, figN = 0;
  const ex = (title) => caption(`Exhibit ${++exN}.  ${title}`);
  const fig = (title) => caption(`Figure ${++figN}.  ${title}`);

  // ===== 1. EXECUTIVE SUMMARY
  sec(
    H1('1   Executive Summary', { brk: false }),
    lead(`This report estimates the economic footprint of ${op} on the economy of ${stateName}. Drawing on ${m$(totalRevenue)} of ${isOnline ? 'gross gaming revenue' : 'operating revenue'} and an input-output model of the ${stateName} economy, it quantifies how that activity propagates through the state — supporting production, value added, jobs, and household income well beyond the operation itself — and estimates the public revenue the activity generates.`),
    P(`Economic activity does not stop at the point of sale. When ${op} pays its employees, purchases goods and services from suppliers, and remits taxes, it sets in motion a chain of transactions that ripples across the wider economy. Suppliers expand to meet the operation's orders and, in turn, draw on their own suppliers; employees throughout this chain spend their wages on housing, food, healthcare, and retail, supporting still more businesses. Input-output analysis traces these linkages and expresses the full effect in a common set of economic measures.`),
    P(`The principal findings are summarized below and developed in detail in Sections 6 and 7.`),
    ex('Summary of estimated annual economic impacts'),
    dataTable(['Measure', 'Direct', 'Total', 'Multiplier'], [
      dataRow(['Economic output ($M)', n(t.output.direct), n(t.output.total), x(mlt.output)]),
      dataRow(['Value added / GSP ($M)', n(t.gdp.direct), n(t.gdp.total), x(mlt.gdp)]),
      dataRow(['Employment (FTE jobs)', j(t.employment.direct), j(t.employment.total), x(mlt.employment)]),
      dataRow(['Labor income ($M)', n(t.wages.direct), n(t.wages.total), x(mlt.wages)]),
      totalRow(['Public revenue ($M)', '—', n(totalTax), '—']),
    ], { colWidths: [4400, 1900, 1900, 1760] }),
    sourceLine(`${PRODUCT_NAME_VERSIONED} model estimates. Figures are annual and expressed in millions of dollars except employment (full-time-equivalent jobs).`),
    H2('Key findings'),
    bullet([r(`Total economic output of `, {}), r(`${m$(t.output.total)}`, { bold: true, color: C.ink }), r(`. For every dollar of output generated directly at ${op}, an additional ${formatNumber(mlt.output - 1, 2)} dollars of output is generated elsewhere in the ${stateName} economy, for a total output multiplier of ${formatNumber(mlt.output, 2)}.`)]),
    bullet([r(`A contribution of `, {}), r(`${m$(t.gdp.total)}`, { bold: true, color: C.ink }), r(` to gross state product (value added) — the most directly comparable measure to a state's GDP, representing the net new value created.`)]),
    bullet([r(`Support for `, {}), r(`${j(t.employment.total)} full-time-equivalent jobs`, { bold: true, color: C.ink }), r(`, of which ${j(t.employment.direct)} are at the operation itself and ${j(t.employment.indirect + t.employment.induced)} are sustained across suppliers and the broader community.`)]),
    bullet([r(`${m$(t.wages.total)} in labor income`, { bold: true, color: C.ink }), r(` — wages, salaries, and benefits earned by workers across all three layers of impact.`)]),
    bullet([r(`Approximately `, {}), r(`${m$(totalTax)} in annual public revenue`, { bold: true, color: C.ink }), r(`, combining gaming-specific taxes with production, payroll, and household taxes generated by the activity.`)]),
    fig('Composition of total economic output, by effect'),
    stackedBar(t.output),
    barLegend(),
    P([
      r(`These estimates are conservative by construction. They measure activity contained within ${stateName}, excluding spending that "leaks" to other states, and they report `, {}),
      r(`gross`, { italics: true }),
      r(` rather than `, {}),
      r(`net`, { italics: true }),
      r(` impacts — that is, they do not attempt to subtract activity that might have occurred elsewhere in the state absent the operation. Section 8 discusses how these choices should shape interpretation of the findings.`),
    ]),
  );

  // ===== 2. INTRODUCTION
  sec(
    H1('2   Introduction and Scope'),
    H2('2.1   Purpose of this analysis'),
    P(`The purpose of this report is to estimate the economic and fiscal contribution of ${op} to ${stateName} using a transparent, replicable, and well-established methodology. Economic impact analyses of this kind are routinely used by operators, regulators, legislators, and community stakeholders to understand the role a facility or industry plays in supporting local production, employment, and tax revenue, and to inform decisions about licensing, taxation, investment, and economic development.`),
    P(`Gaming operations occupy a distinctive position in regional economies. They are typically labor-intensive, draw on a wide network of in-state suppliers, and generate substantial dedicated tax revenue through gaming-specific levies in addition to the ordinary taxes paid by any business. At the same time, the size and composition of a gaming operation's economic footprint depend heavily on its type, scale, and location. This report is tailored to the characteristics of ${op} rather than relying on generic industry averages.`),
    H2('2.2   The subject operation'),
    P(`The analysis evaluates a ${typeLower} in ${stateName}${isOnline ? '' : ', modeled on the basis of its operating revenue and the economic structure of that property type'}. The operation is characterized by ${m$(totalRevenue)} in ${isOnline ? 'gross gaming revenue' : 'annual revenue'}, which forms the demand shock that the model propagates through the regional economy. ${results.hasUserData ? 'Where the operation supplied actual employment and wage figures, those values were used in place of the model defaults for the direct effects, improving the precision of the estimates.' : 'In the absence of operation-specific employment and wage data, direct effects were estimated using property-type-specific coefficients calibrated to operations of this kind.'}`),
    isOnline
      ? P(`Because the operation is an online gaming business, its economics differ markedly from those of a land-based casino. Online operators employ relatively few workers per dollar of revenue, concentrate employment in technology, marketing, and compliance functions, and rely on geographically dispersed supply chains. Crucially, the employment, supply-chain, and household effects estimated here accrue to the jurisdiction in which the operator's workforce is physically located, which may differ from the state in which wagers are placed. Gaming tax revenue, by contrast, generally accrues to the state of wager.`)
      : P(`As a ${typeLower}, the operation combines gaming with a characteristic mix of ancillary activities — which may include food and beverage, lodging, entertainment, and retail — each with its own labor intensity and supply-chain profile. The model accounts for this composition when estimating direct effects and the multipliers that follow.`),
    H2('2.3   Study area and geographic scope'),
    P(`The geographic scope of this analysis is the State of ${stateName}. All impacts are estimated at the state level using a state-specific input-output model. This boundary is significant: only economic activity that remains within ${stateName} is counted. Purchases the operation and its suppliers make from out-of-state vendors, and spending by workers that occurs outside the state, are treated as leakages and excluded. The result is a deliberately conservative estimate of the in-state economic contribution.`),
    H2('2.4   Organization of this report'),
    P(`Section 3 describes the economic role of gaming operations and why impact measurement matters. Section 4 sets out the analytical framework, including the input-output approach and the meaning of direct, indirect, and induced effects. Section 5 documents the data sources, industry classification, and key assumptions. Sections 6 and 7 present the economic and fiscal results in detail. Section 8 discusses interpretation, and Section 9 sets out the limitations of the analysis. Technical notes, a glossary, and references appear in the appendices.`),
  );

  // ===== 3. ECONOMIC ROLE OF GAMING
  sec(
    H1('3   The Economic Role of Gaming Operations'),
    H2('3.1   How gaming operations interact with the regional economy'),
    P(`A gaming operation participates in the regional economy through three principal channels. The first is its own production and employment: the operation hires workers, pays wages, and produces a service that is sold to consumers. The second is its demand for intermediate goods and services — everything from utilities, professional services, and maintenance to food, beverage, and gaming equipment — which sustains activity among its suppliers. The third is the consumption induced when the income earned by workers, both at the operation and throughout its supply chain, is spent on goods and services within the regional economy.`),
    P(`These channels correspond to the direct, indirect, and induced effects formalized in Section 4. Their relative size depends on how labor-intensive the operation is, how much of its purchasing it sources locally, and how much of the income it generates is spent within the state. A ${typeLower} of the kind analyzed here exhibits a distinctive balance among these channels, which the model captures through property-type-specific coefficients.`),
    P(`Gaming operations are also notable for the public revenue they generate. In addition to the production, payroll, and household taxes paid by any comparable business and its workforce, gaming is subject to dedicated taxes on gross gaming revenue. These gaming-specific levies are often a primary motivation for the legalization and regulation of the industry, and they are estimated separately in Section 7.`),
    H2('3.2   Why economic impact measurement matters'),
    P(`Quantifying these effects serves several practical purposes. For policymakers, a credible estimate of output, employment, and tax revenue informs decisions about licensing, tax rates, and the allocation of regulatory resources. For operators and investors, it clarifies the operation's contribution to the communities in which it operates and supports engagement with stakeholders. For the public, it provides an objective basis for weighing the economic benefits of gaming against its costs.`),
    P([
      r(`The value of such an analysis, however, depends entirely on the rigor of its method. Impact figures are frequently overstated when analysts apply inappropriate multipliers, blur the distinction between gross and net effects, or attribute to a single facility activity that would have occurred regardless. This report is built to avoid those pitfalls: it uses gambling-specific economic coefficients`, {}),
      fnref(3),
      r(`, reports gross impacts transparently while flagging the substitution and displacement questions that bear on net effects, and confines its estimates to the geographic area in which the activity actually occurs.`),
    ]),
    H2('3.3   The structure of gaming demand'),
    P(`The economic significance of a gaming operation depends not only on how much revenue it generates but on where that revenue comes from. Revenue derived from out-of-state visitors represents an injection of new money into the regional economy — economically equivalent to an export — and contributes most clearly to net economic growth. Revenue derived from in-state residents, by contrast, may partly redirect spending that would otherwise have occurred at other businesses within the same economy.`),
    P(`Operations that function as tourism destinations, drawing patrons from outside the state, therefore tend to have the largest net economic impact, because a greater share of their revenue is genuinely additional to the regional economy. Operations that serve primarily a local market generate substantial gross activity and tax revenue but a smaller net addition. ${isOnline ? 'For online operations, the geography of demand is further complicated by the separation between where wagers are placed and where the operator’s economic activity occurs.' : `The mix of visitor and resident demand at a ${typeLower} is an empirical matter specific to each operation and market.`} Because this report adopts a gross-impact framing, the figures should be read with the operation's demand structure in mind, a point developed further in Section 8.2.`),
  );

  // ===== 4. ANALYTICAL FRAMEWORK
  sec(
    H1('4   Analytical Framework'),
    H2('4.1   Input-output analysis'),
    P([
      r(`This analysis applies input-output (I-O) analysis, a method introduced by the economist Wassily Leontief, for which he was awarded the Nobel Memorial Prize in Economic Sciences in 1973.`, {}),
      fnref(1),
      r(` Input-output analysis represents an economy as a system of interlinked industries, in which the output of each industry serves as an input to others and to final demand. By describing these inter-industry relationships in a structured set of accounts, the framework makes it possible to trace how a change in demand for one industry's product propagates through the entire economy.`),
    ]),
    P(`The intuition is straightforward. Suppose the operation purchases food and beverage supplies from an in-state distributor. To fulfill that order, the distributor must itself buy from farmers, processors, and transportation providers, who in turn purchase from their own suppliers. Each of these businesses employs workers, and those workers spend their earnings in the local economy. Input-output analysis captures this entire cascade of transactions and expresses it in a consistent set of measures, allowing the total effect of the operation's activity to be estimated rather than just its first-round, direct contribution.`),
    H2('4.2   Direct, indirect, and induced effects'),
    P(`The total economic impact estimated in this report is the sum of three components, each representing a distinct round of economic activity.`),
    bullet([r('Direct effects', { bold: true, color: C.navy }), r(` are the activity of the operation itself: the output it produces, the workers it employs, the wages it pays, and the value it adds. These are the first-round, on-site effects.`)]),
    bullet([r('Indirect effects', { bold: true, color: C.navy }), r(` arise in the operation's supply chain. To deliver goods and services to the operation, suppliers expand production, hire workers, and make purchases from their own suppliers. The indirect effect is the sum of all these business-to-business transactions throughout the chain.`)]),
    bullet([r('Induced effects', { bold: true, color: C.navy }), r(` result from household spending. Workers employed directly by the operation and indirectly throughout its supply chain spend their income on housing, food, healthcare, retail, and other goods and services, supporting additional production and employment. The induced effect captures this consumption-driven activity.`)]),
    P(`Summing the three effects yields the total economic impact. The ratio of the total effect to the direct effect is the multiplier, discussed next.`),
    H2('4.3   Multipliers and the Leontief inverse'),
    P([
      r(`A multiplier expresses the total economic activity generated per unit of direct activity. Formally, multipliers are derived from the Leontief inverse of the input-output system, `, {}),
      r(`(I − A)⁻¹`, { italics: true, font: SERIF }),
      r(`, where `, {}),
      r(`A`, { italics: true }),
      r(` is the matrix of technical coefficients describing the inputs each industry requires from every other industry per unit of output.`),
      fnref(2),
      r(` The inverse captures not only the first round of supplier purchases but every subsequent round, converging to a finite total because some spending leaks out of the regional economy at each step.`),
    ]),
    P(`A distinction is drawn between Type I and Type II multipliers. Type I multipliers capture direct and indirect effects only — the operation and its supply chain. Type II multipliers additionally endogenize household spending, capturing the induced effect as well. This report uses Type II multipliers, which provide the more complete picture of an operation's total economic footprint and are standard in economic impact practice.`),
    P([
      r(`For ${op}, the estimated Type II output multiplier is ${formatNumber(mlt.output, 2)}, meaning that each dollar of direct output supports a total of ${formatNumber(mlt.output, 2)} dollars of output across the ${stateName} economy. The corresponding multipliers for value added, employment, and labor income are ${formatNumber(mlt.gdp, 2)}, ${formatNumber(mlt.employment, 2)}, and ${formatNumber(mlt.wages, 2)}, respectively. These values reflect the specific industry composition and supply-chain structure of a ${typeLower} operating in ${stateName}.`),
    ]),
    H2('4.4   Measures of economic impact'),
    P(`The analysis reports four complementary measures of economic activity, each answering a different question.`),
    bullet([r('Output', { bold: true, color: C.navy }), r(` is the total value of goods and services produced — gross sales or revenue across all affected industries. It is the broadest measure but double-counts intermediate transactions, so it is best understood as a measure of gross economic activity rather than net wealth creation.`)]),
    bullet([r('Value added (gross state product)', { bold: true, color: C.navy }), r(` is output net of the cost of intermediate inputs — the net new value created by the activity. Because it avoids double-counting, value added is the measure most directly comparable to a state's gross domestic product and is generally the preferred headline indicator of economic contribution.`)]),
    bullet([r('Employment', { bold: true, color: C.navy }), r(` is measured in full-time-equivalent (FTE) jobs supported by the activity, spanning the operation, its supply chain, and the broader economy.`)]),
    bullet([r('Labor income', { bold: true, color: C.navy }), r(` comprises the wages, salaries, and benefits earned by those workers — the share of value added that flows to households as compensation.`)]),
    H2('4.5   A worked illustration'),
    P(`The mechanics of the multiplier can be made concrete using this operation's own figures. The analysis begins with ${m$(t.output.direct)} of direct output at ${op}. To produce that output, the operation purchases goods and services from its suppliers; those suppliers expand production and purchase from their own suppliers, generating a first round of indirect activity. Across all such rounds, the supply chain contributes a further ${m$(t.output.indirect)} of output.`),
    P(`Meanwhile, the workers employed by the operation and throughout its supply chain receive income, a portion of which they spend within ${stateName} on housing, food, and other goods and services. This household spending supports an additional ${m$(t.output.induced)} of induced output. Summing the three rounds yields total output of ${m$(t.output.total)} — the ${formatNumber(mlt.output, 2)} multiplier in concrete terms. Each successive round is smaller than the last, because at every step a fraction of spending leaks out of the state economy through imports, savings, and taxes; this is why the series converges to a finite total rather than expanding without limit.`),
  );

  // ===== 5. DATA AND METHODOLOGY
  sec(
    H1('5   Data and Methodology'),
    P(`The credibility of an input-output analysis rests on the quality and appropriateness of the underlying data. This section documents the sources, the industry classification used to isolate gaming activity, the treatment of revenue inputs, the estimation of fiscal impacts, and the key assumptions that govern the results.`),
    H2('5.1   Data sources'),
    P(`The model is built entirely on official, publicly documented federal data, which supports transparency and replicability:`),
    bullet([rs('State input-output multipliers. ', { bold: true, color: C.navy, font: SERIF }), r(`Regional multipliers are derived from the U.S. Environmental Protection Agency's state input-output models (the stateior dataset), which provide state-specific accounts of inter-industry relationships.`), fnref(5)]),
    bullet([rs('Employment and wages. ', { bold: true, color: C.navy, font: SERIF }), r(`Industry-level employment and wage data are drawn from the U.S. Bureau of Labor Statistics Quarterly Census of Employment and Wages (QCEW), which provides a near-complete census of covered employment by state and industry.`)]),
    bullet([rs('Detailed industry accounts. ', { bold: true, color: C.navy, font: SERIF }), r(`The U.S. Bureau of Economic Analysis detail-level input-output accounts are used to isolate gambling-specific production and consumption patterns from the broader sectors in which they are otherwise embedded.`)]),
    bullet([rs('Price adjustments. ', { bold: true, color: C.navy, font: SERIF }), r(`The Consumer Price Index is used to express monetary values in a consistent dollar year.`)]),
    H2('5.2   Industry classification and gambling-specific coefficients'),
    P([
      r(`A common weakness of off-the-shelf impact studies is the use of multipliers for a broad sector that only partially reflects gaming. Standard tools frequently rely on the blended NAICS 713 ("Amusement, Gambling, and Recreation Industries") sector, which combines casinos with amusement parks, fitness centers, golf courses, and a wide range of other activities whose economic structure differs substantially from that of gaming.`, {}),
      fnref(3),
    ]),
    P(`This analysis instead isolates gambling-specific coefficients (NAICS 7132, Gambling Industries) from the detailed national accounts, so that the labor intensity, wage structure, and supply-chain linkages used in the model reflect gaming operations specifically rather than a recreation-sector average. ${isOnline ? 'For online operations, dedicated online-gambling coefficients are applied, estimated from the financial disclosures of publicly traded online operators, to reflect the sector’s distinctive technology-intensive cost structure.' : `Within the land-based category, the model further distinguishes among property types, applying coefficients appropriate to a ${typeLower} rather than a single casino-industry average.`}`),
    H2(isOnline ? '5.3   Modeling online gaming operations' : '5.3   Property-type-specific modeling'),
    isOnline
      ? P(`Online gaming operations differ from land-based casinos in ways that materially affect their economic footprint. They employ on the order of one worker per million dollars of revenue, compared with roughly five for a typical land-based casino, and their workforces are concentrated in higher-paid technology, product, marketing, and compliance roles. Their supply chains are also more geographically dispersed and less locally embedded. The model reflects these features through online-specific coefficients. A particularly important implication is geographic: the direct, indirect, and induced effects estimated here accrue to the state in which the operator's workforce is located. Where an operator is headquartered outside ${stateName}, most of the economic impact other than gaming-tax revenue would accrue to that other state. For this reason, online estimates are most accurate when operation-specific in-state employment and wage data are supplied.`)
      : P(`Different gaming establishments have markedly different economic profiles. An integrated resort with hotel and casino is far more labor-intensive and draws on a broader supply chain than a slot parlor or a bar with gaming machines. Applying a single industry-average multiplier across these property types would misstate the impact of any individual operation. The model therefore selects coefficients calibrated to a ${typeLower}, so that the estimated employment intensity, wage rates, and inter-industry linkages match the operation actually being analyzed.`),
    H2('5.4   Revenue inputs and the demand shock'),
    P(`The analysis takes ${m$(totalRevenue)} of ${isOnline ? 'gross gaming revenue' : 'operating revenue'} as the final-demand shock applied to the input-output system. ${inputMode === 'total' ? 'Revenue is modeled in aggregate.' : 'Where revenue is resolved into its component streams, each stream is mapped to the appropriate production structure so that the composition of the operation’s activity is reflected in the direct effects.'} ${results.hasUserData ? 'Operation-supplied employment and wage figures were incorporated for the direct effects, anchoring the first round of the analysis in observed data.' : 'Direct employment and wages were estimated from property-type-specific coefficients applied to the revenue input.'} The model then computes indirect and induced effects via the Type II multipliers described in Section 4.`),
    H2('5.5   Estimating fiscal impacts'),
    P(`Public revenue is estimated from four distinct sources, reflecting the different ways gaming activity generates tax. Each is described in Section 7 and summarized here:`),
    bullet([r('Gaming taxes', { bold: true, color: C.navy }), r(` levied on gross gaming revenue at the rate set by ${stateName} statute or compact;`)]),
    bullet([r('Taxes on production and imports (TOPI)', { bold: true, color: C.navy }), r(` — sales, excise, and property taxes and business fees arising across the supply chain, estimated within the input-output model;`)]),
    bullet([r('Payroll taxes', { bold: true, color: C.navy }), r(` — employer-side social-insurance contributions applied to labor income by effect type;`)]),
    bullet([r('Household taxes', { bold: true, color: C.navy }), r(` — income and related personal taxes paid by workers, estimated from published effective-tax ratios.`)]),
    H2('5.6   Key assumptions'),
    P(`The analysis rests on the standard assumptions of input-output modeling, which the reader should bear in mind when interpreting the results:`),
    numItem(`Fixed production technology. The proportions in which each industry combines its inputs are taken as fixed, so the analysis does not model substitution among inputs in response to price changes.`, 'assumptions'),
    numItem(`Constant returns to scale. A given change in final demand is assumed to produce a proportional change in output, with no economies or diseconomies of scale.`, 'assumptions'),
    numItem(`Available capacity. The model assumes the economy has the spare labor and productive capacity to accommodate the modeled activity; in a fully employed economy, realized impacts may be smaller.`, 'assumptions'),
    numItem(`Gross measurement. Results measure gross activity associated with the operation and do not net out activity that might otherwise have occurred in the state (see Section 8.2).`, 'assumptions'),
    H2('5.7   Regional purchase coefficients and leakage'),
    P(`A central determinant of the multipliers is the share of each industry's inputs that is purchased from within ${stateName} rather than imported from other states. These regional purchase coefficients are embedded in the state-specific input-output accounts used here. The higher the share of in-state purchasing, the larger the indirect and induced effects, because more of each round of spending is retained within the state economy. States with deep, diversified industrial bases tend to exhibit larger multipliers than states that must import a greater share of intermediate goods.`),
    P(`Leakage is the counterpart of this retention: the portion of each spending round that exits the regional economy through imports, household savings, and taxes paid to other jurisdictions. Leakage is the reason the multiplier process converges and the reason a state-level analysis yields more conservative estimates than a national one — at the national scale, purchases from "other states" remain within the economy being measured, whereas here they are excluded. The conservative, in-state framing adopted throughout this report reflects a deliberate choice to count only activity that demonstrably remains within ${stateName}.`),
  );

  // ===== 6. ECONOMIC RESULTS
  sec(
    H1('6   Results: Economic Impacts'),
    H2('6.1   Summary of total impacts'),
    P(`Applying the framework and data described above, the model estimates that ${op} supports total annual economic activity of ${m$(t.output.total)} in output, ${m$(t.gdp.total)} in value added, ${j(t.employment.total)} full-time-equivalent jobs, and ${m$(t.wages.total)} in labor income within ${stateName}. Exhibit 2 sets out the full decomposition of each measure into its direct, indirect, and induced components, together with the implied Type II multiplier.`),
    ex('Estimated annual economic impacts by measure and effect'),
    dataTable(['Measure', 'Direct', 'Indirect', 'Induced', 'Total', 'Mult.'], [
      dataRow(['Output ($M)', n(t.output.direct), n(t.output.indirect), n(t.output.induced), n(t.output.total), x(mlt.output)]),
      dataRow(['Value added / GSP ($M)', n(t.gdp.direct), n(t.gdp.indirect), n(t.gdp.induced), n(t.gdp.total), x(mlt.gdp)]),
      dataRow(['Employment (FTE)', j(t.employment.direct), j(t.employment.indirect), j(t.employment.induced), j(t.employment.total), x(mlt.employment)]),
      dataRow(['Labor income ($M)', n(t.wages.direct), n(t.wages.indirect), n(t.wages.induced), n(t.wages.total), x(mlt.wages)]),
    ], { colWidths: [3400, 1500, 1500, 1500, 1500, 1060] }),
    sourceLine(`${PRODUCT_NAME_VERSIONED} model estimates for ${stateName}.`),
    H2('6.2   Economic output'),
    P(`Total output — the gross value of goods and services produced across all affected industries — is estimated at ${m$(t.output.total)}. Of this, ${m$(t.output.direct)} (${pct(t.output.direct, t.output.total)}) is produced directly by the operation, ${m$(t.output.indirect)} (${pct(t.output.indirect, t.output.total)}) by its supply chain, and ${m$(t.output.induced)} (${pct(t.output.induced, t.output.total)}) through household spending. The implied output multiplier of ${formatNumber(mlt.output, 2)} indicates that each dollar of direct output is associated with ${m$(indOut)} of additional output elsewhere in the ${stateName} economy. Output is the broadest of the four measures and is best read as an indicator of gross transactional activity rather than net wealth creation, for which value added is the appropriate measure.`),
    H2('6.3   Value added (gross state product)'),
    P(`Value added — output net of the cost of intermediate inputs — is estimated at ${m$(t.gdp.total)}, comprising ${m$(t.gdp.direct)} directly, ${m$(t.gdp.indirect)} indirectly, and ${m$(t.gdp.induced)} through induced effects. Because it avoids the double-counting inherent in output, value added is the measure most directly comparable to ${stateName}'s gross domestic product and is the preferred headline indicator of the operation's net economic contribution. The value-added multiplier of ${formatNumber(mlt.gdp, 2)} reflects the share of each round of activity that represents genuine new value rather than the pass-through of intermediate purchases.`),
    H2('6.4   Employment'),
    P(`The activity is estimated to support ${j(t.employment.total)} full-time-equivalent jobs across ${stateName}. Of these, ${j(t.employment.direct)} are at the operation itself, ${j(t.employment.indirect)} are sustained among suppliers, and ${j(t.employment.induced)} arise in the broader economy as workers spend their earnings. The employment multiplier of ${formatNumber(mlt.employment, 2)} means that every job at the operation is associated with ${formatNumber(mlt.employment - 1, 2)} additional jobs elsewhere in the state. Employment is reported on a full-time-equivalent basis; the corresponding headcount, which includes part-time and seasonal positions, would be higher.`),
    fig('Employment supported, by effect'),
    stackedBar(t.employment),
    barLegend(),
    H2('6.5   Labor income'),
    P(`Labor income — wages, salaries, and benefits — is estimated at ${m$(t.wages.total)}, of which ${m$(t.wages.direct)} is paid directly by the operation and ${m$(t.wages.indirect + t.wages.induced)} is earned across the supply chain and the broader economy. Labor income represents the portion of value added that flows to households as compensation and is a key channel through which the operation's activity supports living standards in ${stateName}. It is also the basis for the payroll and household tax estimates presented in Section 7.`),
    H2('6.6   Composition and quality of employment'),
    P(`The employment supported by the operation can be characterized not only by its number but by its quality and distribution. Across all effects, the activity supports an average labor income of approximately ${usd0(compPerFteTotal)} per full-time-equivalent job, with directly employed workers earning on average ${usd0(compPerFteDirect)}. Each direct job is associated with roughly ${usd0(outputPerFteDirect)} of direct output, a measure of the operation's labor productivity.`),
    P(`The ${j(t.employment.direct)} direct positions span the range of occupations characteristic of a ${typeLower}${isOnline ? ', concentrated in technology, product, marketing, and compliance roles' : ', from gaming and hospitality staff to management and administrative functions'}. Beyond the operation, ${j(rippleJobs)} further jobs are sustained across the supply chain and the broader economy — positions in distribution, professional services, retail, and the many local businesses that benefit when supported workers spend their earnings. This breadth is a defining feature of the operation's employment footprint: its labor-market significance extends well beyond its own payroll.`),
    H2('6.7   The multiplier effect in context'),
    P(`The multipliers estimated here are characteristic of a ${typeLower} and should be understood as properties of the ${stateName} economy as much as of the operation. A larger multiplier indicates that more of each round of spending is retained within the state rather than leaking to imports. ${isOnline ? 'Online operations typically exhibit smaller employment multipliers than land-based casinos, reflecting their leaner staffing and more dispersed supply chains.' : 'Integrated resort operations typically exhibit larger multipliers than limited gaming venues, reflecting their broader supply chains and higher local purchasing.'} The values reported here fall within the range expected for operations of this type and are consistent with the conservative, in-state framing of the analysis.`),
  );
  if (byRevenue.length > 1) {
    sec(
      H2('6.8   Impacts by revenue stream'),
      P(`Where the operation's revenue is resolved into distinct streams, the contribution of each can be examined separately. The exhibit below reports the total economic impact attributable to each revenue stream, reflecting the different labor intensities and supply-chain structures of gaming and ancillary activities.`),
      ex('Total economic impact by revenue stream'),
      dataTable(['Revenue stream', 'Revenue ($M)', 'Output ($M)', 'GSP ($M)', 'Jobs (FTE)', 'Income ($M)'],
        byRevenue.map((b) => dataRow([b.label, n(b.revenue), n(b.output.total), n(b.gdp.total), j(b.employment.total), n(b.wages.total)])),
        { colWidths: [3000, 1620, 1620, 1500, 1500, 1620] }),
      sourceLine(`${PRODUCT_NAME_VERSIONED} model estimates. Totals include direct, indirect, and induced effects.`),
    );
  }

  // ===== 7. FISCAL RESULTS
  sec(
    H1('7   Results: Fiscal Impacts'),
    P(`Beyond its effects on output and employment, ${op} generates public revenue through several channels. This section estimates each in turn and presents the combined fiscal contribution. Total public revenue associated with the activity is estimated at approximately ${m$(totalTax)} per year.`),
  );
  if (gaming) {
    sec(
      H2('7.1   Gaming taxes'),
      P(`Gaming is subject to a dedicated tax on gross gaming revenue, distinct from the ordinary taxes paid by other businesses. Applying the ${stateName} gaming tax schedule${gaming.effectiveRate ? `, which implies an effective rate of approximately ${formatNumber(gaming.effectiveRate * 100, 1)}% on this operation's gaming revenue` : ''}, the operation is estimated to remit ${m$(gaming.amount)} in gaming taxes annually. These revenues typically accrue directly to the state and, in many jurisdictions, are earmarked for specific public purposes such as education, problem-gambling services, or local government.`),
    );
  }
  sec(
    H2('7.2   Taxes on production and imports'),
    P(`Taxes on production and imports (TOPI) comprise sales taxes, excise taxes, property taxes, and assorted business fees levied across the operation and its supply chain. Estimated within the input-output model, these taxes amount to ${m$(t.tax.total)}, of which ${m$(t.tax.direct)} arises directly and ${m$(t.tax.indirect + t.tax.induced)} across the supply chain and induced activity.`),
    H2('7.3   Payroll taxes'),
    P(payroll && payroll.total > 0
      ? `Employer-side payroll taxes — covering social-insurance programs such as Social Security, Medicare, and unemployment insurance — are estimated at ${m$(payroll.total)} across all effect types, calculated by applying prevailing employer contribution rates to the labor income generated by the activity.`
      : `Employer-side payroll taxes are levied on the labor income generated by the activity; where applicable they are included in the combined fiscal total below.`),
    H2('7.4   Household taxes'),
    P(household && household.total > 0
      ? `Household taxes — federal, state, and local income taxes and related personal taxes paid by the workers supported by the activity — are estimated at ${m$(household.total)}, based on published effective personal-tax ratios applied to labor income by effect type.`
      : `Household taxes paid by supported workers are estimated from effective personal-tax ratios; where applicable they are included in the combined total below.`),
    H2('7.5   Total fiscal impact'),
    P(`The exhibit below combines these sources into a single estimate of the public revenue generated by ${op}.`),
    ex('Estimated annual public revenue by source'),
    buildTaxTable(results, inputs),
    sourceLine(`${PRODUCT_NAME_VERSIONED} model estimates. Gaming tax reflects the ${stateName} statutory schedule; other taxes are estimated from federal effective-rate data.`),
  );
  if (inputs.stateTaxConfig?.localTaxNotes) {
    sec(P([r('Local tax note.  ', { bold: true, color: C.navy }), r(inputs.stateTaxConfig.localTaxNotes, { italics: true })]));
  }

  // ===== 8. DISCUSSION
  sec(
    H1('8   Discussion'),
    H2('8.1   Interpreting the findings'),
    P(`The results indicate that ${op} is associated with a substantial and broad-based economic contribution to ${stateName}, extending well beyond the operation's own payroll and output. The value-added estimate of ${m$(t.gdp.total)} and the support of ${j(t.employment.total)} jobs are the figures most useful for comparison with other economic activities and with the state economy as a whole. The multipliers indicate that a meaningful share of this activity is retained within the state, reflecting in-state supply relationships and local household spending.`),
    H2('8.2   Gross versus net impacts: substitution and displacement'),
    P([
      r(`An important interpretive caution concerns the distinction between gross and net impacts. The figures in this report are `, {}),
      r(`gross`, { italics: true }),
      r(` estimates: they measure the activity associated with the operation without subtracting activity that might have occurred elsewhere in ${stateName} in its absence. To the extent that residents' spending at the operation substitutes for spending they would otherwise have made at other in-state businesses, a portion of the gross impact represents a redistribution of activity rather than a net addition to the state economy.`),
    ]),
    P([
      r(`The size of this substitution effect depends on how much of the operation's revenue derives from in-state residents as opposed to out-of-state visitors, and on whether gaming expenditure complements or displaces other local spending. Where an operation draws materially on tourism and export demand — capturing spending that would otherwise occur outside the state — its net impact approaches its gross impact. The evidence on complementary versus substitutive demand in gaming markets is mixed and context-specific`, {}),
      fnref(4),
      r(`, and a full net-impact assessment would require data on visitor origin and cross-spending patterns beyond the scope of this report.`),
    ]),
    H2('8.3   Catalytic and broader economic effects'),
    P([
      r(`This analysis quantifies the direct, indirect, and induced effects of the operation's ongoing activity. It does not attempt to quantify `, {}),
      r(`catalytic`, { italics: true }),
      r(` effects — the longer-term, dynamic consequences a major operation can have for a region, such as attracting complementary investment, supporting tourism infrastructure, or contributing to destination development.`),
      fnref(6),
      r(` Such effects can be economically significant but are inherently more speculative and are conventionally excluded from input-output impact estimates. Their omission reinforces the conservative character of the figures presented here.`),
    ]),
    H2('8.4   Sensitivity and uncertainty'),
    P(`As model-based estimates, the figures carry uncertainty from several sources: the revenue input, the property-type coefficients, and the regional multipliers. Because the results scale broadly in proportion to the revenue input, a reader can gauge sensitivity by considering proportionate changes — a ten-percent change in revenue translates, to a first approximation, into a similar proportionate change in the output, value-added, employment, and income estimates. The direction and structure of the results are robust; the precise magnitudes should be read as central estimates rather than exact figures.`),
    H2('8.5   Why input-output analysis'),
    P(`Input-output analysis is the standard method for estimating the economic impact of a facility or industry, and it is well suited to the question this report addresses: how does a given level of operating activity propagate through a regional economy? Its principal strengths are transparency and replicability. The framework is grounded in published national and regional accounts, its assumptions are explicit, and its results can be reproduced by any analyst working from the same data.`),
    P(`Alternative methods exist and answer somewhat different questions. Computable general equilibrium models incorporate price adjustment and resource constraints and are better suited to large structural changes, but they require additional assumptions and are less transparent. Simple ratio or "rule-of-thumb" approaches are easier still but lack the inter-industry detail that gives input-output estimates their credibility. For an analysis of a single operation at its current scale, the input-output approach offers the most appropriate balance of rigor, transparency, and interpretability — provided, as emphasized in Section 5, that it is implemented with gaming-specific rather than generic recreation-sector coefficients.`),
    H2('8.6   Distribution of the benefits'),
    P(`The economic benefits estimated here are not confined to the operation or its immediate vicinity. By construction, a substantial share accrues across the supply chain and the broader economy: of the ${m$(t.output.total)} in total output, ${m$(indOut)} is generated beyond the operation itself, and of the ${j(t.employment.total)} jobs supported, ${j(rippleJobs)} are sustained elsewhere in ${stateName}. The fiscal benefits are similarly distributed across levels of government, with gaming taxes accruing chiefly to the state${gaming ? ` (an estimated ${m$(gaming.amount)}, or roughly ${Math.round(gamingShare * 100)}% of the total public revenue identified)` : ''} and production, payroll, and household taxes flowing to federal, state, and local authorities. This breadth is among the most policy-relevant features of the analysis: the activity's value is shared widely across industries, workers, and public budgets.`),
  );

  // ===== 9. LIMITATIONS
  sec(
    H1('9   Limitations'),
    P(`The following limitations qualify the estimates in this report and should be considered alongside the findings:`),
    numItem(`Input-output models are linear and static. They assume fixed production technology and constant returns to scale, and they do not capture price responses, capacity constraints, or dynamic adjustment over time.`, 'limitations'),
    numItem(`The results are gross rather than net. They do not subtract substitution or displacement of activity that might otherwise have occurred within the state (Section 8.2).`, 'limitations'),
    numItem(`The estimates are confined to the State of ${stateName}. Activity that leaks to other states is excluded, which is conservative for the in-state estimate but means the figures are not a measure of national impact.`, 'limitations'),
    numItem(`Catalytic and other long-term dynamic effects are not quantified (Section 8.3).`, 'limitations'),
    numItem(`Results depend on the accuracy of the revenue input and, where applicable, operation-supplied data. ${results.hasUserData ? 'Operation-specific employment and wage figures were used for the direct effects where provided.' : 'In the absence of operation-specific data, direct effects rely on property-type coefficients and may differ from the operation’s actual staffing.'}`, 'limitations'),
    P([r('Not professional advice.  ', { bold: true, color: C.navy }), r(`This report is provided for informational purposes only and does not constitute investment, legal, tax, or other professional advice. While prepared with reasonable care, no warranty is made as to the completeness or reliability of the estimates, and the authors accept no liability for decisions taken in reliance on them.`)]),
  );

  // ===== 10. CONCLUSION
  sec(
    H1('10   Conclusion', { brk: false }),
    P(`This report has estimated the economic and fiscal contribution of ${op} to ${stateName} using a transparent input-output framework built on official federal data and gambling-specific economic coefficients. The operation is estimated to support ${m$(t.output.total)} in total output, ${m$(t.gdp.total)} in value added, ${j(t.employment.total)} full-time-equivalent jobs, and ${m$(t.wages.total)} in labor income annually, while generating approximately ${m$(totalTax)} in public revenue.`),
    P(`These findings reflect deliberately conservative methodological choices — in-state geographic scope, gross-to-net cautions, and the exclusion of catalytic effects — and should be read as central estimates of the operation's contained, ongoing economic footprint. They provide a sound, replicable basis for understanding the role of ${op} in the ${stateName} economy and for informing the decisions of operators, regulators, and other stakeholders.`),
  );

  // ===== APPENDICES
  sec(
    appendixH1('Appendix A   Technical Notes on Input-Output Modeling', { brk: true }),
    P([
      r(`The input-output system represents the economy as a set of `, {}),
      r('n', { italics: true }),
      r(` industries. Let `, {}),
      r('x', { italics: true }),
      r(` denote the vector of industry outputs, `, {}),
      r('f', { italics: true }),
      r(` the vector of final demands, and `, {}),
      r('A', { italics: true }),
      r(` the matrix of technical coefficients, where each element `, {}),
      r('a', { italics: true }),
      new TextRun({ text: 'ij', font: SERIF, size: 21, color: C.body, subScript: true }),
      r(` gives the value of input from industry `, {}),
      r('i', { italics: true }),
      r(` required per dollar of output of industry `, {}),
      r('j', { italics: true }),
      r('. The accounting identity ', {}),
      r('x = Ax + f', { italics: true }),
      r(' solves to ', {}),
      r('x = (I − A)⁻¹ f', { italics: true }),
      r(', where ', {}),
      r('(I − A)⁻¹', { italics: true }),
      r(` is the Leontief inverse, or total-requirements matrix. Each column of the inverse gives the total output of every industry required, directly and indirectly, to deliver one dollar of final demand for a given industry's product.`),
    ]),
    P(`Type II multipliers are obtained by augmenting the system to treat households as an additional industry that "produces" labor and "consumes" goods and services, thereby endogenizing the induced effect. Employment and labor-income multipliers are constructed by scaling the output requirements by industry-specific ratios of employment and compensation to output. The convergence of the inverse — and hence the finiteness of the multipliers — follows from the fact that a portion of each round of spending leaks out of the regional economy through imports, savings, and taxes.`),
    P(`In this analysis the technical coefficients and total-requirements matrices are state-specific, so that the multipliers reflect the industrial structure and import propensities of ${stateName} rather than a national average. Gambling-specific rows and columns are isolated from the detailed national accounts to ensure the coefficients represent gaming activity rather than the broader recreation sector.`),
  );
  sec(
    appendixH1('Appendix B   Glossary of Key Terms'),
    ...glossary().map(([term, def]) => P([r(`${term}.  `, { bold: true, color: C.navy }), r(def)])),
  );
  sec(
    appendixH1('Appendix C   About the Author and GP Consulting'),
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: authorInfo.name || 'Dr. Kahlil Simeon-Rose', font: SERIF, bold: true, size: 25, color: C.navy })] }),
    new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: `${authorInfo.title || 'Principal Consultant'} · ${authorInfo.institution || BRAND.publisher}`, font: SANS, color: C.brass, bold: true, size: 19 })] }),
    ...(authorInfo.bio || '').split('\n').map((s) => s.trim()).filter(Boolean).map((para) => P(para)),
    spacer(80),
    P([r(`${BRAND.publisher} provides gaming policy research and economic analysis for operators, regulators, and government. For inquiries about customized economic impact analysis, contact ${authorInfo.email || BRAND.email}.`, { color: C.muted })]),
  );
  sec(
    appendixH1('Appendix D   Model Inputs and Parameters'),
    P(`The table below records the principal inputs and estimated parameters underlying this analysis, provided so that the results can be reviewed and, if required, reproduced.`),
    ex('Summary of inputs and estimated multipliers'),
    dataTable(['Parameter', 'Value'], [
      dataRow(['Jurisdiction', stateName]),
      dataRow(['Operation type', typeLabel]),
      dataRow(['Revenue analyzed', m$(totalRevenue)]),
      dataRow(['Direct-effect basis', results.hasUserData ? 'Operation-supplied employment/wages' : 'Property-type coefficients']),
      dataRow(['Output multiplier (Type II)', x(mlt.output)]),
      dataRow(['Value-added multiplier (Type II)', x(mlt.gdp)]),
      dataRow(['Employment multiplier (Type II)', x(mlt.employment)]),
      dataRow(['Labor-income multiplier (Type II)', x(mlt.wages)]),
      dataRow(['Avg. labor income per FTE (total)', usd0(compPerFteTotal)]),
      ...(gaming ? [dataRow(['Effective gaming-tax rate', gaming.effectiveRate ? `${formatNumber(gaming.effectiveRate * 100, 1)}%` : '—'])] : []),
      dataRow(['Geographic scope', `State of ${stateName} (in-state activity only)`]),
      dataRow(['Model', `${PRODUCT_NAME_VERSIONED} — ${BRAND.productFullName}`]),
    ], { colWidths: [5200, 4760] }),
    sourceLine(`${PRODUCT_NAME_VERSIONED}. Multipliers are weighted across the operation's revenue composition.`),
    appendixH1('References'),
    ...references().map((ref) => new Paragraph({ spacing: { after: 120, line: 264 }, indent: { left: 360, hanging: 360 },
      children: [new TextRun({ text: ref, font: SERIF, size: 19, color: C.body })] })),
    spacer(120),
    P([r('Suggested citation for this report.  ', { bold: true, color: C.navy }), r(getSuggestedCitation(), { italics: true, color: C.muted, size: 19 })]),
  );

  // ---------------------------------------------------------------- DOC FURNITURE
  const header = new Header({ children: [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    border: { bottom: { color: C.hairline, space: 6, style: BorderStyle.SINGLE, size: 4 } },
    children: [
      new TextRun({ text: 'Economic Impact Analysis', font: SANS, bold: true, size: 15, color: C.navy }),
      new TextRun({ text: '\t', font: SANS }),
      new TextRun({ text: project ? `${project} · ${stateName}` : stateName, font: SANS, size: 15, color: C.muted }),
    ],
  })] });
  const footer = new Footer({ children: [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    border: { top: { color: C.hairline, space: 6, style: BorderStyle.SINGLE, size: 4 } },
    children: [
      new TextRun({ text: `${PRODUCT_NAME_VERSIONED}  ·  ${licenseLine}`, font: SANS, size: 14, color: C.muted }),
      new TextRun({ text: '\t', font: SANS }),
      new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: SANS, size: 14, color: C.muted }),
    ],
  })] });
  const blankFooter = new Footer({ children: [new Paragraph('')] });

  const doc = new Document({
    creator: authorInfo.name || BRAND.publisher,
    title: `Economic Impact Analysis — ${stateName}`,
    subject: `Casino Gaming Economic Impact (${PRODUCT_NAME_VERSIONED})`,
    description: getSuggestedCitation(),
    styles: { default: { document: { run: { font: SERIF, size: 21, color: C.body } } } },
    numbering: {
      config: ['assumptions', 'limitations'].map((ref) => ({
        reference: ref,
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 460, hanging: 320 } } } }],
      })),
    },
    footnotes: buildFootnotes(stateName),
    sections: [
      // Title page — no header, no page number
      { properties: { page: { margin: { top: 1300, bottom: 1100, left: 1180, right: 1180 } } },
        footers: { default: blankFooter }, children: titlePage },
      // Contents
      { properties: { page: { margin: { top: 1300, bottom: 1200, left: 1180, right: 1180 } } },
        footers: { default: blankFooter }, children: tocPage },
      // Body
      { properties: { page: { margin: { top: 1400, bottom: 1300, left: 1180, right: 1180 } } },
        headers: { default: header }, footers: { default: footer }, children: B },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${isSample ? 'SAMPLE_' : ''}${BRAND.productName}_${BRAND.modelVersion}_Economic_Impact_Report_${stateName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`;
  return { blob, filename };
}

// ---- supporting content ---------------------------------------------------
function buildFootnotes(stateName) {
  const mk = (txt) => ({ children: [new Paragraph({ children: [new TextRun({ text: txt, font: 'Georgia', size: 17, color: '252C36' })] })] });
  return {
    1: mk('Leontief, W. (1936). Quantitative input and output relations in the economic system of the United States. The Review of Economics and Statistics, 18(3), 105–125. Leontief was awarded the Nobel Memorial Prize in Economic Sciences in 1973.'),
    2: mk('Miller, R. E., & Blair, P. D. (2009). Input-Output Analysis: Foundations and Extensions (2nd ed.). Cambridge University Press.'),
    3: mk('Off-the-shelf models often rely on the blended NAICS 713 sector, which combines gambling with a wide range of unrelated amusement and recreation activities. This analysis isolates gambling-specific coefficients (NAICS 7132) from the BEA detailed input-output accounts.'),
    4: mk('The extent to which gaming expenditure substitutes for, or complements, other local consumption is an empirical question that varies by market; see the literature on complementary versus substitutive demand in gaming economies.'),
    5: mk('U.S. Environmental Protection Agency, state input-output models (stateior); see Ingwersen, W. W., et al., stateior: An R package for state input-output models. Employment and wage data from the U.S. Bureau of Labor Statistics, Quarterly Census of Employment and Wages.'),
    6: mk('Catalytic effects describe the broader, longer-term economic consequences of a major facility — such as induced investment and tourism development — that fall outside the scope of conventional input-output impact estimates.'),
  };
}

function glossary() {
  return [
    ['Direct effect', 'The economic activity of the subject operation itself — its output, employment, value added, and labor income.'],
    ['Indirect effect', 'Activity generated in the supply chain as suppliers produce the goods and services the operation purchases.'],
    ['Induced effect', 'Activity generated when workers across the operation and its supply chain spend their income in the regional economy.'],
    ['Output', 'The gross value of goods and services produced; a measure of total transactional activity that includes intermediate purchases.'],
    ['Value added (GSP)', 'Output net of intermediate inputs — the net new value created, comparable to gross domestic product.'],
    ['Employment (FTE)', 'Jobs expressed on a full-time-equivalent basis, converting part-time and seasonal positions to their full-time equivalents.'],
    ['Labor income', 'Wages, salaries, and benefits earned by workers; the share of value added flowing to households as compensation.'],
    ['Multiplier', 'The ratio of total to direct effect; the total economic activity supported per unit of direct activity.'],
    ['Type I / Type II multiplier', 'Type I captures direct and indirect effects; Type II additionally captures induced (household-spending) effects.'],
    ['Leontief inverse', 'The total-requirements matrix (I − A)⁻¹ that converts final demand into the total output required across all industries.'],
    ['TOPI', 'Taxes on production and imports — sales, excise, and property taxes and business fees arising across the economy.'],
    ['Leakage', 'The portion of each round of spending that exits the regional economy through imports, savings, or taxes.'],
  ];
}

function references() {
  return [
    'Ingwersen, W. W., Li, M., Young, B., Vendries, J., & Birney, C. (2022). stateior: A state input-output model for the United States. U.S. Environmental Protection Agency.',
    'Leontief, W. (1936). Quantitative input and output relations in the economic system of the United States. The Review of Economics and Statistics, 18(3), 105–125.',
    'Miller, R. E., & Blair, P. D. (2009). Input-Output Analysis: Foundations and Extensions (2nd ed.). Cambridge University Press.',
    'U.S. Bureau of Economic Analysis. Input-Output Accounts Data (detailed make and use tables). Washington, DC.',
    'U.S. Bureau of Labor Statistics. Quarterly Census of Employment and Wages (QCEW). Washington, DC.',
    'U.S. Environmental Protection Agency. USEEIO and stateior models. Washington, DC.',
  ];
}

function buildTaxTable(results, inputs) {
  const t = results.totals;
  const { gamingTaxResult: gaming, payrollTaxResult: payroll, householdTaxResult: household } = inputs;
  const rows = [];
  if (gaming) {
    const eff = gaming.effectiveRate ? ` (${formatNumber(gaming.effectiveRate * 100, 1)}% eff.)` : '';
    rows.push(dataRow([`Gaming tax on GGR${eff}`, m$(gaming.amount), '—', '—', m$(gaming.amount)]));
  }
  if (t.tax.total > 0) rows.push(dataRow(['Taxes on production (TOPI)', m$(t.tax.direct), m$(t.tax.indirect), m$(t.tax.induced), m$(t.tax.total)]));
  if (payroll && payroll.total > 0) rows.push(dataRow(['Payroll taxes', m$(payroll.direct), m$(payroll.indirect), m$(payroll.induced), m$(payroll.total)]));
  if (household && household.total > 0) rows.push(dataRow(['Household taxes', m$(household.direct), m$(household.indirect), m$(household.induced), m$(household.total)]));
  const td = (gaming?.amount || 0) + t.tax.direct + (payroll?.direct || 0) + (household?.direct || 0);
  const ti = t.tax.indirect + (payroll?.indirect || 0) + (household?.indirect || 0);
  const tu = t.tax.induced + (payroll?.induced || 0) + (household?.induced || 0);
  rows.push(totalRow(['Total public revenue', m$(td), m$(ti), m$(tu), m$(td + ti + tu)]));
  return dataTable(['Tax source', 'Direct', 'Indirect', 'Induced', 'Total'], rows, { colWidths: [3600, 1620, 1620, 1620, 1620] });
}

/** Download the generated Word report. */
export async function downloadDocxReport(results, inputs, authorInfo) {
  const { blob, filename } = await generateDocxReport(results, inputs, authorInfo);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return filename;
}
