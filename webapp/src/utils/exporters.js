/**
 * Lightweight exporters — CSV (opens in Excel) and print-to-PDF.
 *
 * These reuse the in-memory `results` object and the same formatting the UI
 * shows, so a downloaded spreadsheet matches the dashboard exactly. PPTX
 * export remains in pptxGenerator.js; this adds the lighter-weight formats.
 */

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

const METRICS = [
  { key: 'output', label: 'Output ($M)' },
  { key: 'gdp', label: 'GDP ($M)' },
  { key: 'employment', label: 'Employment (jobs)' },
  { key: 'fte', label: 'Estimated FTEs' },
  { key: 'wages', label: 'Employee Compensation ($M)' },
];

/** Level-of-government labels for fiscal lines (shared by every exporter). */
export const LEVEL_LABEL = { federal: 'Federal', state_local: 'State & local' };

/**
 * Fiscal lines for the exporters: computeScenario's `fiscal` bundle, which
 * every caller must pass so the reports follow the fiscal policy in fiscal.js
 * (gaming-share TOPI replacement, tribal compact treatment) rather than a copy.
 */
export function reportFiscal(results, { fiscal } = {}) {
  if (!fiscal?.lines?.length) {
    throw new Error('report inputs must include the fiscal bundle from computeScenario');
  }
  return fiscal;
}

/** One-line note on the direct-jobs range, shared by the exporters. */
export const JOBS_RANGE_NOTE = 'Direct jobs use the I-O coefficient. Compared state by state with the 2022 Economic Census, the coefficient\'s jobs per dollar of revenue show no bias at casinos; the 90% range reflects the variation across states. Supplier and induced jobs are as modeled.';

/** "40% non-resident + 60% resident x 20% recaptured = 52.0%" for net-impact notes. */
export function describeNetShare(netImpact, share, times = '×') {
  const nonRes = Math.min(100, Math.max(0, Number(netImpact?.nonResidentShare) || 0));
  const recap = Math.min(100, Math.max(0, Number(netImpact?.recaptureShare) || 0));
  return `${round(nonRes, 0)}% non-resident + ${round(100 - nonRes, 0)}% resident ${times} ${round(recap, 0)}% recaptured from out of state = ${round(share * 100, 1)}%`;
}

