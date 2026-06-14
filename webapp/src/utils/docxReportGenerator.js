/**
 * Word (.docx) Report Generator for GEMS (Gaming Economic Modeling System)
 *
 * Produces a full, editable consultant-style report — a flowing document (not
 * slides) with a cover page, executive summary, narrative impact section,
 * detailed result tables, tax estimates, methodology, author bio, limitations,
 * and a technical appendix. The output opens in Microsoft Word / Google Docs /
 * LibreOffice and can be "Saved as PDF" in one click, so it covers both the
 * Word and PDF deliverables consultants expect.
 *
 * Content mirrors the PPTX deck (pptxGenerator.js) so the two exports stay in
 * sync, but the prose is written for a long-form document rather than slides.
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, VerticalAlign,
  ShadingType, PageBreak, Header, Footer, PageNumber, TabStopType, TabStopPosition,
} from 'docx';
import { formatNumber, formatCurrency, formatJobs } from './calculations';
import { BRAND, PRODUCT_NAME_VERSIONED, getSuggestedCitation } from '../brand';

// Brand palette (hex without '#', matching the dashboard + PPTX)
const C = {
  navy: '1A365D',
  brass: 'B7892F',
  ink: '0E1D31',
  accent: '2563A8',
  text: '2D3748',
  muted: '718096',
  hairline: 'D7DCE3',
  rowAlt: 'F4F6F9',
  panel: 'F0F4F8',
  warn: 'B7791F',
  white: 'FFFFFF',
};

const FONT = 'Calibri';
const SERIF = 'Georgia';

// ---- small builders -------------------------------------------------------

const run = (text, opts = {}) => new TextRun({ text, font: FONT, ...opts });

/** A major section heading: serif navy title with a brass underline rule. */
function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 120 },
    border: { bottom: { color: C.brass, space: 4, style: BorderStyle.SINGLE, size: 12 } },
    children: [new TextRun({ text, font: SERIF, bold: true, color: C.navy, size: 30 })],
  });
}

function subHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 80 },
    children: [new TextRun({ text, font: FONT, bold: true, color: C.accent, size: 24 })],
  });
}

/** Body paragraph; `text` may be a string or an array of TextRuns. */
function body(text, opts = {}) {
  const children = Array.isArray(text) ? text : [run(text, { size: 21, color: C.text })];
  return new Paragraph({ spacing: { after: 140, line: 276 }, children, ...opts });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60, line: 264 },
    children: Array.isArray(text) ? text : [run(text, { size: 21, color: C.text })],
  });
}

// ---- table helpers --------------------------------------------------------

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: C.hairline };

function cell(content, { header, align = AlignmentType.LEFT, shade, bold, color, width } = {}) {
  const runs = Array.isArray(content) ? content : [run(String(content), {
    size: 19, bold: bold || header, color: color || (header ? C.white : C.text),
  })];
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: shade ? { type: ShadingType.CLEAR, fill: shade } : undefined,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    children: [new Paragraph({ alignment: align, children: runs })],
  });
}

function dataTable(headers, rows, { colWidths } = {}) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      cell(h, { header: true, shade: C.navy, align: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT, width: colWidths?.[i] })),
  });
  const bodyRows = rows.map((r, ri) =>
    new TableRow({
      children: r.map((c, i) => {
        const isTotal = r.isTotal;
        return cell(c, {
          align: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
          shade: isTotal ? C.panel : (ri % 2 === 1 ? C.rowAlt : undefined),
          bold: isTotal || i === 0,
          color: isTotal ? C.navy : (i === 0 ? C.ink : C.text),
        });
      }),
    }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: thinBorder, bottom: thinBorder, left: noBorder, right: noBorder,
      insideHorizontal: thinBorder, insideVertical: noBorder,
    },
    rows: [headerRow, ...bodyRows],
  });
}

