/**
 * Sensitivity sweeps and multi-year projections.
 *
 * Both recompute the full model at each point (rather than scaling a single
 * result) so non-linearities — tiered gaming taxes, per-employee payroll caps
 * — are captured correctly.
 */
import { computeScenario, headlineMetrics } from './computeScenario';

const GGR_KEY = (a) => (a.inputMode === 'total' ? 'total' : 'gaming');

/** Base gross gaming revenue for an analysis. */
export function baseGGR(analysis) {
  return analysis.revenues?.[GGR_KEY(analysis)] || 0;
}

/** Return a copy of the analysis with GGR scaled by `factor`. */
function scaleGGR(analysis, factor) {
  const key = GGR_KEY(analysis);
  const revenues = { ...analysis.revenues };
  const base = revenues[key] || 0;
  revenues[key] = base * factor;
  // keep gaming/total mirrored for online single-stream operations
  if (key === 'gaming' && analysis.revenues.total != null) revenues.total = revenues.gaming;
  return { ...analysis, revenues };
}

/**
 * Sweep a driver across a range and return headline metrics at each point.
 *
 * driver: 'ggr' varies revenue ±range; 'taxRate' varies the gaming tax rate
 * across absolute percentages.
 */
export function runSensitivity(analysis, { driver = 'ggr', spread = 0.4, steps = 9, maxTaxRate = 0.4 } = {}) {
  const series = [];

  if (driver === 'taxRate') {
    for (let i = 0; i < steps; i++) {
      const rate = (maxTaxRate * i) / (steps - 1);
      const variant = { ...analysis, gamingTaxCustomRate: rate };
      const m = headlineMetrics(computeScenario(variant));
      if (m) series.push({ x: rate, label: `${(rate * 100).toFixed(0)}%`, ...m });
    }
    return { driver, series };
  }

  // GGR sweep
  const base = baseGGR(analysis);
  for (let i = 0; i < steps; i++) {
    const factor = 1 - spread + (2 * spread * i) / (steps - 1);
    const m = headlineMetrics(computeScenario(scaleGGR(analysis, factor)));
    if (m) series.push({ x: base * factor, factor, label: `${Math.round(factor * 100)}%`, ...m });
  }
  return { driver, series, base };
}

/**
 * Project the analysis forward `years` at a compound annual growth rate.
 * Year 1 = current inputs; each subsequent year scales GGR by (1+cagr).
 */
export function runProjection(analysis, { years = 5, cagr = 0.08 } = {}) {
  const series = [];
  const startYear = new Date().getFullYear();
  for (let y = 0; y < years; y++) {
    const factor = Math.pow(1 + cagr, y);
    const m = headlineMetrics(computeScenario(scaleGGR(analysis, factor)));
    if (m) series.push({ year: startYear + y, yearIndex: y + 1, ggr: baseGGR(analysis) * factor, ...m });
  }
  const cumulative = series.reduce((acc, s) => {
    acc.output += s.output; acc.gdp += s.gdp; acc.wages += s.wages; acc.totalTax += s.totalTax;
    return acc;
  }, { output: 0, gdp: 0, wages: 0, totalTax: 0 });
  return { series, cumulative };
}

export const METRIC_META = [
  { key: 'output', label: 'Output', unit: '$M' },
  { key: 'gdp', label: 'GDP', unit: '$M' },
  { key: 'employment', label: 'Employment', unit: 'FTE' },
  { key: 'wages', label: 'Wages', unit: '$M' },
  { key: 'totalTax', label: 'Total Tax', unit: '$M' },
];
