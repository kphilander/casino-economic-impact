/**
 * Starter Template Generator - EKG Visual Style
 *
 * Creates a PPTX template with placeholder text like {state}, {total_output}, etc.
 * Users can download this, customize in PowerPoint, then upload back for filling.
 *
 * EKG Branding: Navy #003366 headers, Orange #F79608 accents, Aptos Light typography
 */

import pptxgen from 'pptxgenjs';

// EKG Professional color palette
const COLORS = {
  navy: '003366',         // Navy - header bars, primary elements, titles
  orange: 'F79608',       // Orange - accent stripes, callout borders, highlights
  darkGray: '404040',     // Dark Gray - body text
  lightGray: 'EEEEEE',    // Light Gray - info boxes background
  white: 'FFFFFF',        // White - backgrounds
  mediumGray: '666666',   // Medium Gray - secondary text
  lightText: '888888',    // Light text for source attributions
  tableBorder: 'CCCCCC'   // Table borders
};

/**
 * Generate a starter PPTX template with EKG styling and placeholders
 */
export async function generateStarterTemplate() {
  const pptx = new pptxgen();

  // Set presentation properties
  pptx.author = 'Economic Impact Calculator';
  pptx.title = 'Economic Impact Analysis Template';
  pptx.subject = 'Casino Gaming Economic Impact';

  // Define master slide with EKG styling - navy header with orange accent
  pptx.defineSlideMaster({
    title: 'CONTENT_SLIDE',
    background: { color: COLORS.white },
    objects: [
      // Navy header bar
      { rect: { x: 0, y: 0, w: '100%', h: 0.6, fill: { color: COLORS.navy } } },
      // Orange accent stripe under header
      { rect: { x: 0, y: 0.6, w: '100%', h: 0.08, fill: { color: COLORS.orange } } },
      // Navy footer bar
      { rect: { x: 0, y: 7.2, w: '100%', h: 0.3, fill: { color: COLORS.navy } } },
      // Footer text - document title
      { text: { text: 'Economic Impact Analysis', options: { x: 0.3, y: 7.22, w: 5, h: 0.26, fontSize: 8, fontFace: 'Aptos Light', color: COLORS.white } } },
      // Slide number in footer
      { text: { text: '{slideNumber}', options: { x: 9, y: 7.22, w: 0.5, h: 0.26, fontSize: 8, fontFace: 'Aptos Light', color: COLORS.white, align: 'right' } } }
    ]
  });

  // ============================================================
  // SLIDE 1: Cover Page
  // ============================================================
  const slide1 = pptx.addSlide();

  // Navy header bar (full width, taller for cover)
  slide1.addShape('rect', {
    x: 0, y: 0, w: '100%', h: 1.2,
    fill: { color: COLORS.navy }
  });

  // Orange accent stripe under header
  slide1.addShape('rect', {
    x: 0, y: 1.2, w: '100%', h: 0.1,
    fill: { color: COLORS.orange }
  });

  // Casino poker chip image from Unsplash (Photo by Kaysha)
  slide1.addImage({
    path: 'https://images.unsplash.com/photo-1518133683791-0b9de5a055f0?w=1200&q=80',
    x: 0.5, y: 1.5, w: 9, h: 2.2,
    sizing: { type: 'cover', w: 9, h: 2.2 }
  });

  // Main title - centered
  slide1.addText('ECONOMIC IMPACT ANALYSIS', {
    x: 0.5, y: 3.9, w: 9, h: 0.7,
    fontSize: 32, fontFace: 'Aptos Light', bold: true,
    color: COLORS.navy, align: 'center'
  });

  // Subtitle - Commercial Gaming Operations
  slide1.addText('Commercial Gaming Operations', {
    x: 0.5, y: 4.5, w: 9, h: 0.4,
    fontSize: 18, fontFace: 'Aptos Light',
    color: COLORS.darkGray, align: 'center'
  });

  // Orange decorative line
  slide1.addShape('line', {
    x: 3.5, y: 5, w: 3, h: 0,
    line: { color: COLORS.orange, width: 3 }
  });

  // State placeholder
  slide1.addText('{state}', {
    x: 0.5, y: 5.2, w: 9, h: 0.5,
    fontSize: 24, fontFace: 'Aptos Light', bold: true,
    color: COLORS.navy, align: 'center'
  });

  // Revenue placeholder
  slide1.addText('Total Revenue Analyzed: {total_revenue}', {
    x: 0.5, y: 5.7, w: 9, h: 0.35,
    fontSize: 14, fontFace: 'Aptos Light',
    color: COLORS.darkGray, align: 'center'
  });

  // Date placeholder
  slide1.addText('{date}', {
    x: 0.5, y: 6.05, w: 9, h: 0.3,
    fontSize: 12, fontFace: 'Aptos Light', italic: true,
    color: COLORS.mediumGray, align: 'center'
  });

  // Navy footer bar
  slide1.addShape('rect', {
    x: 0, y: 7.1, w: '100%', h: 0.4,
    fill: { color: COLORS.navy }
  });

  // Footer text - document title
  slide1.addText('Economic Impact Analysis | Casino Gaming Operations', {
    x: 0.3, y: 7.15, w: 9.4, h: 0.3,
    fontSize: 9, fontFace: 'Aptos Light',
    color: COLORS.white, align: 'center'
  });

  // ============================================================
  // SLIDE 2: Executive Summary
  // ============================================================
  const slide2 = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

  // Slide title
  slide2.addText('EXECUTIVE SUMMARY', {
    x: 0.5, y: 0.85, w: 9, h: 0.5,
    fontSize: 24, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  // KPI boxes with orange accents (2x2 grid)
  const kpiBoxWidth = 2.1;
  const kpiBoxHeight = 1.1;
  const kpiStartX = 0.5;
  const kpiStartY = 1.5;
  const kpiGap = 0.15;

  const kpiMetrics = [
    { value: '{total_output}', label: 'Total Output' },
    { value: '{total_jobs}', label: 'Jobs Supported' },
    { value: '{total_gdp}', label: 'GDP Contribution' },
    { value: '{output_multiplier}', label: 'Output Multiplier' }
  ];

  kpiMetrics.forEach((metric, i) => {
    const x = kpiStartX + (i % 2) * (kpiBoxWidth + kpiGap);
    const y = kpiStartY + Math.floor(i / 2) * (kpiBoxHeight + kpiGap);

    // Light gray box background
    slide2.addShape('rect', {
      x, y, w: kpiBoxWidth, h: kpiBoxHeight,
      fill: { color: COLORS.lightGray }
    });

    // Orange left accent bar
    slide2.addShape('rect', {
      x, y, w: 0.08, h: kpiBoxHeight,
      fill: { color: COLORS.orange }
    });

    // Value
    slide2.addText(metric.value, {
      x: x + 0.15, y: y + 0.15, w: kpiBoxWidth - 0.2, h: 0.5,
      fontSize: 20, fontFace: 'Aptos Light', bold: true,
      color: COLORS.navy, align: 'center'
    });

    // Label
    slide2.addText(metric.label, {
      x: x + 0.15, y: y + 0.7, w: kpiBoxWidth - 0.2, h: 0.3,
      fontSize: 10, fontFace: 'Aptos Light',
      color: COLORS.darkGray, align: 'center'
    });
  });

  // Summary text (right side)
  slide2.addText('This analysis estimates the economic contribution of casino gaming operations in {state}, based on {total_revenue} in total revenue.\n\nUsing Input-Output (IO) modeling methodology, we calculate the direct, indirect, and induced effects across output, GDP, employment, and labor income.', {
    x: 4.6, y: 1.5, w: 4.9, h: 1.6,
    fontSize: 11, fontFace: 'Aptos Light', color: COLORS.darkGray, valign: 'top'
  });

  // Gray info box with orange left border for callout quote
  slide2.addShape('rect', {
    x: 4.6, y: 3.3, w: 4.9, h: 0.9,
    fill: { color: COLORS.lightGray }
  });
  slide2.addShape('rect', {
    x: 4.6, y: 3.3, w: 0.08, h: 0.9,
    fill: { color: COLORS.orange }
  });
  slide2.addText('"For every dollar of direct economic output, additional economic activity is generated through supply chain and household spending effects."', {
    x: 4.8, y: 3.4, w: 4.6, h: 0.8,
    fontSize: 10, fontFace: 'Aptos Light', italic: true, color: COLORS.darkGray, valign: 'middle'
  });

  // Impact types section header
  slide2.addText('UNDERSTANDING ECONOMIC IMPACTS', {
    x: 0.5, y: 4.5, w: 9, h: 0.3,
    fontSize: 12, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  // Three impact type boxes
  const impactTypes = [
    { title: 'Direct Effects', desc: 'Jobs and output directly from casino operations ({direct_jobs} jobs)' },
    { title: 'Indirect Effects', desc: 'Supply chain activity - vendors, suppliers, utilities ({indirect_jobs} jobs)' },
    { title: 'Induced Effects', desc: 'Household consumption by workers ({induced_jobs} jobs)' }
  ];

  impactTypes.forEach((impact, i) => {
    const x = 0.5 + i * 3.1;

    // Orange bullet/marker
    slide2.addShape('rect', {
      x, y: 4.9, w: 0.08, h: 0.5,
      fill: { color: COLORS.orange }
    });

    slide2.addText(impact.title, {
      x: x + 0.15, y: 4.9, w: 2.85, h: 0.25,
      fontSize: 10, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
    });
    slide2.addText(impact.desc, {
      x: x + 0.15, y: 5.15, w: 2.85, h: 0.55,
      fontSize: 9, fontFace: 'Aptos Light', color: COLORS.mediumGray
    });
  });

  // Source attribution at bottom
  slide2.addText('Source: Input-Output Economic Modeling using EPA StateIO (2019)', {
    x: 0.5, y: 6.8, w: 9, h: 0.25,
    fontSize: 8, fontFace: 'Aptos Light', italic: true, color: COLORS.lightText
  });

  // ============================================================
  // SLIDE 3: Impact Breakdown with KPI Flow Diagram
  // ============================================================
  const slide3 = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

  slide3.addText('ECONOMIC IMPACT BY EFFECT TYPE', {
    x: 0.5, y: 0.85, w: 9, h: 0.5,
    fontSize: 24, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  // ===== KPI FLOW DIAGRAM =====
  // Horizontal flow: [Direct $X] + [Indirect $Y] + [Induced $Z] = [Total $W]
  const flowBoxWidth = 1.8;
  const flowBoxHeight = 1.0;
  const flowStartX = 0.5;
  const flowY = 1.5;
  const flowGap = 0.3;
  const plusWidth = 0.35;

  const flowData = [
    { label: 'DIRECT', value: '{direct_output}', color: COLORS.navy },
    { label: 'INDIRECT', value: '{indirect_output}', color: COLORS.mediumGray },
    { label: 'INDUCED', value: '{induced_output}', color: COLORS.mediumGray },
    { label: 'TOTAL', value: '{total_output}', color: COLORS.orange }
  ];

  flowData.forEach((item, i) => {
    const x = flowStartX + i * (flowBoxWidth + flowGap + (i < 3 ? plusWidth : 0));

    // Box with colored top border
    slide3.addShape('rect', {
      x, y: flowY, w: flowBoxWidth, h: flowBoxHeight,
      fill: { color: COLORS.lightGray },
      line: { color: COLORS.tableBorder, width: 0.5 }
    });

    // Colored top bar
    slide3.addShape('rect', {
      x, y: flowY, w: flowBoxWidth, h: 0.08,
      fill: { color: item.color }
    });

    // Label
    slide3.addText(item.label, {
      x, y: flowY + 0.15, w: flowBoxWidth, h: 0.25,
      fontSize: 9, fontFace: 'Aptos Light', bold: true,
      color: item.color, align: 'center'
    });

    // Value
    slide3.addText(item.value, {
      x, y: flowY + 0.45, w: flowBoxWidth, h: 0.4,
      fontSize: 16, fontFace: 'Aptos Light', bold: true,
      color: COLORS.darkGray, align: 'center'
    });

    // Plus sign or equals sign
    if (i < 2) {
      slide3.addText('+', {
        x: x + flowBoxWidth + 0.05, y: flowY + 0.25, w: plusWidth, h: 0.5,
        fontSize: 24, fontFace: 'Aptos Light', bold: true,
        color: COLORS.navy, align: 'center'
      });
    } else if (i === 2) {
      slide3.addText('=', {
        x: x + flowBoxWidth + 0.05, y: flowY + 0.25, w: plusWidth, h: 0.5,
        fontSize: 24, fontFace: 'Aptos Light', bold: true,
        color: COLORS.orange, align: 'center'
      });
    }
  });

  // ===== DETAILED RESULTS TABLE =====
  slide3.addText('DETAILED RESULTS', {
    x: 0.5, y: 2.8, w: 9, h: 0.35,
    fontSize: 14, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  const tableData = [
    ['Metric', 'Direct', 'Indirect', 'Induced', 'Total', 'Multiplier'],
    ['Output ($M)', '{direct_output}', '{indirect_output}', '{induced_output}', '{total_output}', '{output_multiplier}'],
    ['GDP ($M)', '{direct_gdp}', '{indirect_gdp}', '{induced_gdp}', '{total_gdp}', '{gdp_multiplier}'],
    ['Employment', '{direct_jobs}', '{indirect_jobs}', '{induced_jobs}', '{total_jobs}', '{employment_multiplier}'],
    ['Wages ($M)', '{direct_wages}', '{indirect_wages}', '{induced_wages}', '{total_wages}', '{wages_multiplier}']
  ];

  slide3.addTable(tableData, {
    x: 0.5, y: 3.2, w: 9, h: 2.2,
    fontFace: 'Aptos Light',
    fontSize: 10,
    color: COLORS.darkGray,
    border: { pt: 0.5, color: COLORS.tableBorder },
    colW: [1.8, 1.3, 1.3, 1.3, 1.3, 1.3],
    rowH: 0.4,
    fill: { color: COLORS.white },
    align: 'center',
    valign: 'middle'
  });

  // Style header row manually with navy background
  const colWidths = [1.8, 1.3, 1.3, 1.3, 1.3, 1.3];
  let headerX = 0.5;
  colWidths.forEach((width) => {
    slide3.addShape('rect', {
      x: headerX, y: 3.2, w: width, h: 0.4,
      fill: { color: COLORS.navy }
    });
    headerX += width;
  });

  // Re-add header text in white
  const headerLabels = ['Metric', 'Direct', 'Indirect', 'Induced', 'Total', 'Multiplier'];
  let headerTextX = 0.5;
  headerLabels.forEach((label, idx) => {
    slide3.addText(label, {
      x: headerTextX, y: 3.22, w: colWidths[idx], h: 0.36,
      fontSize: 10, fontFace: 'Aptos Light', bold: true,
      color: COLORS.white, align: 'center', valign: 'middle'
    });
    headerTextX += colWidths[idx];
  });

  // Orange accent on Total column header
  slide3.addShape('rect', {
    x: 0.5 + 1.8 + 1.3 + 1.3 + 1.3, y: 3.6, w: 1.3, h: 0.03,
    fill: { color: COLORS.orange }
  });

  // Source attribution
  slide3.addText('Source: EPA StateIO (2019), BLS QCEW (2023)', {
    x: 0.5, y: 6.8, w: 9, h: 0.25,
    fontSize: 8, fontFace: 'Aptos Light', italic: true, color: COLORS.lightText
  });

  // ============================================================
  // SLIDE 4: Methodology
  // ============================================================
  const slide4 = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

  slide4.addText('METHODOLOGY & DATA SOURCES', {
    x: 0.5, y: 0.85, w: 9, h: 0.5,
    fontSize: 24, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  // Left column - What is Economic Impact?
  slide4.addText('What is Economic Impact?', {
    x: 0.5, y: 1.5, w: 4.2, h: 0.3,
    fontSize: 14, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  const whatIsText = `Economic impact is a measure of the spending and employment associated with a business or industry within a defined geographic area.

This analysis uses Input-Output (IO) modeling to estimate three types of effects:

• Direct Effects: The initial spending and employment from casino operations

• Indirect Effects: Supply chain activity from vendors and suppliers

• Induced Effects: Household spending by employees`;

  slide4.addText(whatIsText, {
    x: 0.5, y: 1.85, w: 4.2, h: 2.3,
    fontSize: 10, fontFace: 'Aptos Light', color: COLORS.darkGray, valign: 'top'
  });

  // Right column - Data Sources
  slide4.addText('Data Sources', {
    x: 5, y: 1.5, w: 4.5, h: 0.3,
    fontSize: 14, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  const dataSources = [
    { name: 'EPA StateIO (2019)', desc: 'State-level Input-Output tables for 71 industry sectors' },
    { name: 'BLS QCEW (2023)', desc: 'State-specific employment and wage data by industry' },
    { name: 'BEA National IO Tables', desc: 'National industry relationships and coefficients' }
  ];

  let dsY = 1.85;
  dataSources.forEach((source) => {
    // Orange bullet
    slide4.addShape('rect', {
      x: 5, y: dsY + 0.05, w: 0.08, h: 0.35,
      fill: { color: COLORS.orange }
    });
    slide4.addText(source.name, {
      x: 5.15, y: dsY, w: 4.3, h: 0.25,
      fontSize: 10, fontFace: 'Aptos Light', bold: true, color: COLORS.darkGray
    });
    slide4.addText(source.desc, {
      x: 5.15, y: dsY + 0.25, w: 4.3, h: 0.25,
      fontSize: 9, fontFace: 'Aptos Light', color: COLORS.mediumGray
    });
    dsY += 0.55;
  });

  // Key Assumptions section
  slide4.addText('Key Assumptions & Limitations', {
    x: 0.5, y: 4.3, w: 9, h: 0.3,
    fontSize: 14, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  const limitations = [
    'IO models assume linear production functions and fixed input coefficients',
    'Multiplier effects assume no capacity constraints in the economy',
    'This analysis estimates gross impacts and does not account for substitution effects',
    'Results are based on state-level averages and may vary by local conditions'
  ];

  limitations.forEach((lim, i) => {
    slide4.addText(`${i + 1}. ${lim}`, {
      x: 0.5, y: 4.65 + i * 0.32, w: 9, h: 0.32,
      fontSize: 9, fontFace: 'Aptos Light', color: COLORS.mediumGray
    });
  });

  // Disclaimer box with orange left border
  slide4.addShape('rect', {
    x: 0.5, y: 5.9, w: 9, h: 0.85,
    fill: { color: COLORS.lightGray }
  });
  slide4.addShape('rect', {
    x: 0.5, y: 5.9, w: 0.08, h: 0.85,
    fill: { color: COLORS.orange }
  });
  slide4.addText('DISCLAIMER', {
    x: 0.7, y: 6, w: 1.5, h: 0.25,
    fontSize: 9, fontFace: 'Aptos Light', bold: true, color: COLORS.orange
  });
  slide4.addText('This analysis provides estimates based on Input-Output modeling assumptions and should be interpreted as indicative rather than definitive. Actual economic impacts will vary based on local conditions and other factors. This report is for informational purposes only.', {
    x: 0.7, y: 6.25, w: 8.6, h: 0.45,
    fontSize: 8, fontFace: 'Aptos Light', color: COLORS.darkGray
  });

  // ============================================================
  // SLIDE 5: APPENDIX A - Input-Output Framework
  // ============================================================
  const slideAppA = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

  slideAppA.addText('APPENDIX A: INPUT-OUTPUT FRAMEWORK', {
    x: 0.5, y: 0.85, w: 9, h: 0.5,
    fontSize: 24, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  // Left column - Leontief Model
  slideAppA.addText('The Leontief Input-Output Model', {
    x: 0.5, y: 1.5, w: 4.4, h: 0.3,
    fontSize: 14, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  const leontiefText = `Wassily Leontief developed Input-Output analysis in the 1930s (Nobel Prize 1973).

Fundamental equation:  X = (I - A)⁻¹ × Y

• X = Total output vector
• A = Technical coefficients matrix
• (I - A)⁻¹ = Leontief inverse matrix`;

  slideAppA.addText(leontiefText, {
    x: 0.5, y: 1.85, w: 4.4, h: 3.0,
    fontSize: 9, fontFace: 'Aptos Light', color: COLORS.darkGray, valign: 'top'
  });

  // Right column - Multiplier Types
  slideAppA.addText('Multiplier Types', {
    x: 5.1, y: 1.5, w: 4.4, h: 0.3,
    fontSize: 14, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  // Type I box
  slideAppA.addShape('rect', {
    x: 5.1, y: 1.9, w: 4.4, h: 1.1,
    fill: { color: COLORS.lightGray }
  });
  slideAppA.addShape('rect', {
    x: 5.1, y: 1.9, w: 0.08, h: 1.1,
    fill: { color: COLORS.mediumGray }
  });
  slideAppA.addText('TYPE I MULTIPLIERS', {
    x: 5.25, y: 1.95, w: 4.2, h: 0.25,
    fontSize: 10, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });
  slideAppA.addText('Direct + Indirect effects only\nCaptures inter-industry purchasing relationships\nDoes not include household consumption effects', {
    x: 5.25, y: 2.2, w: 4.2, h: 0.75,
    fontSize: 9, fontFace: 'Aptos Light', color: COLORS.darkGray
  });

  // Type II box
  slideAppA.addShape('rect', {
    x: 5.1, y: 3.1, w: 4.4, h: 1.1,
    fill: { color: COLORS.lightGray }
  });
  slideAppA.addShape('rect', {
    x: 5.1, y: 3.1, w: 0.08, h: 1.1,
    fill: { color: COLORS.orange }
  });
  slideAppA.addText('TYPE II MULTIPLIERS (Used in this analysis)', {
    x: 5.25, y: 3.15, w: 4.2, h: 0.25,
    fontSize: 10, fontFace: 'Aptos Light', bold: true, color: COLORS.orange
  });
  slideAppA.addText('Direct + Indirect + Induced effects\nIncludes household consumption spending\nProvides comprehensive economic impact measure', {
    x: 5.25, y: 3.4, w: 4.2, h: 0.75,
    fontSize: 9, fontFace: 'Aptos Light', color: COLORS.darkGray
  });

  // Technical coefficients explanation
  slideAppA.addText('Technical Coefficients Matrix (A)', {
    x: 0.5, y: 5.0, w: 9, h: 0.3,
    fontSize: 12, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });
  slideAppA.addText('The technical coefficients represent the amount of input from industry i required to produce one dollar of output in industry j. These coefficients are derived from national and state-level economic data and form the basis for calculating multiplier effects.', {
    x: 0.5, y: 5.3, w: 9, h: 0.6,
    fontSize: 9, fontFace: 'Aptos Light', color: COLORS.mediumGray
  });

  // Source
  slideAppA.addText('Reference: Leontief, W. (1936). "Quantitative Input and Output Relations in the Economic System of the United States." Review of Economics and Statistics.', {
    x: 0.5, y: 6.8, w: 9, h: 0.25,
    fontSize: 8, fontFace: 'Aptos Light', italic: true, color: COLORS.lightText
  });

  // ============================================================
  // SLIDE 6: APPENDIX B - Effect Types Explained
  // ============================================================
  const slideAppB = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

  slideAppB.addText('APPENDIX B: EFFECT TYPES EXPLAINED', {
    x: 0.5, y: 0.85, w: 9, h: 0.5,
    fontSize: 24, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  // Three effect type cards
  const effectTypes = [
    {
      title: 'DIRECT EFFECTS',
      color: COLORS.navy,
      desc: 'Initial economic activity from the industry under study.',
      examples: '• Casino employee wages\n• Direct vendor purchases',
      formula: 'Direct = Initial Expenditure'
    },
    {
      title: 'INDIRECT EFFECTS',
      color: COLORS.mediumGray,
      desc: 'Supply chain effects as businesses purchase from suppliers.',
      examples: '• Utility providers\n• Food distributors',
      formula: 'Indirect = Σ(aᵢⱼ × Xⱼ)'
    },
    {
      title: 'INDUCED EFFECTS',
      color: COLORS.orange,
      desc: 'Household spending from wages earned across industries.',
      examples: '• Retail spending by workers\n• Housing and services',
      formula: 'Induced = (Type II - Type I) × Direct'
    }
  ];

  effectTypes.forEach((effect, i) => {
    const y = 1.45 + i * 1.75;

    // Card background
    slideAppB.addShape('rect', {
      x: 0.5, y, w: 9, h: 1.6,
      fill: { color: COLORS.lightGray }
    });

    // Left color bar
    slideAppB.addShape('rect', {
      x: 0.5, y, w: 0.1, h: 1.6,
      fill: { color: effect.color }
    });

    // Title
    slideAppB.addText(effect.title, {
      x: 0.7, y: y + 0.05, w: 2.5, h: 0.3,
      fontSize: 11, fontFace: 'Aptos Light', bold: true, color: effect.color
    });

    // Description
    slideAppB.addText(effect.desc, {
      x: 0.7, y: y + 0.35, w: 4.0, h: 0.35,
      fontSize: 9, fontFace: 'Aptos Light', color: COLORS.darkGray
    });

    // Examples
    slideAppB.addText(effect.examples, {
      x: 0.7, y: y + 0.7, w: 4.0, h: 0.85,
      fontSize: 8, fontFace: 'Aptos Light', color: COLORS.mediumGray
    });

    // Formula box
    slideAppB.addShape('rect', {
      x: 5.0, y: y + 0.3, w: 4.3, h: 1.0,
      fill: { color: COLORS.white },
      line: { color: COLORS.tableBorder, width: 0.5 }
    });
    slideAppB.addText('Formula:', {
      x: 5.15, y: y + 0.4, w: 4.0, h: 0.25,
      fontSize: 8, fontFace: 'Aptos Light', bold: true, color: COLORS.mediumGray
    });
    slideAppB.addText(effect.formula, {
      x: 5.15, y: y + 0.65, w: 4.0, h: 0.5,
      fontSize: 10, fontFace: 'Aptos Light', color: COLORS.darkGray
    });
  });

  // Source
  slideAppB.addText('Source: Bureau of Economic Analysis, Input-Output Accounts Methodology', {
    x: 0.5, y: 6.8, w: 9, h: 0.25,
    fontSize: 8, fontFace: 'Aptos Light', italic: true, color: COLORS.lightText
  });

  // ============================================================
  // SLIDE 7: APPENDIX C - Data Sources & Limitations
  // ============================================================
  const slideAppC = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

  slideAppC.addText('APPENDIX C: DATA SOURCES & LIMITATIONS', {
    x: 0.5, y: 0.85, w: 9, h: 0.5,
    fontSize: 24, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  // Data Sources section
  const dataSourcesDetail = [
    {
      name: 'EPA State Input-Output Tables (2019)',
      details: '• 71 industry sectors per state\n• State-specific technical coefficients'
    },
    {
      name: 'BLS Quarterly Census of Employment & Wages (2023)',
      details: '• State-level employment by NAICS\n• Used for employment ratios'
    },
    {
      name: 'BEA National IO Accounts (2017)',
      details: '• Commodity-by-industry tables\n• Gambling-specific coefficients'
    }
  ];

  let dsDetailY = 1.4;
  dataSourcesDetail.forEach((source) => {
    slideAppC.addShape('rect', {
      x: 0.5, y: dsDetailY, w: 0.08, h: 0.9,
      fill: { color: COLORS.orange }
    });
    slideAppC.addText(source.name, {
      x: 0.65, y: dsDetailY, w: 8.8, h: 0.25,
      fontSize: 10, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
    });
    slideAppC.addText(source.details, {
      x: 0.65, y: dsDetailY + 0.25, w: 8.8, h: 0.65,
      fontSize: 8, fontFace: 'Aptos Light', color: COLORS.mediumGray
    });
    dsDetailY += 1.0;
  });

  // Industry Classification section
  slideAppC.addText('Industry Classification (NAICS)', {
    x: 0.5, y: 4.5, w: 9, h: 0.3,
    fontSize: 12, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  // NAICS table
  const naicsData = [
    ['Code', 'Description', 'Coverage'],
    ['NAICS 7132', 'Gambling Industries', 'Casinos, racetracks, lotteries, online gambling'],
    ['NAICS 713', 'Amusement, Gambling & Recreation', 'Broader category including theme parks, sports']
  ];

  slideAppC.addTable(naicsData, {
    x: 0.5, y: 4.85, w: 9, h: 0.9,
    fontFace: 'Aptos Light',
    fontSize: 9,
    color: COLORS.darkGray,
    border: { pt: 0.5, color: COLORS.tableBorder },
    colW: [1.5, 3.0, 4.5],
    rowH: 0.3,
    fill: { color: COLORS.white },
    align: 'left',
    valign: 'middle'
  });

  // Key Limitations box
  slideAppC.addShape('rect', {
    x: 0.5, y: 5.9, w: 9, h: 0.85,
    fill: { color: COLORS.lightGray }
  });
  slideAppC.addShape('rect', {
    x: 0.5, y: 5.9, w: 0.08, h: 0.85,
    fill: { color: COLORS.orange }
  });
  slideAppC.addText('KEY LIMITATIONS', {
    x: 0.65, y: 5.95, w: 2, h: 0.25,
    fontSize: 9, fontFace: 'Aptos Light', bold: true, color: COLORS.orange
  });
  slideAppC.addText('1. Static model assumes fixed production relationships  2. No capacity constraints considered  3. Gross impacts only (no substitution/displacement)  4. Aggregate industry averages may not reflect specific firms', {
    x: 0.65, y: 6.2, w: 8.7, h: 0.5,
    fontSize: 8, fontFace: 'Aptos Light', color: COLORS.darkGray
  });

  // ============================================================
  // SLIDE 8: About the Author
  // ============================================================
  const slide5 = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

  slide5.addText('ABOUT THE AUTHOR', {
    x: 0.5, y: 0.85, w: 9, h: 0.5,
    fontSize: 24, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  // Photo placeholder with orange border accent
  slide5.addShape('rect', {
    x: 0.5, y: 1.5, w: 2.5, h: 3,
    fill: { color: COLORS.lightGray },
    line: { color: COLORS.tableBorder, width: 1 }
  });
  // Orange accent on left of photo
  slide5.addShape('rect', {
    x: 0.5, y: 1.5, w: 0.08, h: 3,
    fill: { color: COLORS.orange }
  });
  slide5.addText('[Photo]', {
    x: 0.5, y: 2.8, w: 2.5, h: 0.4,
    fontSize: 12, fontFace: 'Aptos Light', italic: true,
    color: COLORS.mediumGray, align: 'center', valign: 'middle'
  });

  // Author name placeholder
  slide5.addText('{author_name}', {
    x: 3.3, y: 1.5, w: 6.2, h: 0.45,
    fontSize: 20, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  // Title placeholder
  slide5.addText('{author_title}', {
    x: 3.3, y: 1.95, w: 6.2, h: 0.35,
    fontSize: 12, fontFace: 'Aptos Light', color: COLORS.darkGray
  });

  // Institution placeholder
  slide5.addText('{author_institution}', {
    x: 3.3, y: 2.3, w: 6.2, h: 0.3,
    fontSize: 11, fontFace: 'Aptos Light', color: COLORS.mediumGray
  });

  // Bio text placeholder
  slide5.addText('{author_bio}', {
    x: 3.3, y: 2.75, w: 6.2, h: 1.75,
    fontSize: 10, fontFace: 'Aptos Light', color: COLORS.darkGray, valign: 'top'
  });

  // Contact info section with orange header bar
  slide5.addShape('rect', {
    x: 0.5, y: 4.7, w: 9, h: 0.06,
    fill: { color: COLORS.orange }
  });

  slide5.addText('Contact Information', {
    x: 0.5, y: 4.85, w: 9, h: 0.3,
    fontSize: 12, fontFace: 'Aptos Light', bold: true, color: COLORS.navy
  });

  slide5.addText('Email: {author_email}', {
    x: 0.5, y: 5.2, w: 4.5, h: 0.25,
    fontSize: 10, fontFace: 'Aptos Light', color: COLORS.darkGray
  });

  // ============================================================
  // SLIDE 6: Section Divider / Closing - Thank You
  // ============================================================
  const slideBack = pptx.addSlide();

  // Large navy background covering most of slide
  slideBack.addShape('rect', {
    x: 0, y: 0, w: '100%', h: 5.5,
    fill: { color: COLORS.navy }
  });

  // Orange accent stripe at bottom of navy section
  slideBack.addShape('rect', {
    x: 0, y: 5.5, w: '100%', h: 0.12,
    fill: { color: COLORS.orange }
  });

  // "Thank You" text - large, centered
  slideBack.addText('Thank You', {
    x: 0.5, y: 2.0, w: 9, h: 0.9,
    fontSize: 44, fontFace: 'Aptos Light', bold: true,
    color: COLORS.white, align: 'center'
  });

  // Orange decorative line
  slideBack.addShape('line', {
    x: 3.8, y: 3.0, w: 2.4, h: 0,
    line: { color: COLORS.orange, width: 3 }
  });

  // Contact email
  slideBack.addText('{author_email}', {
    x: 0.5, y: 3.4, w: 9, h: 0.4,
    fontSize: 16, fontFace: 'Aptos Light',
    color: COLORS.white, align: 'center'
  });

  // Institution
  slideBack.addText('{author_institution}', {
    x: 0.5, y: 3.85, w: 9, h: 0.35,
    fontSize: 12, fontFace: 'Aptos Light',
    color: COLORS.lightGray, align: 'center'
  });

  // Lower section - white background for sources
  slideBack.addShape('rect', {
    x: 0, y: 5.62, w: '100%', h: 1.88,
    fill: { color: COLORS.white }
  });

  // Data sources attribution (italic gray)
  slideBack.addText('Data Sources & Methodology', {
    x: 0.5, y: 5.8, w: 9, h: 0.25,
    fontSize: 10, fontFace: 'Aptos Light', bold: true, color: COLORS.darkGray, align: 'center'
  });

  slideBack.addText('EPA StateIO (2019) | BLS QCEW (2023) | BEA National IO Tables\nInput-Output Economic Modeling with Type II Multipliers', {
    x: 0.5, y: 6.1, w: 9, h: 0.5,
    fontSize: 9, fontFace: 'Aptos Light', italic: true, color: COLORS.mediumGray, align: 'center'
  });

  // Disclaimer footer
  slideBack.addText('This report was generated using the Casino Economic Impact Calculator. Results are estimates based on Input-Output modeling and should be interpreted as indicative rather than definitive.', {
    x: 0.8, y: 6.7, w: 8.4, h: 0.5,
    fontSize: 7, fontFace: 'Aptos Light', italic: true, color: COLORS.lightText, align: 'center'
  });

  // Generate and return
  const blob = await pptx.write({ outputType: 'blob' });
  return { blob, filename: 'Economic_Impact_Template.pptx' };
}

/**
 * Download the starter template
 */
export async function downloadStarterTemplate() {
  const { blob, filename } = await generateStarterTemplate();

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