/** Build a CSV string capturing the headline analysis + breakdowns. */
export function buildResultsCSV(results, context = {}) {
  const { state, casinoName, propertyTypeLabel, net, netImpact, constructionResult, analysisYear, ownership } = context;
  const tribal = ownership === 'tribal';
  const rows = [];

  rows.push(['GEMS — Economic Impact Analysis']);
  rows.push(['Project', casinoName || '—']);
  rows.push(['State', state || '—']);
  rows.push(['Operation type', propertyTypeLabel || '—']);
  if (tribal) rows.push(['Ownership', 'Tribal (compact)']);
  if (analysisYear) {
    rows.push(['Dollar year', analysisYear, `Revenue inputs and dollar results are in ${analysisYear} dollars; revenue is deflated to 2023 dollars (CPI-U) before the 2023 employment coefficients are applied`]);
  }
  rows.push(['Generated', new Date().toISOString()]);
  rows.push([]);

  // Headline impact table
  rows.push(['Economic Impact', 'Direct', 'Indirect', 'Induced', 'Total', 'Multiplier']);
  for (const { key, label } of METRICS) {
    const t = results.totals[key];
    const mult = results.multipliers[key];
    rows.push([
      label,
      round(t.direct), round(t.indirect), round(t.induced), round(t.total),
      typeof mult === 'number' ? round(mult, 2) : '',
    ]);
  }
  // 90% range for direct and total jobs (land-based commercial casinos only)
  const jobsRange = results.totals.employment.detail?.range;
  if (jobsRange) {
    rows.push(['Jobs, 90% range', 'Low', 'High']);
    rows.push(['Direct jobs', round(jobsRange.direct[0], 0), round(jobsRange.direct[1], 0)]);
    rows.push(['Total jobs', round(jobsRange.total[0], 0), round(jobsRange.total[1], 0)]);
    rows.push([JOBS_RANGE_NOTE]);
  }
  rows.push([]);

  // Tax detail: one row per fiscal line, then subtotals by level of government
  const fiscal = reportFiscal(results, context);
  const vals = (v) => [round(v.direct), round(v.indirect), round(v.induced), round(v.total)];
  rows.push(['Tax Revenue ($M)', 'Level', 'Direct', 'Indirect', 'Induced', 'Total', 'Note']);
  for (const l of fiscal.lines) {
    rows.push([l.label, LEVEL_LABEL[l.level] || '', ...vals(l), l.note || '']);
  }
  rows.push(['Federal', '', ...vals(fiscal.totals.federal)]);
  rows.push(['State & local', '', ...vals(fiscal.totals.stateLocal)]);
  rows.push(['Total tax revenue', '', ...vals(fiscal.totals.all)]);
  if (tribal) {
    rows.push([fiscal.lines.some(l => l.key === 'gaming')
      ? 'Tribal gaming on trust land pays compact revenue sharing instead of state gaming, sales and property taxes: the revenue share replaces the gaming stream\'s direct TOPI, so every line is additive'
      : 'Tribal gaming on trust land pays no state gaming, sales or property taxes: the gaming stream\'s direct TOPI is excluded and no compact revenue share is estimated']);
  } else if (fiscal.lines.some(l => l.key === 'gaming')) {
    rows.push(['The statutory gaming tax replaces the gaming share of direct TOPI, so every line is additive']);
  }
  if (fiscal.incomeTaxMethod === 'per_worker') {
    rows.push(['Household income taxes apply 2025 federal and state schedules to the average cash wage per job (single filer, no dependents)']);
  } else if (fiscal.incomeTaxMethod === 'bea_ratio') {
    rows.push(['Household taxes use the BEA ratio of personal current taxes to wages (no state schedule); federal, state and local are combined and counted under State & local']);
  }
  rows.push([]);

  // Net new impact (gross contribution scaled by the net-new share)
  if (net) {
    rows.push(['Net new impact']);
    rows.push(['Net new share', `${round(net.share * 100, 1)}%`, describeNetShare(netImpact, net.share, 'x')]);
    rows.push(['Total impact', 'Gross contribution', 'Net new']);
    for (const { key, label } of METRICS.filter(m => m.key !== 'tax')) {
      rows.push([label, round(results.totals[key].total), round(net.totals[key].total)]);
    }
    rows.push(['Net figures approximate what the state would lose without the activity; the remainder is treated as displaced in-state spending. Neither gross nor net figures account for social costs. Tax estimates are gross.']);
    rows.push([]);
  }

  // One-time construction phase (StateIO construction, sector 23)
  if (constructionResult) {
    const c = constructionResult;
    rows.push(['Construction phase (one-time)']);
    rows.push(['Construction cost ($M)', round(c.cost)]);
    rows.push(['In-state construction spending ($M)', round(c.localSpend)]);
    rows.push(['Build period (years)', c.years]);
    rows.push(['Construction Impact', 'Direct', 'Indirect', 'Induced', 'Total']);
    rows.push(['Output ($M)', ...vals(c.output)]);
    rows.push(['GDP ($M)', ...vals(c.gdp)]);
    rows.push(['Employment (job-years)', ...vals(c.employment)]);
    rows.push(['Employee Compensation ($M)', ...vals(c.wages)]);
    if (c.fiscal) {
      rows.push(['Tax revenue, federal ($M)', ...vals(c.fiscal.totals.federal)]);
      rows.push(['Tax revenue, state & local ($M)', ...vals(c.fiscal.totals.stateLocal)]);
      rows.push(['Tax revenue, total ($M)', ...vals(c.fiscal.totals.all)]);
    }
    rows.push(['Average jobs per year of build', round(c.annualJobs, 0)]);
    rows.push(['Construction jobs are job-years and temporary; they are not added to the operating impact']);
    rows.push([]);
  }

  // Revenue-stream breakdown
  if (results.byRevenue && results.byRevenue.length > 1) {
    rows.push(['Impact by Revenue Stream', 'Revenue ($M)', 'Output ($M)', 'GDP ($M)', 'Jobs', 'Estimated FTEs', 'Employee Compensation ($M)', 'I-O TOPI before gaming-tax adjustment ($M)']);
    for (const r of results.byRevenue) {
      rows.push([r.label, round(r.revenue), round(r.output.total), round(r.gdp.total), round(r.employment.total), round(r.fte.total), round(r.wages.total), round(r.tax.total)]);
    }
  }

  return toCSV(rows);
}

function round(v, dp = 1) {
  if (v == null || isNaN(v)) return '';
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}

export function downloadCSV(filename, csv) {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Trigger the browser print dialog (the @media print styles render a clean,
 *  report-grade layout the user can "Save as PDF"). */
export function printReport() {
  window.print();
}

/** Slugify a project name for filenames. */
export function slugify(name, fallback = 'gems-analysis') {
  const s = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || fallback;
}
