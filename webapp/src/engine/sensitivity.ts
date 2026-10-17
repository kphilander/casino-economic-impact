/**
 * Sensitivity sweeps and multi-year projections. Each point recomputes the
 * full scenario, so tiered gaming taxes, per-worker tax caps and the payroll
 * adjustment respond correctly.
 */
import type { RegionalModel } from './io';
import { computeScenario, headline, type Analysis, type Headline } from './scenario';

const ggrKey = (a: Analysis) => (a.inputMode === 'total' ? 'total' : 'gaming');

export const baseGgr = (a: Analysis): number => a.revenue[ggrKey(a)] ?? 0;

function withGgr(a: Analysis, factor: number): Analysis {
  const key = ggrKey(a);
  return { ...a, revenue: { ...a.revenue, [key]: (a.revenue[key] ?? 0) * factor } };
}

export interface SweepPoint extends Headline { x: number; label: string }

/** Gaming revenue from (1 - spread) to (1 + spread) of the base. */
export function sweepGgr(a: Analysis, model: RegionalModel, spread = 0.4, steps = 9): SweepPoint[] {
  const out: SweepPoint[] = [];
  for (let i = 0; i < steps; i++) {
    const factor = 1 - spread + (2 * spread * i) / (steps - 1);
    const r = computeScenario(withGgr(a, factor), model);
    if (r) out.push({ x: baseGgr(a) * factor, label: `${Math.round(factor * 100)}%`, ...headline(r) });
  }
  return out;
}

/** Gaming tax rate from 0 to maxRate, as a custom rate on GGR. */
export function sweepTaxRate(a: Analysis, model: RegionalModel, maxRate = 0.4, steps = 9): SweepPoint[] {
  const out: SweepPoint[] = [];
  for (let i = 0; i < steps; i++) {
    const rate = (maxRate * i) / (steps - 1);
    const r = computeScenario({ ...a, gamingTax: { ...a.gamingTax, customRate: rate } }, model);
    if (r) out.push({ x: rate, label: `${(rate * 100).toFixed(0)}%`, ...headline(r) });
  }
  return out;
}

export interface ProjectionPoint extends Headline { year: number; ggr: number }

/** GGR grows at a compound annual rate from the first year; other revenue is held. */
export function project(a: Analysis, model: RegionalModel, years = 5, cagr = 0.03, startYear = new Date().getFullYear()): { series: ProjectionPoint[]; cumulative: Omit<Headline, 'jobs'> } {
  const series: ProjectionPoint[] = [];
  for (let y = 0; y < years; y++) {
    const factor = (1 + cagr) ** y;
    const r = computeScenario(withGgr(a, factor), model);
    if (r) series.push({ year: startYear + y, ggr: baseGgr(a) * factor, ...headline(r) });
  }
  const cumulative = series.reduce((acc, s) => ({
    output: acc.output + s.output, gdp: acc.gdp + s.gdp, compensation: acc.compensation + s.compensation,
    gamingTax: acc.gamingTax + s.gamingTax, totalTax: acc.totalTax + s.totalTax,
  }), { output: 0, gdp: 0, compensation: 0, gamingTax: 0, totalTax: 0 });
  return { series, cumulative };
}
