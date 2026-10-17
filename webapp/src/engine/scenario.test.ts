/**
 * End-to-end regression: the rebuilt engine against the pre-rebuild engine.
 * __fixtures__/legacy-scenarios.json records the old computeScenario (commit
 * 8a8a586) for 65 analyses: all 50 states plus property types, input modes,
 * observed data, tribal ownership, custom tax rates, dollar years and the
 * net-impact and construction modules. The old engine read multipliers
 * rounded to 4 or 6 decimals; the new engine computes them from the tables,
 * so results agree to that rounding, not bit for bit: supplier and induced
 * increments in the old data are differences of 4-decimal multipliers, which
 * carry up to 1e-4 of error per dollar of revenue.
 */
import { describe, expect, test } from 'vitest';
import legacy from './__fixtures__/legacy-scenarios.json';
import { loadModel, stateByName } from './data';
import { computeScenario, headline, type ScenarioResult } from './scenario';
import { migrate } from './share';
import { project, sweepGgr, sweepTaxRate } from './sensitivity';
import type { Effects, ImpactMetric } from './impact';

const REL = 3e-4;
/** Absolute tolerance per $M of revenue in the analysis. */
const ABS_PER_REVENUE = 1.2e-4;

function compare(actual: unknown, expected: unknown, path: string, errors: string[], abs: number) {
  if (typeof expected === 'number') {
    const a = actual as number;
    const d = Math.abs(a - expected);
    const rel = d / Math.max(Math.abs(expected), 1e-12);
    if (!(d <= abs || rel <= REL)) errors.push(`${path}: ${a} vs ${expected}`);
  } else if (Array.isArray(expected)) {
    const a = actual as unknown[];
    if (!Array.isArray(a) || a.length !== expected.length) { errors.push(`${path}: length ${a?.length} vs ${expected.length}`); return; }
    expected.forEach((e, i) => compare(a[i], e, `${path}[${i}]`, errors, abs));
  } else if (expected && typeof expected === 'object') {
    for (const [k, e] of Object.entries(expected)) compare((actual as Record<string, unknown>)?.[k], e, `${path}.${k}`, errors, abs);
  } else if (actual !== expected) {
    errors.push(`${path}: ${String(actual)} vs ${String(expected)}`);
  }
}

const eff = (e: Effects) => ({ direct: e.direct, indirect: e.indirect, induced: e.induced, total: e.total });
const metrics = (x: Record<ImpactMetric, Effects>) => ({
  output: eff(x.output), gdp: eff(x.gdp), employment: eff(x.jobs), fte: eff(x.fte),
  wages: eff(x.compensation), cashWages: eff(x.cashWages), tax: eff(x.topi),
});

/** The new result in the legacy summary shape. */
function legacyShape(r: ScenarioResult) {
  return {
    totals: metrics(r.totals),
    range: r.totals.jobsRange,
    wageAdjustment: r.payrollAdjustment,
    streams: r.streams.map((s) => ({ type: s.key, revenue: s.revenue, ...metrics(s.impact) })),
    gamingTax: r.gamingTax && { amount: r.gamingTax.amount, effectiveRate: r.gamingTax.effectiveRate, ggr: r.gamingTax.ggr },
    fiscal: {
      lines: r.fiscal.lines.map((l) => ({ key: l.key, level: l.level, direct: l.direct, indirect: l.indirect, induced: l.induced, total: l.total })),
      totals: r.fiscal.totals,
      incomeTaxMethod: r.fiscal.incomeTaxMethod,
    },
    net: r.net && { share: r.net.share, totals: metrics(r.net.totals) },
    construction: r.construction && {
      localSpend: r.construction.localSpend, annualJobs: r.construction.annualJobs,
      ...metrics(r.construction.impact), fiscal: r.construction.fiscal.totals,
    },
  };
}

async function modelFor(stateName: string) {
  return loadModel(stateByName(stateName)!.abbrev);
}

describe('rebuilt engine matches the pre-rebuild engine', () => {
  for (const c of legacy.cases) {
    test(c.id, async () => {
      const a = migrate(c.analysis)!;
      const r = computeScenario(a, await modelFor(a.state))!;
      const errors: string[] = [];
      const revenue = r.streams.reduce((s, x) => s + x.revenue, 0) + (r.construction?.localSpend ?? 0);
      compare(legacyShape(r), c.result, c.id, errors, ABS_PER_REVENUE * revenue);
      expect(errors).toEqual([]);
    });
  }

  test('sensitivity sweeps and projection', async () => {
    const a = migrate(legacy.cases[0].analysis)!;
    const model = await modelFor(a.state);
    const errors: string[] = [];
    const abs = ABS_PER_REVENUE * 1.4 * 900;
    const rename = (p: { output: number; gdp: number; jobs: number; compensation: number; gamingTax: number; totalTax: number }) =>
      ({ output: p.output, gdp: p.gdp, employment: p.jobs, wages: p.compensation, gamingTax: p.gamingTax, totalTax: p.totalTax });
    compare(sweepGgr(a, model).map((p) => ({ x: p.x, ...rename(p) })), legacy.sensitivity.ggr.map(({ label: _l, ...p }) => p), 'ggr', errors, abs);
    compare(sweepTaxRate(a, model).map((p) => ({ x: p.x, ...rename(p) })), legacy.sensitivity.taxRate, 'tax', errors, abs);
    compare(project(a, model, 5, 0.05).series.map((p) => ({ yearIndex: p.year - new Date().getFullYear() + 1, ggr: p.ggr, ...rename(p) })), legacy.sensitivity.projection, 'proj', errors, abs);
    expect(errors).toEqual([]);
    expect(headline(computeScenario(a, model)!).jobs).toBeGreaterThan(0);
  });
});