/** A 2x2 grid of headline KPI callout boxes. */
function kpiGrid(metrics) {
  const mkCell = (m, shade) => new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: shade },
    margins: { top: 140, bottom: 140, left: 160, right: 160 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: m.value, font: SERIF, bold: true, color: C.white, size: 34 })] }),
      new Paragraph({ children: [run(m.label.toUpperCase(), { size: 16, color: 'D9E2EC', bold: true })] }),
    ],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4680, 4680],
    borders: {
      top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 8, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.SINGLE, size: 8, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({ children: [mkCell(metrics[0], C.navy), mkCell(metrics[1], C.brass)] }),
      new TableRow({ children: [mkCell(metrics[2], C.navy), mkCell(metrics[3], C.navy)] }),
    ],
  });
}

/** Brass-accented "key takeaway" callout panel. */
function calloutPanel(label, text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [120, 9960],
    layout: 'fixed',
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 120, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: C.brass }, children: [new Paragraph('')] }),
      new TableCell({
        width: { size: 9960, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: C.panel },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        children: [
          new Paragraph({ spacing: { after: 40 }, children: [run(label.toUpperCase(), { size: 16, bold: true, color: C.brass })] }),
          new Paragraph({ children: [run(text, { size: 21, color: C.ink })] }),
        ],
      }),
    ] })],
  });
}

const spacer = (h = 120) => new Paragraph({ spacing: { after: h }, children: [run('', {})] });

// ---- main generator -------------------------------------------------------

