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
import legacySatellite from './__fixtures__/legacy-satellite.json';
import { NATIONAL, stateByName } from './data';
import { computeScenario, headline, type ScenarioResult } from './scenario';
import { migrate } from './share';
import { project, sweepGgr, sweepTaxRate } from './sensitivity';
import type { Effects, ImpactMetric } from './impact';
import type { Fiscal } from './fiscal';
import { buildModel, EFFECTS, type Effect, type RegionalModel, type StateTables } from './io';

/**
 * FTEs are left out of the comparison: the BEA FTE/job ratios were refreshed
 * (September 2026 revisions) after the fixture was recorded. io.test.ts checks
 * the engine's FTEs against the regenerated R outputs.
 *
 * The fixture also predates the household spending share of the Type II
 * closure (October 2026), so the comparison uses the earlier closure
 * (withHouseholdSpending('legacy')). io.test.ts checks the current closure
 * against the R outputs.
 */
function withoutFte(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(withoutFte);
  if (x && typeof x === 'object') {
    return Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'fte').map(([k, v]) => [k, withoutFte(v)]));
  }
  return x;
}

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

/**
 * The fixture predates the employee halves of Social Security and Medicare
 * (October 2026), so they are taken out of the federal payroll line and the
 * totals before the comparison. rules.test.ts checks the employee taxes.
 */
function withoutEmployeeFica(f: Fiscal) {
  const emp = Object.fromEntries(EFFECTS.map((e) => [e, f.basis.effects[e].payroll.employee])) as Record<Effect, number>;
  const empTotal = EFFECTS.reduce((s, e) => s + emp[e], 0);
  const less = (x: Effects) => ({ direct: x.direct - emp.direct, indirect: x.indirect - emp.indirect, induced: x.induced - emp.induced, total: x.total - empTotal });
  return {
    lines: f.lines.map((l) => {
      const v = l.key === 'payroll_federal' ? less(l) : l;
      return { key: l.key, level: l.level, direct: v.direct, indirect: v.indirect, induced: v.induced, total: v.total };
    }),
    totals: { all: less(f.totals.all), federal: less(f.totals.federal), stateLocal: f.totals.stateLocal },
  };
}
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
    fiscal: { ...withoutEmployeeFica(r.fiscal), incomeTaxMethod: r.fiscal.incomeTaxMethod },
    net: r.net && { share: r.net.share, totals: metrics(r.net.totals) },
    construction: r.construction && {
      localSpend: r.construction.localSpend, annualJobs: r.construction.annualJobs,
      ...metrics(r.construction.impact), fiscal: withoutEmployeeFica(r.construction.fiscal).totals,
    },
  };
}

/**
 * The fixture also predates the corrections of the jobs satellite (November
 * 2026; scripts/employment_satellite.R): the division of 2023 retail output
 * among 441, 445, 452 and 4A0, and the jobs filled for suppressed QCEW cells.
 * The comparison therefore puts back the earlier satellite (the StateIO retail
 * output of legacy-satellite.json and zero jobs for the filled cells).
 * io.test.ts checks the current satellite against the R outputs.
 *
 * It also predates the national gaming rate for direct jobs (November 2026),
 * so the comparison keeps the state coefficient ({ directJobs: 'coefficient' }).
 * rules.test.ts checks the rate.
 */
const tableLoaders = import.meta.glob<StateTables>('../data/io/[A-Z][A-Z].json', { import: 'default' });
const legacyModels = new Map<string, Promise<RegionalModel>>();

function modelFor(stateName: string): Promise<RegionalModel> {
  const abbrev = stateByName(stateName)!.abbrev;
  let m = legacyModels.get(abbrev);
  if (!m) {
    m = tableLoaders[`../data/io/${abbrev}.json`]().then((t) => {
      const index = (code: string) => NATIONAL.industries.findIndex((i) => i.code === code);
      const output2023 = [...t.output2023];
      const jobs2023 = [...t.jobs2023];
      const retail = (legacySatellite.output2023 as Record<string, Record<string, number>>)[abbrev];
      for (const [code, v] of Object.entries(retail)) output2023[index(code)] = v;
      for (const code of t.jobsImputed ?? []) jobs2023[index(code)] = 0;
      return buildModel({ ...t, output2023, jobs2023 }, NATIONAL, 'legacy');
    });
    legacyModels.set(abbrev, m);
  }
  return m;
}

describe('rebuilt engine matches the pre-rebuild engine', () => {
  for (const c of legacy.cases) {
    test(c.id, async () => {
      const a = migrate(c.analysis)!;
      const r = computeScenario(a, await modelFor(a.state), { directJobs: 'coefficient' })!;
      const errors: string[] = [];
      const revenue = r.streams.reduce((s, x) => s + x.revenue, 0) + (r.construction?.localSpend ?? 0);
      compare(withoutFte(legacyShape(r)), withoutFte(c.result), c.id, errors, ABS_PER_REVENUE * revenue);
      expect(errors).toEqual([]);
    });
  }

  test('sensitivity sweeps and projection', async () => {
    const a = migrate(legacy.cases[0].analysis)!;
    const model = await modelFor(a.state);
    const errors: string[] = [];
    const abs = ABS_PER_REVENUE * 1.4 * 900;
    const old = { directJobs: 'coefficient' } as const;
    // All taxes now include employee FICA; the case comparisons above check the
    // tax lines with it taken out, so the sweeps compare the other values.
    const rename = (p: { output: number; gdp: number; jobs: number; compensation: number; gamingTax: number }) =>
      ({ output: p.output, gdp: p.gdp, employment: p.jobs, wages: p.compensation, gamingTax: p.gamingTax });
    const drop = <T extends { totalTax?: number }>({ totalTax: _t, ...p }: T) => p;
    compare(sweepGgr(a, model, 0.4, 9, old).map((p) => ({ x: p.x, ...rename(p) })), legacy.sensitivity.ggr.map(({ label: _l, ...p }) => drop(p)), 'ggr', errors, abs);
    compare(sweepTaxRate(a, model, 0.4, 9, old).map((p) => ({ x: p.x, ...rename(p) })), legacy.sensitivity.taxRate.map(drop), 'tax', errors, abs);
    compare(project(a, model, 5, 0.05, new Date().getFullYear(), old).series.map((p) => ({ yearIndex: p.year - new Date().getFullYear() + 1, ggr: p.ggr, ...rename(p) })), legacy.sensitivity.projection.map(drop), 'proj', errors, abs);
    expect(errors).toEqual([]);
    expect(headline(computeScenario(a, model)!).jobs).toBeGreaterThan(0);
  });
});
