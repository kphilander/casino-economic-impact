/**
 * PPTX Report Generator for Casino Economic Impact Calculator
 *
 * Creates a professional PowerPoint presentation with economic impact results.
 * Structure: 7 main slides + 4 appendix slides + back cover = 12 total
 *
 * Main Slides (Layman-Friendly):
 * 1. Cover Page
 * 2. Executive Summary
 * 3. Statewide Economic Impact
 * 4. Detailed Results
 * 5. How We Calculated This
 * 6. About the Author
 * 7. Study Limitations
 *
 * Appendix Slides (Technical):
 * A. Theoretical Framework
 * B. Model Specification
 * C. Methodological Decisions
 * D. Limitations & Cautions
 *
 * Back Cover: GP Consulting Contact
 */

import pptxgen from 'pptxgenjs';
import { formatNumber, formatCurrency, formatJobs } from './calculations';

/**
 * Fetch an image URL and convert to base64 data URL for embedding in PPTX
 * This is more reliable than using external URLs directly
 */
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch image');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Could not fetch image:', error);
    return null;
  }
}

// Color palette matching Draft_template_Feb_7.pptx
const COLORS = {
  navy: '003366',
  lightBlue: '6699CD',
  orange: 'F79608',
  darkFooter: '002244',
  grayText: '404040',  // Darker charcoal for better readability
  darkGray: '202020',
  lightGray: 'EEEEEE',
  white: 'FFFFFF',
  mediumGray: '666666',
  tableBorder: 'CCCCCC',
  // Semantic aliases
  primary: '003366',
  secondary: '666666',
  accent: 'F79608',
  text: '202020',
  lightBg: 'F5F7FA',
  tableBg: 'F5F7FA',
  warning: 'F79608',
  warningBg: 'FFFBEB'
};

// Slide dimensions and layout constants
const SLIDE_WIDTH = 10;
const SLIDE_HEIGHT = 5.625;
const MARGIN = 0.4;              // Consistent margin from edges
const HEADER_HEIGHT = 0.55;      // Navy header bar
const ACCENT_HEIGHT = 0.05;      // Orange accent line
const FOOTER_HEIGHT = 0.35;      // Footer bar (increased from 0.25 for legibility)
const CONTENT_TOP = 0.7;         // Content starts below header + accent
const CONTENT_BOTTOM = SLIDE_HEIGHT - FOOTER_HEIGHT - 0.1;

// Font size hierarchy (consulting best practices)
const FONT = {
  title: 18,       // Main slide titles in header
  section: 12,     // Section headers within content
  body: 10,        // Body text paragraphs
  caption: 9       // Captions, footnotes, footer text (minimum readable)
};

/**
 * Generate a professional PPTX report
 */
