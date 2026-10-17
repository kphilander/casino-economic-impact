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

/**
 * Whether the tribal treatment actually removed the gaming stream's direct
 * TOPI, read from the bundle's own output. It does not when revenue was
 * entered in total, because the gaming stream cannot be separated.
 */
export function tribalTopiRemoved(results, fiscal) {
  const topi = fiscal.lines.find(l => l.key === 'topi');
  return !!topi && results.totals.tax.direct - topi.direct > 1e-9;
}

export const TRIBAL_UNADJUSTED_NOTE = 'Tribal ownership, but revenue was entered in total, so the gaming stream cannot be separated: no compact revenue share is estimated and production taxes are not adjusted for trust-land exemptions, so they may overstate state and local taxes. Enter revenue by department to apply the tribal treatment.';

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
  // Direct-jobs basis and the 90% predictive interval from the QCEW validation
  const emp = results.totals.employment;
  if (emp.detail) {
    const d = emp.detail;
    rows.push(['Employment basis', emp.basis === 'calibrated'
      ? 'Direct jobs calibrated to observed QCEW casino labor intensity; supplier and induced jobs as modeled'
      : 'Direct jobs from the I-O coefficient (not calibrated); supplier and induced jobs as modeled']);
    rows.push(['Jobs, 90% predictive interval', 'Low', 'High', 'I-O coefficient', 'Calibrated to QCEW']);
    rows.push(['Direct jobs', round(d.range.direct[0], 0), round(d.range.direct[1], 0), round(d.model.direct, 0), round(d.calibrated.direct, 0)]);
    rows.push(['Total jobs', round(d.range.total[0], 0), round(d.range.total[1], 0), round(d.model.total, 0), round(d.calibrated.total, 0)]);
    rows.push(['Interval from a 50-state validation of direct jobs against BLS QCEW (2023)']);
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
      : tribalTopiRemoved(results, fiscal)
        ? 'Tribal gaming on trust land pays no state gaming, sales or property taxes: the gaming stream\'s direct TOPI is excluded and no compact revenue share was entered'
        : TRIBAL_UNADJUSTED_NOTE]);
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
