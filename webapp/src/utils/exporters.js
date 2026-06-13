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
  { key: 'employment', label: 'Employment (FTEs)' },
  { key: 'wages', label: 'Wages ($M)' },
  { key: 'tax', label: 'Taxes on Production ($M)' },
];

/** Build a CSV string capturing the headline analysis + breakdowns. */
export function buildResultsCSV(results, context = {}) {
  const { state, casinoName, propertyTypeLabel, gamingTaxResult, payrollTaxResult, householdTaxResult } = context;
  const rows = [];

  rows.push(['GEMS — Economic Impact Analysis']);
  rows.push(['Project', casinoName || '—']);
  rows.push(['State', state || '—']);
  rows.push(['Operation type', propertyTypeLabel || '—']);
  rows.push(['Generated', new Date().toISOString()]);
  rows.push([]);

  // Headline impact table
  rows.push(['Economic Impact', 'Direct', 'Indirect', 'Induced', 'Total', 'Multiplier']);
  for (const { key, label } of METRICS) {
    const t = results.totals[key];
    const mult = key === 'tax'
      ? (t.direct > 0 ? t.total / t.direct : '')
      : results.multipliers[key];
    rows.push([
      label,
      round(t.direct), round(t.indirect), round(t.induced), round(t.total),
      typeof mult === 'number' ? round(mult, 2) : '',
    ]);
  }
  rows.push([]);

  // Tax detail
  rows.push(['Tax Revenue', 'Direct', 'Indirect', 'Induced', 'Total']);
  if (gamingTaxResult) {
    rows.push(['Gaming Tax (GGR)', round(gamingTaxResult.amount), '', '', round(gamingTaxResult.amount)]);
  }
  const tx = results.totals.tax;
  if (tx.total > 0) rows.push(['Taxes on Production (TOPI)', round(tx.direct), round(tx.indirect), round(tx.induced), round(tx.total)]);
  if (payrollTaxResult?.total > 0) rows.push(['Payroll Taxes', round(payrollTaxResult.direct), round(payrollTaxResult.indirect), round(payrollTaxResult.induced), round(payrollTaxResult.total)]);
  if (householdTaxResult?.total > 0) rows.push(['Household Taxes', round(householdTaxResult.direct), round(householdTaxResult.indirect), round(householdTaxResult.induced), round(householdTaxResult.total)]);
  rows.push([]);

  // Revenue-stream breakdown
  if (results.byRevenue && results.byRevenue.length > 1) {
    rows.push(['Impact by Revenue Stream', 'Revenue ($M)', 'Output ($M)', 'GDP ($M)', 'Jobs (FTE)', 'Wages ($M)', 'Tax ($M)']);
    for (const r of results.byRevenue) {
      rows.push([r.label, round(r.revenue), round(r.output.total), round(r.gdp.total), round(r.employment.total), round(r.wages.total), round(r.tax.total)]);
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