export async function generatePPTX(results, inputs, authorInfo = {}) {
  const pptx = new pptxgen();

  // Set presentation properties
  pptx.author = authorInfo.name || 'Economic Impact Calculator';
  pptx.title = `Economic Impact Analysis - ${inputs.state}`;
  pptx.subject = 'Casino Gaming Economic Impact';
  pptx.company = authorInfo.institution || '';

  // Set custom 16:9 layout
  pptx.defineLayout({ name: 'CUSTOM_16x9', width: SLIDE_WIDTH, height: SLIDE_HEIGHT });
  pptx.layout = 'CUSTOM_16x9';

  // Define master slide for main content (slides 2-7)
  pptx.defineSlideMaster({
    title: 'CONTENT_SLIDE',
    background: { color: COLORS.white },
    slideNumber: { x: 9.2, y: '94%', w: 0.5, fontSize: FONT.caption, color: COLORS.white, align: 'right' },
    objects: [
      // Navy header bar
      { rect: { x: 0, y: 0, w: '100%', h: HEADER_HEIGHT, fill: { color: COLORS.navy } } },
      // Orange accent line
      { rect: { x: 0, y: HEADER_HEIGHT, w: '100%', h: ACCENT_HEIGHT, fill: { color: COLORS.orange } } },
      // Navy footer bar
      { rect: { x: 0, y: SLIDE_HEIGHT - FOOTER_HEIGHT, w: '100%', h: FOOTER_HEIGHT, fill: { color: COLORS.navy } } },
      // Footer text
      { text: { text: 'Economic Impact Analysis', options: {
        x: MARGIN, y: SLIDE_HEIGHT - FOOTER_HEIGHT + 0.1, w: 5, h: 0.2,
        fontSize: FONT.caption, fontFace: 'Helvetica', color: COLORS.white
      } } }
    ]
  });

  // Define appendix master slide (slides 9-13)
  pptx.defineSlideMaster({
    title: 'APPENDIX_SLIDE',
    background: { color: COLORS.white },
    slideNumber: { x: 9.2, y: '96%', w: 0.5, fontSize: FONT.caption - 1, color: COLORS.white, align: 'right' },
    objects: [
      // Gray header bar
      { rect: { x: 0, y: 0, w: '100%', h: 0.45, fill: { color: COLORS.secondary } } },
      // Orange accent line
      { rect: { x: 0, y: 0.45, w: '100%', h: 0.04, fill: { color: COLORS.orange } } },
      // Gray footer bar
      { rect: { x: 0, y: SLIDE_HEIGHT - 0.25, w: '100%', h: 0.25, fill: { color: COLORS.secondary } } },
      // APPENDIX label
      { text: { text: 'APPENDIX', options: {
        x: MARGIN, y: 0.1, w: 2, h: 0.28,
        fontSize: FONT.body, fontFace: 'Helvetica', color: COLORS.white
      } } }
    ]
  });

  // Calculate totals
  const totalRevenue = Object.values(inputs.revenues).reduce((sum, v) => sum + (v || 0), 0);
  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // ============================================================
  // SLIDE 1: Cover Page
  // ============================================================
  const slide1 = pptx.addSlide();

  slide1.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: COLORS.navy } });
  slide1.addShape('rect', { x: 0, y: 0, w: 5.5, h: '100%', fill: { color: COLORS.lightBlue, transparency: 85 } });
  slide1.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.04, fill: { color: COLORS.orange } });

  slide1.addText('Economic Impact Analysis', {
    x: 0.5, y: 0.9, w: 6.5, h: 0.6,
    fontSize: 32, fontFace: 'Helvetica', bold: true, color: COLORS.white
  });

  // Venue/Project name OR State name in prominent position
  if (inputs.casinoName) {
    // Venue name as main header
    slide1.addText(inputs.casinoName, {
      x: 0.5, y: 1.5, w: 6.5, h: 0.5,
      fontSize: 20, fontFace: 'Helvetica', bold: true, color: COLORS.white
    });
    slide1.addShape('line', {
      x: 0.5, y: 2.1, w: 3, h: 0,
      line: { color: COLORS.white, width: 1, transparency: 50 }
    });
    slide1.addText(`${inputs.state} Economic Impact Study`, {
      x: 0.5, y: 2.25, w: 6, h: 0.28,
      fontSize: 14, fontFace: 'Helvetica', color: COLORS.lightBlue
    });
    slide1.addText(`Total Revenue Analyzed: ${formatCurrency(totalRevenue)}`, {
      x: 0.5, y: 2.58, w: 6, h: 0.25,
      fontSize: 12, fontFace: 'Helvetica', color: COLORS.lightBlue
    });
    slide1.addText(monthYear, {
      x: 0.5, y: 2.88, w: 6, h: 0.22,
      fontSize: 11, fontFace: 'Helvetica', color: COLORS.white
    });
  } else {
    // State name as main header when no venue provided
    slide1.addText(`${inputs.state} Economic Impact Study`, {
      x: 0.5, y: 1.5, w: 6.5, h: 0.5,
      fontSize: 20, fontFace: 'Helvetica', bold: true, color: COLORS.white
    });
    slide1.addShape('line', {
      x: 0.5, y: 2.1, w: 3, h: 0,
      line: { color: COLORS.white, width: 1, transparency: 50 }
    });
    slide1.addText(`Total Revenue Analyzed: ${formatCurrency(totalRevenue)}`, {
      x: 0.5, y: 2.25, w: 6, h: 0.25,
      fontSize: 12, fontFace: 'Helvetica', color: COLORS.lightBlue
    });
    slide1.addText(monthYear, {
      x: 0.5, y: 2.55, w: 6, h: 0.22,
      fontSize: 11, fontFace: 'Helvetica', color: COLORS.white
    });
  }

  slide1.addShape('rect', {
    x: 0, y: SLIDE_HEIGHT - 0.28, w: '100%', h: 0.28,
    fill: { color: COLORS.darkFooter }
  });

  slide1.addText(`${authorInfo.name || 'Kahlil Simeon-Rose'} | ${authorInfo.institution || 'GP Consulting'}`, {
    x: 0.5, y: SLIDE_HEIGHT - 0.25, w: 8.8, h: 0.22,
    fontSize: 9, fontFace: 'Helvetica', color: COLORS.white
  });

  // ============================================================
  // SLIDE 2: Executive Summary
  // ============================================================
  const slide2 = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

  slide2.addText('EXECUTIVE SUMMARY', {
    x: MARGIN, y: 0.12, w: 9, h: 0.4,
    fontSize: FONT.title, fontFace: 'Helvetica', bold: true, color: COLORS.white
  });

  // LAYOUT: "What This Means" on LEFT, Key Metrics boxes on RIGHT

  // What This Means section - LEFT column
  const summaryX = MARGIN, summaryW = 4.4;

  slide2.addText(`What This Means for ${inputs.state}`, {
    x: summaryX, y: CONTENT_TOP + 0.05, w: summaryW, h: 0.32,
    fontSize: FONT.section + 2, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  const plainSummary = `Based on ${formatCurrency(totalRevenue)} in gaming revenue, casino operations in ${inputs.state} support a total economic impact of ${formatCurrency(results.totals.output.total)} and ${formatJobs(results.totals.employment.total)} jobs across the state economy.

This includes not just casino employees, but workers throughout the supply chain and the broader community who benefit when those workers spend their paychecks locally.`;

  slide2.addText(plainSummary, {
    x: summaryX, y: CONTENT_TOP + 0.42, w: summaryW, h: 1.35,
    fontSize: FONT.body + 1, fontFace: 'Helvetica', color: COLORS.text, valign: 'top'
  });

  // Key Takeaway callout - LEFT column, below summary
  const multiplierExcess = results.multipliers.output - 1;
  const takeawayY = 2.55;
  slide2.addShape('rect', { x: summaryX, y: takeawayY, w: summaryW, h: 0.78, fill: { color: COLORS.lightBg } });
  slide2.addShape('rect', { x: summaryX, y: takeawayY, w: 0.06, h: 0.78, fill: { color: COLORS.accent } });

  slide2.addText('KEY TAKEAWAY', {
    x: summaryX + 0.15, y: takeawayY + 0.08, w: 1.5, h: 0.22,
    fontSize: FONT.body, fontFace: 'Helvetica', bold: true, color: COLORS.accent
  });
  slide2.addText(`For every $1 of direct casino output, an additional $${formatNumber(multiplierExcess, 2)} flows through the ${inputs.state} economy.`, {
    x: summaryX + 0.15, y: takeawayY + 0.35, w: summaryW - 0.3, h: 0.4,
    fontSize: FONT.body + 1, fontFace: 'Helvetica', color: COLORS.text
  });

  // Key metrics boxes (2x2 grid) - RIGHT column
  const boxWidth = 2.15, boxHeight = 1.15, boxStartX = 5.0, boxStartY = CONTENT_TOP + 0.1, boxGap = 0.18;

  const metrics = [
    { value: formatCurrency(results.totals.output.total), label: 'Total Economic Output', isJobs: false },
    { value: formatJobs(results.totals.employment.total), label: 'Jobs Supported', isJobs: true },
    { value: formatCurrency(results.totals.gdp.total), label: 'GDP Contribution', isJobs: false },
    { value: formatCurrency(results.totals.wages.total), label: 'Total Wages', isJobs: false }
  ];

  metrics.forEach((metric, i) => {
    const x = boxStartX + (i % 2) * (boxWidth + boxGap);
    const y = boxStartY + Math.floor(i / 2) * (boxHeight + boxGap);

    // Jobs get special spotlight treatment with orange accent
    const boxColor = metric.isJobs ? COLORS.accent : COLORS.primary;

    slide2.addShape('rect', { x, y, w: boxWidth, h: boxHeight, fill: { color: boxColor } });
    slide2.addText(metric.value, {
      x, y: y + 0.2, w: boxWidth, h: 0.5,
      fontSize: FONT.title + 2, fontFace: 'Helvetica', bold: true, color: COLORS.white, align: 'center'
    });
    slide2.addText(metric.label, {
      x, y: y + 0.75, w: boxWidth, h: 0.3,
      fontSize: FONT.body, fontFace: 'Helvetica', color: COLORS.white, align: 'center'
    });
  });

  // Bottom section - simplified impact types with spotlight on jobs
  slide2.addText('How the Impact Spreads', {
    x: MARGIN, y: 3.58, w: 9, h: 0.3,
    fontSize: FONT.section + 2, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  const impactTypes = [
    { title: 'At the Casino', jobs: results.totals.employment.direct, desc: 'Direct employees and on-site spending' },
    { title: 'Through Suppliers', jobs: results.totals.employment.indirect, desc: 'Vendors, distributors, service providers' },
    { title: 'In the Community', jobs: results.totals.employment.induced, desc: 'Local businesses where workers shop' }
  ];

  impactTypes.forEach((impact, i) => {
    const x = MARGIN + i * 3.1;
    slide2.addText(impact.title, {
      x, y: 3.92, w: 3, h: 0.26,
      fontSize: FONT.body + 1, fontFace: 'Helvetica', bold: true, color: COLORS.primary
    });
    // Jobs with spotlight icon (circle with number)
    slide2.addShape('ellipse', { x: x, y: 4.22, w: 0.28, h: 0.28, fill: { color: COLORS.accent } });
    slide2.addText(`${formatJobs(impact.jobs)} jobs`, {
      x: x + 0.35, y: 4.2, w: 2.6, h: 0.3,
      fontSize: FONT.section + 2, fontFace: 'Helvetica', bold: true, color: COLORS.accent
    });
    slide2.addText(impact.desc, {
      x, y: 4.55, w: 2.9, h: 0.4,
      fontSize: FONT.body, fontFace: 'Helvetica', color: COLORS.grayText
    });
  });

  // ============================================================
  // SLIDE 3: Statewide Economic Impact (formerly Economic Ripple Effect)
  // ============================================================
  const slide3 = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

  slide3.addText('STATEWIDE ECONOMIC IMPACT', {
    x: MARGIN, y: 0.12, w: 9, h: 0.4,
    fontSize: FONT.title, fontFace: 'Helvetica', bold: true, color: COLORS.white
  });

  // Symmetric margins - intro text aligned with content
  const contentMargin = MARGIN + 0.1;
  const contentWidth = SLIDE_WIDTH - 2 * contentMargin;

  slide3.addText(`When a casino generates ${formatCurrency(totalRevenue)} in revenue, the economic benefits extend far beyond the casino floor. Here's how that money flows through the ${inputs.state} economy:`, {
    x: contentMargin, y: CONTENT_TOP, w: contentWidth, h: 0.48,
    fontSize: FONT.body + 1, fontFace: 'Helvetica', color: COLORS.text
  });

  // Three impact columns with layman explanations - symmetric spacing
  const rippleEffects = [
    {
      title: 'DIRECT IMPACT',
      subtitle: 'At the Casino',
      amount: formatCurrency(results.totals.output.direct),
      jobs: formatJobs(results.totals.employment.direct),
      color: COLORS.primary,
      explanation: 'The casino pays employees, purchases supplies, and covers operating costs. These are jobs and spending that happen at the casino itself.'
    },
    {
      title: 'SUPPLY CHAIN',
      subtitle: 'Business Partners',
      amount: formatCurrency(results.totals.output.indirect),
      jobs: formatJobs(results.totals.employment.indirect),
      color: COLORS.secondary,
      explanation: 'Casino suppliers—food distributors, equipment vendors, utilities—hire their own workers and make purchases, creating additional economic activity.'
    },
    {
      title: 'COMMUNITY',
      subtitle: 'Local Spending',
      amount: formatCurrency(results.totals.output.induced),
      jobs: formatJobs(results.totals.employment.induced),
      color: COLORS.accent,
      explanation: 'Workers across the supply chain spend their paychecks on housing, groceries, and local services—supporting even more businesses and jobs.'
    }
  ];

  // Calculate symmetric column layout
  const colWidth = 3.0;
  const colGap = 0.2;
  const totalColumnsWidth = 3 * colWidth + 2 * colGap;
  const colStartX = (SLIDE_WIDTH - totalColumnsWidth) / 2;  // Center the columns
  const colStartY = 1.32;  // Moved down 0.1"
  const cardBodyHeight = 2.05;

  rippleEffects.forEach((effect, i) => {
    const x = colStartX + i * (colWidth + colGap);

    // Header
    slide3.addShape('rect', { x, y: colStartY, w: colWidth, h: 0.58, fill: { color: effect.color } });
    slide3.addText(effect.title, {
      x, y: colStartY + 0.08, w: colWidth, h: 0.24,
      fontSize: FONT.body + 1, fontFace: 'Helvetica', bold: true, color: COLORS.white, align: 'center'
    });
    slide3.addText(effect.subtitle, {
      x, y: colStartY + 0.32, w: colWidth, h: 0.22,
      fontSize: FONT.body, fontFace: 'Helvetica', color: COLORS.white, align: 'center'
    });

    // Body card
    slide3.addShape('rect', {
      x, y: colStartY + 0.58, w: colWidth, h: cardBodyHeight,
      fill: { color: COLORS.lightBg }, line: { color: 'DDDDDD', width: 0.5 }
    });

    // Amount
    slide3.addText(effect.amount, {
      x, y: colStartY + 0.72, w: colWidth, h: 0.38,
      fontSize: FONT.title + 2, fontFace: 'Helvetica', bold: true, color: COLORS.text, align: 'center'
    });
    slide3.addText('Economic Output', {
      x, y: colStartY + 1.1, w: colWidth, h: 0.22,
      fontSize: FONT.body, fontFace: 'Helvetica', color: COLORS.grayText, align: 'center'
    });

    // Jobs - highlighted
    slide3.addText(effect.jobs + ' jobs', {
      x, y: colStartY + 1.38, w: colWidth, h: 0.3,
      fontSize: FONT.section + 3, fontFace: 'Helvetica', bold: true, color: effect.color, align: 'center'
    });

    // Explanation
    slide3.addText(effect.explanation, {
      x: x + 0.12, y: colStartY + 1.72, w: colWidth - 0.24, h: 0.88,
      fontSize: FONT.body, fontFace: 'Helvetica', color: COLORS.grayText, align: 'center', valign: 'top'
    });
  });

  // Total callout at bottom - moved down 0.1" for equal white space
  slide3.addShape('rect', {
    x: colStartX, y: 4.15, w: totalColumnsWidth, h: 0.78,
    fill: { color: COLORS.navy }
  });
  slide3.addText('TOTAL ECONOMIC IMPACT', {
    x: colStartX + 0.2, y: 4.22, w: 3.2, h: 0.26,
    fontSize: FONT.body + 1, fontFace: 'Helvetica', bold: true, color: COLORS.white
  });
  slide3.addText(formatCurrency(results.totals.output.total), {
    x: colStartX + 0.2, y: 4.5, w: 3.2, h: 0.38,
    fontSize: 24, fontFace: 'Helvetica', bold: true, color: COLORS.orange
  });
  slide3.addText(`${formatJobs(results.totals.employment.total)} total jobs supported across ${inputs.state}`, {
    x: colStartX + 3.5, y: 4.38, w: totalColumnsWidth - 3.7, h: 0.4,
    fontSize: FONT.section + 2, fontFace: 'Helvetica', color: COLORS.white, align: 'right'
  });

  // ============================================================
  // SLIDE 4: Detailed Results
  // ============================================================
  const slide4 = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

  slide4.addText('DETAILED RESULTS', {
    x: MARGIN, y: 0.12, w: 9, h: 0.4,
    fontSize: FONT.title, fontFace: 'Helvetica', bold: true, color: COLORS.white
  });

  slide4.addText('Complete breakdown of economic impacts by category and effect type', {
    x: MARGIN, y: CONTENT_TOP + 0.1, w: 9, h: 0.28,
    fontSize: FONT.body + 1, fontFace: 'Helvetica', color: COLORS.grayText
  });

  // Main results table with styled header row
  const tableHeaderRow = [
    { text: 'Metric', options: { fill: { color: COLORS.navy }, color: COLORS.white, bold: true } },
    { text: 'Direct', options: { fill: { color: COLORS.navy }, color: COLORS.white, bold: true } },
    { text: 'Indirect', options: { fill: { color: COLORS.navy }, color: COLORS.white, bold: true } },
    { text: 'Induced', options: { fill: { color: COLORS.navy }, color: COLORS.white, bold: true } },
    { text: 'Total', options: { fill: { color: COLORS.navy }, color: COLORS.white, bold: true } },
    { text: 'Multiplier', options: { fill: { color: COLORS.navy }, color: COLORS.white, bold: true } }
  ];

  const tableDataRows = [
    ['Output ($M)', formatNumber(results.totals.output.direct, 1), formatNumber(results.totals.output.indirect, 1), formatNumber(results.totals.output.induced, 1), formatNumber(results.totals.output.total, 1), formatNumber(results.multipliers.output, 2) + 'x'],
    ['GDP ($M)', formatNumber(results.totals.gdp.direct, 1), formatNumber(results.totals.gdp.indirect, 1), formatNumber(results.totals.gdp.induced, 1), formatNumber(results.totals.gdp.total, 1), formatNumber(results.multipliers.gdp, 2) + 'x'],
    ['Employment', formatJobs(results.totals.employment.direct), formatJobs(results.totals.employment.indirect), formatJobs(results.totals.employment.induced), formatJobs(results.totals.employment.total), formatNumber(results.multipliers.employment, 2) + 'x'],
    ['Wages ($M)', formatNumber(results.totals.wages.direct, 1), formatNumber(results.totals.wages.indirect, 1), formatNumber(results.totals.wages.induced, 1), formatNumber(results.totals.wages.total, 1), formatNumber(results.multipliers.wages, 2) + 'x']
  ];

  const tableData = [tableHeaderRow, ...tableDataRows];

  slide4.addTable(tableData, {
    x: MARGIN, y: 1.15, w: 9.2, h: 2.0,
    fontFace: 'Helvetica', fontSize: FONT.body + 1, color: COLORS.text,
    border: { pt: 0.5, color: 'CCCCCC' },
    colW: [1.7, 1.4, 1.4, 1.4, 1.4, 1.4],
    rowH: 0.4,
    fill: { color: COLORS.white },
    align: 'center', valign: 'middle'
  });

  // Understanding multipliers callout - 1/3 width column
  slide4.addText('Understanding Multipliers', {
    x: MARGIN, y: 3.25, w: 3.0, h: 0.32,
    fontSize: FONT.section + 2, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  slide4.addText(`A multiplier shows how much total economic activity results from $1 of direct spending. For example, an output multiplier of ${formatNumber(results.multipliers.output, 2)}x means every $1 generates $${formatNumber(results.multipliers.output, 2)} in total output.`, {
    x: MARGIN, y: 3.6, w: 3.0, h: 1.0,
    fontSize: FONT.body + 1, fontFace: 'Helvetica', color: COLORS.text
  });

  // Key Terms - 2/3 width column
  slide4.addText('Key Terms', {
    x: 3.6, y: 3.25, w: 6.0, h: 0.32,
    fontSize: FONT.section + 2, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  const terms = [
    { term: 'Output', def: 'Total value of goods and services produced' },
    { term: 'GDP', def: 'Value added (output minus intermediate inputs)' },
    { term: 'Employment', def: 'Full-time equivalent jobs supported' },
    { term: 'Wages', def: 'Total labor income including benefits' }
  ];

  let termY = 3.6;
  terms.forEach(t => {
    slide4.addText(`${t.term}: `, {
      x: 3.6, y: termY, w: 1.6, h: 0.26,
      fontSize: FONT.body + 1, fontFace: 'Helvetica', bold: true, color: COLORS.text
    });
    slide4.addText(t.def, {
      x: 5.2, y: termY, w: 4.4, h: 0.26,
      fontSize: FONT.body + 1, fontFace: 'Helvetica', color: COLORS.grayText
    });
    termY += 0.3;
  });

  // ============================================================
  // SLIDE 5: How We Calculated This
  // ============================================================
  const slide5 = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

  slide5.addText('MODEL METHODOLOGY', {
    x: MARGIN, y: 0.12, w: 9, h: 0.4,
    fontSize: FONT.title, fontFace: 'Helvetica', bold: true, color: COLORS.white
  });

  slide5.addText('Our Approach', {
    x: MARGIN, y: CONTENT_TOP + 0.05, w: 4.5, h: 0.3,
    fontSize: FONT.section + 2, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  const approachText = `We used Input-Output (IO) analysis, a proven economic modeling technique developed by Nobel laureate Wassily Leontief. This method tracks how money flows between industries, allowing us to measure the full economic impact of casino operations—not just direct spending, but the ripple effects throughout the economy.

The model uses "Type II" multipliers, which capture both business-to-business spending (indirect effects) and household spending by workers (induced effects).

For technical details, see the appendix.`;

  slide5.addText(approachText, {
    x: MARGIN, y: 1.05, w: 4.5, h: 1.65,
    fontSize: FONT.body + 1, fontFace: 'Helvetica', color: COLORS.text, valign: 'top'
  });

  // Data Sources - without years
  slide5.addText('Data Sources', {
    x: 5.2, y: CONTENT_TOP + 0.05, w: 4.5, h: 0.3,
    fontSize: FONT.section + 2, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  const dataSources = [
    { name: 'EPA State IO Tables', desc: 'Regional economic multipliers' },
    { name: 'BLS QCEW', desc: 'State employment and wage data' },
    { name: 'BEA National Tables', desc: 'Gambling-specific adjustments' },
    { name: 'Consumer Price Index (CPI)', desc: 'Inflation adjustments' }
  ];

  let dsY = 1.05;
  dataSources.forEach(source => {
    slide5.addShape('ellipse', { x: 5.2, y: dsY + 0.06, w: 0.12, h: 0.12, fill: { color: COLORS.accent } });
    slide5.addText(source.name, {
      x: 5.42, y: dsY, w: 4.3, h: 0.26,
      fontSize: FONT.body + 1, fontFace: 'Helvetica', bold: true, color: COLORS.text
    });
    slide5.addText(source.desc, {
      x: 5.42, y: dsY + 0.26, w: 4.3, h: 0.24,
      fontSize: FONT.body, fontFace: 'Helvetica', color: COLORS.grayText
    });
    dsY += 0.55;
  });

  // Why gambling-specific? - Moved down to avoid overlap with content above
  slide5.addText('Why Gambling-Specific Analysis?', {
    x: MARGIN, y: 3.4, w: 9, h: 0.3,
    fontSize: FONT.section + 2, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  const gamblingExplanation = `Economic impact models are essential for understanding how gambling operations affect local and state economies. However, the accuracy of these models depends critically on using industry-specific data rather than generic averages.

This analysis uses gambling-specific coefficients (NAICS 7132) rather than broad "arts and entertainment" averages. This matters because casinos have distinct characteristics: they typically employ more workers per dollar of revenue, pay different wage rates, and have unique supply chains compared to theaters, museums, or sports venues. Using generic multipliers would misrepresent the true economic footprint of gambling operations.`;

  slide5.addText(gamblingExplanation, {
    x: MARGIN, y: 3.9, w: 9.2, h: 0.8,
    fontSize: FONT.body + 1, fontFace: 'Helvetica', color: COLORS.text
  });

  // User data note (if applicable)
  if (results.hasUserData) {
    slide5.addShape('rect', { x: MARGIN, y: 4.45, w: 9.2, h: 0.45, fill: { color: COLORS.lightBg } });
    slide5.addText('Note: This analysis incorporates user-provided employment and/or wage data, which may differ from model estimates.', {
      x: MARGIN + 0.1, y: 4.52, w: 9.0, h: 0.35,
      fontSize: FONT.body, fontFace: 'Helvetica', italic: true, color: COLORS.grayText
    });
  }

  // ============================================================
  // SLIDE 6: About the Author (Full-width layout, comprehensive bio)
  // ============================================================
  const slide6 = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

  slide6.addText('ABOUT THE AUTHOR', {
    x: MARGIN, y: 0.12, w: 9, h: 0.4,
    fontSize: FONT.title, fontFace: 'Helvetica', bold: true, color: COLORS.white
  });

  // Name (full width)
  slide6.addText(authorInfo.name || 'Dr. Kahlil Simeon-Rose', {
    x: MARGIN, y: CONTENT_TOP + 0.05, w: 9.2, h: 0.38,
    fontSize: FONT.title + 2, fontFace: 'Helvetica', bold: true, color: COLORS.navy
  });

  // Title | Institution on same line
  const titleText = `${authorInfo.title || 'Principal Consultant'} | ${authorInfo.institution || 'GP Consulting'}`;
  slide6.addText(titleText, {
    x: MARGIN, y: 1.1, w: 9.2, h: 0.28,
    fontSize: FONT.body + 2, fontFace: 'Helvetica', color: COLORS.orange
  });

  // Website with hyperlink
  slide6.addText([{
    text: 'kahlil.co',
    options: { hyperlink: { url: 'https://kahlil.co' }, color: COLORS.primary }
  }], {
    x: MARGIN, y: 1.38, w: 9.2, h: 0.22,
    fontSize: FONT.body, fontFace: 'Helvetica'
  });

  // Full narrative bio - takes up most of the slide (smaller font for long bio)
  slide6.addText(authorInfo.bio || 'Dr. Kahlil Simeon-Rose is an economist and academic specializing in the analysis of large-scale economic development initiatives, regulatory policy, and consumer behavior in the gaming industry.', {
    x: MARGIN, y: 1.62, w: 9.2, h: 3.3,
    fontSize: FONT.body, fontFace: 'Helvetica', color: COLORS.darkGray, valign: 'top'
  });

  // ============================================================
  // SLIDE 7: Safe Harbor Statement
  // ============================================================
  const slide7 = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

  slide7.addText('STUDY LIMITATIONS', {
    x: MARGIN, y: 0.12, w: 9, h: 0.4,
    fontSize: FONT.title, fontFace: 'Helvetica', bold: true, color: COLORS.white
  });

  slide7.addText('This report contains forward-looking statements and estimates based on economic modeling assumptions. These projections are inherently uncertain and actual results may differ materially from those presented.', {
    x: MARGIN, y: CONTENT_TOP, w: 9.2, h: 0.5,
    fontSize: FONT.body, fontFace: 'Helvetica', color: COLORS.text
  });

  // Key Limitations
  slide7.addText('Key Limitations', {
    x: MARGIN, y: 1.35, w: 4.5, h: 0.28,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  const limitations = [
    'Results are estimates derived from Input-Output modeling and should not be interpreted as precise predictions',
    'The analysis measures gross economic impacts and does not account for substitution effects, displacement, or opportunity costs',
    'Multiplier effects assume available economic capacity; actual impacts may be lower during periods of full employment',
    'Results are sensitive to the geographic scope of analysis and local economic conditions'
  ];

  let limY = 1.68;
  limitations.forEach((lim, i) => {
    slide7.addText(`${i + 1}. ${lim}`, {
      x: MARGIN, y: limY, w: 9.2, h: 0.38,
      fontSize: FONT.body, fontFace: 'Helvetica', color: COLORS.text
    });
    limY += 0.42;
  });

  // Not Professional Advice
  slide7.addText('Not Professional Advice', {
    x: MARGIN, y: 3.4, w: 4.5, h: 0.28,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  slide7.addText('This report is for informational purposes only and does not constitute investment, legal, tax, or professional advice. Users should consult qualified professionals before making decisions based on this analysis.', {
    x: MARGIN, y: 3.72, w: 9.2, h: 0.5,
    fontSize: FONT.body, fontFace: 'Helvetica', color: COLORS.text
  });

  // No Warranty
  slide7.addText('No Warranty', {
    x: MARGIN, y: 4.3, w: 4.5, h: 0.28,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  slide7.addText('While every effort has been made to ensure accuracy, no warranty is made regarding the completeness or reliability of this information. The authors assume no liability for any actions taken based on this report.', {
    x: MARGIN, y: 4.6, w: 9.2, h: 0.45,
    fontSize: FONT.body, fontFace: 'Helvetica', color: COLORS.text
  });


  // ============================================================
  // APPENDIX A: Theoretical Framework
  // ============================================================
  const appendixA = pptx.addSlide({ masterName: 'APPENDIX_SLIDE' });

  appendixA.addText('A: Theoretical Framework', {
    x: 1.5, y: 0.1, w: 8, h: 0.28,
    fontSize: FONT.section + 2, fontFace: 'Helvetica', bold: true, color: COLORS.white
  });

  appendixA.addText('Input-Output Analysis', {
    x: MARGIN, y: 0.6, w: 4.5, h: 0.26,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  appendixA.addText(`Input-Output (IO) analysis, developed by Wassily Leontief (1936), is a quantitative economic technique that represents inter-industry relationships within an economy. The model captures how output from one industry becomes input for another, allowing measurement of economy-wide effects from changes in final demand.

Example: When a casino purchases $1M in food supplies, the food distributor uses that revenue to pay employees and buy from farmers. Those farmers then spend their income locally. This chain of spending is what IO analysis captures.`, {
    x: MARGIN, y: 0.9, w: 4.5, h: 2.0,
    fontSize: FONT.caption, fontFace: 'Helvetica', color: COLORS.text, valign: 'top'
  });

  appendixA.addText('Type II Multipliers', {
    x: 5.2, y: 0.6, w: 4.5, h: 0.26,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  appendixA.addText(`This analysis uses Type II multipliers, which extend the basic IO framework by endogenizing household consumption. Type II multipliers capture:

• Direct Effects: Initial change in the industry receiving the demand shock
• Indirect Effects: Changes in inter-industry purchases required to meet the direct demand
• Induced Effects: Changes resulting from household spending of labor income

Example: If a casino creates 100 direct jobs, Type II analysis might show 180 total jobs supported—the original 100 plus 50 in supplier businesses and 30 more in local retail/services where workers shop.`, {
    x: 5.2, y: 0.9, w: 4.5, h: 2.0,
    fontSize: FONT.caption, fontFace: 'Helvetica', color: COLORS.text, valign: 'top'
  });

  // Economic Impact Categories
  appendixA.addText('Economic Impact Categories', {
    x: MARGIN, y: 3.0, w: 4.5, h: 0.24,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  appendixA.addText(`• Output: Total value of goods/services produced
• GDP: Value added (output minus inputs)
• Employment: Full-time equivalent jobs
• Wages: Total labor compensation`, {
    x: MARGIN, y: 3.28, w: 4.5, h: 0.85,
    fontSize: FONT.caption, fontFace: 'Helvetica', color: COLORS.text
  });

  // Regional vs National
  appendixA.addText('Regional Analysis', {
    x: 5.2, y: 3.0, w: 4.5, h: 0.24,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  appendixA.addText(`State-level analysis captures only impacts within the geographic boundary. Spending that "leaks" to other states (imports) is excluded. This provides a conservative but accurate estimate of local economic benefits.

Built using the stateior R package (Ingwersen et al.).`, {
    x: 5.2, y: 3.28, w: 4.5, h: 0.85,
    fontSize: FONT.caption, fontFace: 'Helvetica', color: COLORS.text
  });

  appendixA.addText('Key References: Leontief (1936), Miller & Blair (2009)', {
    x: MARGIN, y: 4.2, w: 9.2, h: 0.2,
    fontSize: FONT.caption, fontFace: 'Helvetica', italic: true, color: COLORS.grayText
  });

  // ============================================================
  // APPENDIX B: Model Specification
  // ============================================================
  const appendixB = pptx.addSlide({ masterName: 'APPENDIX_SLIDE' });

  appendixB.addText('B: Model Specification', {
    x: 1.5, y: 0.1, w: 8, h: 0.28,
    fontSize: FONT.section + 2, fontFace: 'Helvetica', bold: true, color: COLORS.white
  });

  appendixB.addText('Industry Classification', {
    x: MARGIN, y: 0.6, w: 4.5, h: 0.26,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  appendixB.addText(`This analysis uses NAICS 7132 (Gambling Industries) coefficients rather than the broader NAICS 713 (Amusement, Gambling, and Recreation) category.

NAICS 7132 includes:
• 713210: Casinos (except Casino Hotels)
• 713290: Other Gambling Industries

Example: A general "entertainment" multiplier averages casinos with movie theaters, museums, and gyms. Since casinos employ ~3x more workers per dollar than these other venues, using gambling-specific (NAICS 7132) coefficients is essential for accuracy.`, {
    x: MARGIN, y: 0.9, w: 4.5, h: 1.8,
    fontSize: FONT.caption, fontFace: 'Helvetica', color: COLORS.text, valign: 'top'
  });

  appendixB.addText('State-Level Adjustments', {
    x: 5.2, y: 0.6, w: 4.5, h: 0.26,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  appendixB.addText(`Multipliers are derived from EPA State Input-Output Tables, which account for state-specific:

• Industry composition and inter-industry linkages
• Import/export patterns and regional trade flows
• Labor productivity and compensation levels

Example: Nevada retains more casino supply chain spending locally than Ohio because Nevada has more gaming suppliers. This means Nevada's multipliers are higher—more of each dollar stays in-state.`, {
    x: 5.2, y: 0.9, w: 4.5, h: 1.8,
    fontSize: FONT.caption, fontFace: 'Helvetica', color: COLORS.text, valign: 'top'
  });

  // Multiplier Interpretation
  appendixB.addText('Multiplier Interpretation', {
    x: MARGIN, y: 2.8, w: 4.5, h: 0.24,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  appendixB.addText(`Output multipliers >1 indicate economic ripple effects. Employment multipliers show jobs per unit of direct employment. Larger multipliers indicate stronger local economic linkages.`, {
    x: MARGIN, y: 3.08, w: 4.5, h: 0.65,
    fontSize: FONT.caption, fontFace: 'Helvetica', color: COLORS.text
  });

  // Data vintage table
  appendixB.addText('Data Vintage', {
    x: 5.2, y: 2.8, w: 4.5, h: 0.24,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  const vintageTable = [
    ['Source', 'Year', 'Use'],
    ['EPA State IO', '2019', 'Multipliers'],
    ['BLS QCEW', '2024', 'Employment/wages'],
    ['BEA IO Tables', '2017', 'Gambling coefficients']
  ];

  appendixB.addTable(vintageTable, {
    x: 5.2, y: 3.08, w: 4.4, h: 0.8,
    fontFace: 'Helvetica', fontSize: FONT.caption, color: COLORS.text,
    border: { pt: 0.3, color: 'CCCCCC' },
    colW: [1.6, 0.8, 2.0],
    rowH: 0.2,
    align: 'left', valign: 'middle'
  });

  // ============================================================
  // APPENDIX C: Methodological Decisions
  // ============================================================
  const appendixC = pptx.addSlide({ masterName: 'APPENDIX_SLIDE' });

  appendixC.addText('C: Methodological Decisions', {
    x: 1.5, y: 0.1, w: 8, h: 0.28,
    fontSize: FONT.section + 2, fontFace: 'Helvetica', bold: true, color: COLORS.white
  });

  appendixC.addText('Key Design Choices', {
    x: MARGIN, y: 0.6, w: 9, h: 0.26,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  const decisions = [
    {
      decision: 'Gambling-Specific vs. General Multipliers',
      rationale: 'Gambling operations have distinct labor intensity, wage structures, and supply chains. A study using general "entertainment" multipliers might understate employment by 30-40%.'
    },
    {
      decision: 'Type II vs. Type I Multipliers',
      rationale: 'Type II multipliers capture induced effects from household spending. Excluding induced effects would miss $0.30-0.50 of every dollar\'s economic impact.'
    },
    {
      decision: 'State vs. National Multipliers',
      rationale: 'State-level multipliers account for regional import leakage. National multipliers could overstate impacts by 50% or more by assuming all spending stays local.'
    },
    {
      decision: 'Treatment of User-Provided Data',
      rationale: 'If you know your casino employs 500 people, that precision improves all downstream estimates. User data replaces model estimates for direct effects.'
    }
  ];

  let decY = 0.9;
  decisions.forEach(d => {
    appendixC.addText(d.decision, {
      x: MARGIN, y: decY, w: 9.2, h: 0.2,
      fontSize: FONT.body, fontFace: 'Helvetica', bold: true, color: COLORS.text
    });
    appendixC.addText(d.rationale, {
      x: MARGIN, y: decY + 0.22, w: 9.2, h: 0.42,
      fontSize: FONT.caption, fontFace: 'Helvetica', color: COLORS.grayText
    });
    decY += 0.68;
  });

  // Validation section
  appendixC.addText('Validation & Sensitivity', {
    x: MARGIN, y: 3.65, w: 9, h: 0.22,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  appendixC.addText(`Results are validated against published industry benchmarks and cross-checked with BLS employment data. Sensitivity analysis shows that results are most sensitive to direct employment assumptions. Users can input known employment figures to improve accuracy for specific operations.`, {
    x: MARGIN, y: 3.9, w: 9.2, h: 0.55,
    fontSize: FONT.caption, fontFace: 'Helvetica', color: COLORS.text
  });

  // ============================================================
  // APPENDIX D: Limitations & Cautions
  // ============================================================
  const appendixD = pptx.addSlide({ masterName: 'APPENDIX_SLIDE' });

  appendixD.addText('D: Limitations & Cautions', {
    x: 1.5, y: 0.1, w: 8, h: 0.28,
    fontSize: FONT.section + 2, fontFace: 'Helvetica', bold: true, color: COLORS.white
  });

  appendixD.addText('Technical Limitations of IO Analysis', {
    x: MARGIN, y: 0.6, w: 9, h: 0.26,
    fontSize: FONT.section, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });

  const technicalLimitations = [
    {
      limitation: 'Linear Production Functions',
      explanation: 'IO models assume constant returns to scale and fixed input proportions. In reality, industries may exhibit economies of scale or substitute inputs in response to price changes.'
    },
    {
      limitation: 'No Supply Constraints',
      explanation: 'The model assumes unlimited supply capacity. During periods of full employment or resource scarcity, multiplier effects may be constrained by labor or material shortages.'
    },
    {
      limitation: 'Static Coefficients',
      explanation: 'Technical coefficients are derived from historical data and may not reflect current production technologies or supply chain relationships.'
    },
    {
      limitation: 'Gross vs. Net Impacts',
      explanation: 'IO analysis measures gross impacts and does not account for displacement effects—spending at casinos may substitute for spending at other local businesses.'
    },
    {
      limitation: 'Geographic Leakage',
      explanation: 'State-level analysis captures impacts within the state boundary. Spending that leaves the state (imports) generates impacts elsewhere not captured here.'
    }
  ];

  let limTechY = 0.9;
  technicalLimitations.forEach(l => {
    appendixD.addText(`• ${l.limitation}:`, {
      x: MARGIN, y: limTechY, w: 9.2, h: 0.22,
      fontSize: FONT.caption, fontFace: 'Helvetica', bold: true, color: COLORS.text
    });
    appendixD.addText(l.explanation, {
      x: MARGIN + 0.2, y: limTechY + 0.22, w: 9.0, h: 0.38,
      fontSize: FONT.caption, fontFace: 'Helvetica', color: COLORS.grayText
    });
    limTechY += 0.64;
  });

  appendixD.addText('Appropriate Uses', {
    x: MARGIN, y: 4.15, w: 4.5, h: 0.22,
    fontSize: FONT.body, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });
  appendixD.addText('Order-of-magnitude estimates, policy discussions, comparative analysis', {
    x: MARGIN, y: 4.38, w: 4.5, h: 0.32,
    fontSize: FONT.caption, fontFace: 'Helvetica', color: COLORS.grayText
  });

  appendixD.addText('Inappropriate Uses', {
    x: 5.2, y: 4.15, w: 4.5, h: 0.22,
    fontSize: FONT.body, fontFace: 'Helvetica', bold: true, color: COLORS.primary
  });
  appendixD.addText('Precise forecasting, investment decisions without professional advice, legal proceedings', {
    x: 5.2, y: 4.38, w: 4.5, h: 0.32,
    fontSize: FONT.caption, fontFace: 'Helvetica', color: COLORS.grayText
  });

  // ============================================================
  // BACK COVER: Contact / GP Consulting
  // ============================================================
  const backCover = pptx.addSlide();

  backCover.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: COLORS.navy } });
  backCover.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.04, fill: { color: COLORS.orange } });

  // GP Consulting header
  backCover.addText('GP CONSULTING', {
    x: 0.5, y: 1.4, w: 9, h: 0.6,
    fontSize: 36, fontFace: 'Helvetica', bold: true, color: COLORS.white, align: 'center'
  });

  backCover.addShape('line', {
    x: 3.5, y: 2.1, w: 3, h: 0,
    line: { color: COLORS.orange, width: 2 }
  });

  // Custom analysis CTA
  backCover.addText('For customized economic impact analysis tailored to your specific property, jurisdiction, or policy question, please contact:', {
    x: 1.0, y: 2.4, w: 8, h: 0.5,
    fontSize: FONT.section + 1, fontFace: 'Helvetica', color: COLORS.white, align: 'center'
  });

  backCover.addText(authorInfo.email || 'info@gamblingpolicy.com', {
    x: 0.5, y: 3.0, w: 9, h: 0.35,
    fontSize: FONT.section + 4, fontFace: 'Helvetica', bold: true, color: COLORS.orange, align: 'center'
  });

  // ============================================================
  // Generate and return
  // ============================================================
  const filename = `Economic_Impact_Report_${inputs.state.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;
  const blob = await pptx.write({ outputType: 'blob' });
  return { blob, filename: filename + '.pptx' };
}

/**
 * Download the generated PPTX
 */
export async function downloadPPTX(results, inputs, authorInfo) {
  const { blob, filename } = await generatePPTX(results, inputs, authorInfo);
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