export async function generateDocxReport(results, inputs, authorInfo = {}) {
  const inputMode = inputs.inputMode || 'department';
  const totalRevenue = inputMode === 'total' && inputs.revenues?.total
    ? inputs.revenues.total
    : Object.entries(inputs.revenues || {})
        .filter(([k]) => k !== 'total')
        .reduce((s, [, v]) => s + (v || 0), 0);

  const isSample = !!inputs.isSample;
  const stateName = inputs.state || '—';
  const project = inputs.casinoName || '';
  const propertyTypeLabel = inputs.propertyTypeLabel || 'Gaming Establishment';
  const isOnlineType = ['ONLINE_CASINO', 'ONLINE_SPORTSBOOK'].includes(inputs.propertyType);
  const longDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const t = results.totals;
  const m = results.multipliers;
  const multiplierExcess = m.output - 1;

  const licenseLine = isSample
    ? 'SAMPLE REPORT — FOR EVALUATION ONLY'
    : project ? `Licensed for: ${project}` : `${PRODUCT_NAME_VERSIONED} Economic Impact Analysis`;

  // ---------------------------------------------------------------- COVER
  const coverChildren = [
    new Paragraph({ spacing: { before: 1400 }, children: [
      new TextRun({ text: `${BRAND.publisher.toUpperCase()}  ·  ECONOMIC ANALYSIS`, font: FONT, bold: true, color: C.brass, size: 20, characterSpacing: 60 }),
    ] }),
    new Paragraph({ spacing: { before: 200, after: 80 }, children: [
      new TextRun({ text: 'Economic Impact Analysis', font: SERIF, bold: true, color: C.navy, size: 64 }),
    ] }),
    new Paragraph({ spacing: { after: 360 }, border: { bottom: { color: C.brass, space: 8, style: BorderStyle.SINGLE, size: 18 } }, children: [
      new TextRun({ text: project || stateName, font: SERIF, color: C.ink, size: 36 }),
    ] }),
    new Paragraph({ spacing: { after: 60 }, children: [
      run('Jurisdiction:  ', { size: 22, bold: true, color: C.muted }), run(stateName, { size: 22, color: C.ink }),
    ] }),
    new Paragraph({ spacing: { after: 60 }, children: [
      run('Operation type:  ', { size: 22, bold: true, color: C.muted }), run(propertyTypeLabel, { size: 22, color: C.ink }),
    ] }),
    new Paragraph({ spacing: { after: 60 }, children: [
      run('Revenue analyzed:  ', { size: 22, bold: true, color: C.muted }), run(formatCurrency(totalRevenue), { size: 22, color: C.ink }),
    ] }),
    new Paragraph({ spacing: { after: 60 }, children: [
      run('Date:  ', { size: 22, bold: true, color: C.muted }), run(longDate, { size: 22, color: C.ink }),
    ] }),
  ];
  if (isSample) {
    coverChildren.push(new Paragraph({ spacing: { before: 360 }, children: [
      new TextRun({ text: 'SAMPLE REPORT — FOR EVALUATION ONLY', font: FONT, bold: true, color: C.warn, size: 24, characterSpacing: 40 }),
    ] }));
  }
  coverChildren.push(
    new Paragraph({ spacing: { before: 1600 }, children: [
      run(`Modeled with ${PRODUCT_NAME_VERSIONED} — ${BRAND.productFullName}`, { size: 19, color: C.accent, bold: true }),
    ] }),
    new Paragraph({ spacing: { after: 20 }, children: [run(authorInfo.name || 'Dr. Kahlil Philander', { size: 20, color: C.ink, bold: true })] }),
    new Paragraph({ children: [run(`${authorInfo.title || 'Principal Consultant'}, ${authorInfo.institution || BRAND.publisher}`, { size: 19, color: C.muted })] }),
  );

  // ---------------------------------------------------------------- BODY

  const plainSummary = `Based on ${formatCurrency(totalRevenue)} in gaming revenue, ${propertyTypeLabel.toLowerCase()} operations in ${stateName} support a total economic impact of ${formatCurrency(t.output.total)} in output and ${formatJobs(t.employment.total)} full-time-equivalent (FTE) jobs across the state economy. This total reflects not only activity at the operation itself, but also the supply-chain purchases it drives and the household spending of the workers it supports.`;

  const bodyChildren = [
    sectionHeading('Executive Summary'),
    body(plainSummary),
    spacer(60),
    kpiGrid([
      { value: formatCurrency(t.output.total), label: 'Total Economic Output' },
      { value: formatJobs(t.employment.total), label: 'FTE Jobs Supported' },
      { value: formatCurrency(t.gdp.total), label: 'GDP Contribution' },
      { value: formatCurrency(t.wages.total), label: 'Total Wages' },
    ]),
    spacer(140),
    calloutPanel('Key takeaway',
      `For every $1 of direct output at the operation, an additional $${formatNumber(multiplierExcess, 2)} of activity flows through the ${stateName} economy — an output multiplier of ${formatNumber(m.output, 2)}x.`),

    // ---- Statewide impact narrative
    sectionHeading('Statewide Economic Impact'),
    body(`When ${project || 'the operation'} generates ${formatCurrency(totalRevenue)} in revenue, the economic benefit extends well beyond the gaming floor. Input-Output analysis decomposes that benefit into three layers:`),
    body([
      run('Direct effects', { size: 21, bold: true, color: C.navy }),
      run(` — activity at the operation itself: wages paid to employees, purchases of goods and services, and operating costs. This layer accounts for ${formatCurrency(t.output.direct)} of output and ${formatJobs(t.employment.direct)} FTE jobs.`, { size: 21, color: C.text }),
    ]),
    body([
      run('Indirect effects', { size: 21, bold: true, color: C.navy }),
      run(` — the supply chain: vendors, distributors, utilities, and service providers that the operation buys from, who in turn hire workers and make their own purchases. This adds ${formatCurrency(t.output.indirect)} of output and ${formatJobs(t.employment.indirect)} FTE jobs.`, { size: 21, color: C.text }),
    ]),
    body([
      run('Induced effects', { size: 21, bold: true, color: C.navy }),
      run(` — community spending: workers across the operation and its supply chain spend their paychecks on housing, groceries, and local services, supporting still more businesses and jobs. This contributes ${formatCurrency(t.output.induced)} of output and ${formatJobs(t.employment.induced)} FTE jobs.`, { size: 21, color: C.text }),
    ]),

    // ---- Detailed results table
    sectionHeading('Detailed Results'),
    body('Complete breakdown of estimated economic impacts by metric and effect type. Multipliers express total impact per unit of direct effect.'),
    dataTable(
      ['Metric', 'Direct', 'Indirect', 'Induced', 'Total', 'Mult.'],
      [
        row(['Output ($M)', n(t.output.direct), n(t.output.indirect), n(t.output.induced), n(t.output.total), x(m.output)]),
        row(['GDP / Value Added ($M)', n(t.gdp.direct), n(t.gdp.indirect), n(t.gdp.induced), n(t.gdp.total), x(m.gdp)]),
        row(['Employment (FTEs)', j(t.employment.direct), j(t.employment.indirect), j(t.employment.induced), j(t.employment.total), x(m.employment)]),
        row(['Wages ($M)', n(t.wages.direct), n(t.wages.indirect), n(t.wages.induced), n(t.wages.total), x(m.wages)]),
      ],
      { colWidths: [30, 14, 14, 14, 14, 14] },
    ),
    spacer(100),
    body([
      run('Reading the table.  ', { size: 19, bold: true, color: C.ink }),
      run('Output is the total value of goods and services produced; GDP (value added) is output net of intermediate inputs; Employment counts full-time-equivalent jobs; Wages is total labor income including benefits. A multiplier of ', { size: 19, color: C.muted }),
      run(`${formatNumber(m.output, 2)}x`, { size: 19, bold: true, color: C.brass }),
      run(` means each $1 of direct output generates $${formatNumber(m.output, 2)} in total output across the economy.`, { size: 19, color: C.muted }),
    ]),
  ];

  // ---- Tax revenue section
  bodyChildren.push(sectionHeading('Tax Revenue Estimates'));
  bodyChildren.push(body('Estimated tax revenue generated by the operation and the activity it supports, by source.'));
  bodyChildren.push(buildTaxTable(results, inputs));
  bodyChildren.push(spacer(120));
  bodyChildren.push(subHeading('Definitions'));
  for (const d of taxDefinitions(stateName)) {
    bodyChildren.push(bullet([run(`${d.term}: `, { size: 20, bold: true, color: C.ink }), run(d.def, { size: 20, color: C.text })]));
  }
  if (inputs.stateTaxConfig?.localTaxNotes) {
    bodyChildren.push(spacer(60));
    bodyChildren.push(calloutPanel('Local tax note', inputs.stateTaxConfig.localTaxNotes));
  }

  // ---- Methodology
  bodyChildren.push(new Paragraph({ children: [new PageBreak()] }));
  bodyChildren.push(sectionHeading('Methodology'));
  bodyChildren.push(body('This analysis applies Input-Output (IO) analysis, a quantitative technique developed by Nobel laureate Wassily Leontief that represents the inter-industry relationships within an economy. Because output from one industry becomes input for another, IO modeling measures the full, economy-wide effect of a change in final demand — not just direct spending, but the supply-chain and household-spending ripples it sets off.'));
  bodyChildren.push(body('The model uses Type II multipliers, which endogenize household consumption and therefore capture three effects: direct (the initial demand at the operation), indirect (inter-industry purchases needed to meet that demand), and induced (the spending of labor income by workers throughout the chain).'));
  bodyChildren.push(subHeading('Data sources'));
  for (const s of [
    ['EPA State IO multipliers (StateIO, 2019)', 'state-level regional economic multipliers'],
    ['BLS QCEW (2023)', 'state employment and wage data by industry'],
    ['BEA Detail Input-Output accounts', 'gambling-specific (NAICS 713200) coefficients isolated from the blended 713 sector'],
    ['Consumer Price Index (CPI)', 'inflation adjustments to a common dollar year'],
  ]) {
    bodyChildren.push(bullet([run(`${s[0]} — `, { size: 20, bold: true, color: C.ink }), run(s[1], { size: 20, color: C.text })]));
  }
  bodyChildren.push(spacer(80));
  bodyChildren.push(subHeading(isOnlineType ? 'Online gambling multipliers' : 'Why property-specific analysis'));
  bodyChildren.push(body(isOnlineType
    ? `Online operators have fundamentally different economics than land-based casinos — roughly 1.0 employee per $1M of revenue versus about 5.0 for land-based, higher-paid technical workforces, and geographically diffuse supply chains. This analysis uses multipliers derived from NAICS 7132 with online-specific adjustment factors estimated from public-company filings. Note that employment, wage, and supply-chain effects accrue to the state where the operator's workforce is physically located, which may differ from where bettors are; gaming tax revenue, by contrast, accrues to the state of wager. For the most accurate direct effects, enter actual in-state employment and wage data as known-data overrides.`
    : `Different gaming establishments — casino hotels, stand-alone casinos, slot parlors, and bars with gaming — have distinct economic profiles in employment intensity, wage rates, and supply-chain linkages. This analysis applies coefficients specific to "${propertyTypeLabel}" rather than a blended industry average, which materially improves the accuracy of the estimates.`));
  if (results.hasUserData) {
    bodyChildren.push(spacer(60));
    bodyChildren.push(calloutPanel('Note', 'This analysis incorporates user-provided employment and/or wage data for the direct effects, overriding the model defaults.'));
  }

  // ---- About the author
  bodyChildren.push(sectionHeading('About the Author'));
  bodyChildren.push(new Paragraph({ spacing: { after: 20 }, children: [run(authorInfo.name || 'Dr. Kahlil Philander', { size: 26, bold: true, color: C.navy, font: SERIF })] }));
  bodyChildren.push(new Paragraph({ spacing: { after: 140 }, children: [run(`${authorInfo.title || 'Principal Consultant'} · ${authorInfo.institution || BRAND.publisher}`, { size: 20, color: C.brass, bold: true })] }));
  for (const para of (authorInfo.bio || '').split('\n').map(s => s.trim()).filter(Boolean)) {
    bodyChildren.push(body([run(para, { size: 21, color: C.text })]));
  }

  // ---- Limitations / appendix
  bodyChildren.push(sectionHeading('Study Limitations & Disclaimer'));
  bodyChildren.push(body('This report contains forward-looking estimates based on economic-modeling assumptions. These projections are inherently uncertain, and actual results may differ materially.'));
  for (const lim of [
    'Results are estimates derived from Input-Output modeling and should not be read as precise predictions.',
    'The analysis measures gross economic impacts and does not net out substitution, displacement, or opportunity costs.',
    'Multiplier effects assume available economic capacity; realized impacts may be lower during periods of full employment.',
    'Results are sensitive to the geographic scope of analysis and to local economic conditions.',
  ]) bodyChildren.push(bullet(lim));
  bodyChildren.push(body([
    run('Not professional advice. ', { size: 20, bold: true, color: C.ink }),
    run('This report is for informational purposes only and does not constitute investment, legal, tax, or other professional advice. No warranty is made as to completeness or reliability, and the authors assume no liability for decisions taken in reliance on it.', { size: 20, color: C.text }),
  ]));

  bodyChildren.push(sectionHeading('Appendix · Suggested Citation'));
  bodyChildren.push(body([run(getSuggestedCitation(), { size: 19, italics: true, color: C.muted })]));
  bodyChildren.push(body([
    run('Theoretical references: ', { size: 19, color: C.muted }),
    run('Leontief (1936); Miller & Blair (2009). Regional multipliers built using the stateior R package (Ingwersen et al.).', { size: 19, italics: true, color: C.muted }),
  ]));

  // ---------------------------------------------------------------- DOC
  const footer = new Footer({
    children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      border: { top: { color: C.hairline, space: 6, style: BorderStyle.SINGLE, size: 6 } },
      children: [
        run(`${PRODUCT_NAME_VERSIONED}  ·  ${licenseLine}`, { size: 15, color: C.muted }),
        new TextRun({ text: '\t', font: FONT }),
        new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: FONT, size: 15, color: C.muted }),
      ],
    })],
  });
  const header = new Header({
    children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        run('Economic Impact Analysis', { size: 16, bold: true, color: C.navy }),
        new TextRun({ text: '\t', font: FONT }),
        run(project ? `${project} · ${stateName}` : stateName, { size: 16, color: C.muted }),
      ],
    })],
  });

  const doc = new Document({
    creator: authorInfo.name || BRAND.publisher,
    title: `Economic Impact Analysis — ${stateName}`,
    subject: `Casino Gaming Economic Impact (${PRODUCT_NAME_VERSIONED})`,
    description: getSuggestedCitation(),
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: C.text } } },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
        children: coverChildren,
      },
      {
        properties: { page: { margin: { top: 1260, bottom: 1260, left: 1080, right: 1080 } } },
        headers: { default: header },
        footers: { default: footer },
        children: bodyChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${isSample ? 'SAMPLE_' : ''}${BRAND.productName}_${BRAND.modelVersion}_Economic_Impact_${stateName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`;
  return { blob, filename };
}

// ---- value formatters tuned for table cells -------------------------------
const n = (v) => formatNumber(v, 1);
const j = (v) => formatJobs(v);
const x = (v) => (typeof v === 'number' && isFinite(v) ? `${formatNumber(v, 2)}x` : '—');
function row(arr) { arr.isTotal = false; return arr; }
function totalRow(arr) { arr.isTotal = true; return arr; }

function taxDefinitions(stateName) {
  return [
    { term: 'Gaming Tax', def: `State-mandated tax on gross gaming revenue (GGR), at rates set by ${stateName} statute or compact.` },
    { term: 'Taxes on Production (TOPI)', def: 'Sales, property, and excise taxes plus business fees generated across the supply chain, from the IO model.' },
    { term: 'Payroll Taxes', def: 'Employer-side payroll taxes (FICA, FUTA, SUTA, and SDI/PFML where applicable), applied to wages by effect type.' },
    { term: 'Household Taxes', def: 'Federal, state, and local income taxes and related personal taxes, estimated from BEA personal current-tax ratios.' },
  ];
}

function buildTaxTable(results, inputs) {
  const t = results.totals;
  const gaming = inputs.gamingTaxResult;
  const payroll = inputs.payrollTaxResult;
  const household = inputs.householdTaxResult;
  const rows = [];

  if (gaming) {
    const eff = gaming.effectiveRate ? ` (${formatNumber(gaming.effectiveRate * 100, 1)}% eff.)` : '';
    rows.push(row([`Gaming Tax on GGR${eff}`, formatCurrency(gaming.amount), '—', '—', formatCurrency(gaming.amount)]));
  }
  if (t.tax.total > 0) {
    rows.push(row(['Taxes on Production (TOPI)', formatCurrency(t.tax.direct), formatCurrency(t.tax.indirect), formatCurrency(t.tax.induced), formatCurrency(t.tax.total)]));
  }
  if (payroll && payroll.total > 0) {
    rows.push(row(['Payroll Taxes', formatCurrency(payroll.direct), formatCurrency(payroll.indirect), formatCurrency(payroll.induced), formatCurrency(payroll.total)]));
  }
  if (household && household.total > 0) {
    rows.push(row(['Household Taxes', formatCurrency(household.direct), formatCurrency(household.indirect), formatCurrency(household.induced), formatCurrency(household.total)]));
  }

  const td = (gaming?.amount || 0) + t.tax.direct + (payroll?.direct || 0) + (household?.direct || 0);
  const ti = t.tax.indirect + (payroll?.indirect || 0) + (household?.indirect || 0);
  const tu = t.tax.induced + (payroll?.induced || 0) + (household?.induced || 0);
  rows.push(totalRow(['Total Tax Revenue', formatCurrency(td), formatCurrency(ti), formatCurrency(tu), formatCurrency(td + ti + tu)]));

  return dataTable(['Tax Source', 'Direct', 'Indirect', 'Induced', 'Total'], rows, { colWidths: [36, 16, 16, 16, 16] });
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
