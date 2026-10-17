/**
 * Unit tests of the calculation rules: labor-data replacement, the gaming-tax
 * payroll adjustment, jobs ranges, gaming, payroll and income taxes, fiscal
 * replacement of gaming TOPI, the optional modules and save/share.
 */
import { describe, expect, test } from 'vitest';
import { loadModel } from './data';
import { activityResponse } from './activities';
import { streamImpact, type StreamOptions } from './impact';
import { multipliers } from './io';
import { CPI, deflator } from './prices';
import {
  GAMING_TAX, PAYROLL_ADJUSTMENT, WAGE_BASIS, computeScenario, defaultAnalysis, fiscalDataFor,
  jobsRangeFor, netShare, payrollFactor, type Analysis,
} from './scenario';
import { gamingTax, taxAtWage, incomeTax, taxRule, verticalSchedule, type GamingVertical } from './tax';
import { buildFiscal } from './fiscal';
import { analysisFromForecaster, analysisFromUrl, decodeAnalysis, encodeAnalysis, migrate, shareUrl } from './share';

const nv = () => loadModel('NV');
const opts = (o: Partial<StreamOptions> = {}): StreamOptions => ({
  deflator: 1, cashShare: { direct: 0.7, ripple: 0.8 }, directFtePerJob: 0.8, ...o,
});

describe('stream impacts', () => {
  test('observed cash wages replace direct compensation and rescale induced effects only', async () => {
    const r = activityResponse(await nv(), 'gambling');
    const base = streamImpact(r, 100, opts())!;
    const known = streamImpact(r, 100, opts({ knownWages: 14 }))!;
    const scale = (14 / 0.7 + base.compensation.indirect) / (base.compensation.direct + base.compensation.indirect);
    expect(known.compensation.direct).toBeCloseTo(20, 10);
    expect(known.cashWages.direct).toBeCloseTo(14, 10);
    expect(known.compensation.indirect).toBeCloseTo(base.compensation.indirect, 10);
    expect(known.inducedScale).toBeCloseTo(scale, 12);
    for (const m of ['output', 'gdp', 'compensation', 'jobs', 'fte', 'topi'] as const) {
      expect(known[m].induced).toBeCloseTo(base[m].induced * scale, 9);
    }
    expect(known.gdp.direct).toBeCloseTo(base.gdp.direct, 12);
    expect(known.sources.compensation).toBe('user');
  });

  test('observed jobs replace direct jobs; ripple jobs and the range are unaffected or removed', async () => {
    const r = activityResponse(await nv(), 'gambling');
    const base = streamImpact(r, 100, opts({ jobsRange: { p05: 0.5, p95: 2 } }))!;
    const known = streamImpact(r, 100, opts({ knownJobs: 75, jobsRange: { p05: 0.5, p95: 2 } }))!;
    expect(known.jobs.direct).toBe(75);
    expect(known.fte.direct).toBeCloseTo(60, 12);
    expect(known.jobs.indirect).toBeCloseTo(base.jobs.indirect, 12);
    expect(known.jobsRange).toBeNull();
    expect(base.jobsRange!.direct).toEqual([base.jobs.direct * 0.5, base.jobs.direct * 2]);
    expect(base.jobsRange!.total[0]).toBeCloseTo(base.jobs.direct * 0.5 + base.jobs.indirect + base.jobs.induced, 9);
  });

  test('jobs use 2023 dollars: revenue is deflated before the jobs satellite applies', async () => {
    const r = activityResponse(await nv(), 'gambling');
    const a = streamImpact(r, 100, opts({ deflator: 1 }))!;
    const b = streamImpact(r, 100, opts({ deflator: deflator(2025) }))!;
    expect(b.jobs.total / a.jobs.total).toBeCloseTo(CPI[2023] / CPI[2025], 12);
    expect(b.gdp.total).toBeCloseTo(a.gdp.total, 12);
    expect(deflator(2031)).toBe(deflator(2025));
  });

  test('ripple jobs by industry sum to supplier plus induced jobs', async () => {
    const model = await nv();
    const imp = streamImpact(activityResponse(model, 'lodging'), 50, opts())!;
    const sum = imp.rippleJobsByIndustry.reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(imp.jobs.indirect + imp.jobs.induced, 9);
    expect(multipliers(model.respond('721')).Type_I_Output).toBeGreaterThan(1);
  });
});

describe('gaming-tax payroll adjustment and jobs ranges', () => {
  test('adjustment applies to land-based gaming streams with a positive rate', () => {
    expect(payrollFactor(0.4, false, 'total', 'total')).toBeCloseTo(Math.exp(-PAYROLL_ADJUSTMENT.slope * 0.4), 12);
    expect(payrollFactor(0, false, 'total', 'total')).toBe(1);
    expect(payrollFactor(0.4, false, 'department', 'lodging')).toBe(1);
    expect(payrollFactor(0.2, true, 'total', 'total')).toBe(1);
  });

  test('scenario lowers direct compensation by the factor and leaves jobs and GDP', async () => {
    const model = await loadModel('PA');
    const a: Analysis = { ...defaultAnalysis(), state: 'Pennsylvania', propertyType: '713210', revenue: { gaming: 200, food: null, lodging: null, other: null, total: null } };
    const r = computeScenario(a, model)!;
    const noTax = computeScenario({ ...a, state: 'Pennsylvania', gamingTax: { customRate: 0, slotSharePct: 70 } }, model)!;
    const f = Math.exp(-PAYROLL_ADJUSTMENT.slope * r.gamingTax!.effectiveRate);
    expect(r.payrollAdjustment!.factor).toBeCloseTo(f, 12);
    expect(r.totals.compensation.direct).toBeCloseTo(noTax.totals.compensation.direct * f, 9);
    expect(r.totals.jobs.direct).toBeCloseTo(noTax.totals.jobs.direct, 9);
    expect(r.totals.gdp.direct).toBeCloseTo(noTax.totals.gdp.direct, 9);
    expect(r.totals.jobs.induced).toBeLessThan(noTax.totals.jobs.induced);
  });

  test('ranges map to streams by property type, mode and ownership', () => {
    expect(jobsRangeFor('713290', 'commercial', 'total', 'total')!.p05).toBe(0.3261);
    expect(jobsRangeFor('721120', 'commercial', 'department', 'gaming')!.p05).toBe(0.5605);
    expect(jobsRangeFor('713290', 'commercial', 'department', 'gaming')!.p95).toBe(2.7044);
    expect(jobsRangeFor('721120', 'commercial', 'department', 'lodging')).toBeNull();
    expect(jobsRangeFor('722410', 'commercial', 'total', 'total')).toBeNull();
    expect(jobsRangeFor('713210', 'tribal', 'total', 'total')).toBeNull();
    expect(jobsRangeFor('ONLINE_CASINO', 'commercial', 'total', 'total')).toBeNull();
  });
});

describe('taxes', () => {
  const tax = (state: string, ggr: number, v: GamingVertical = 'land', custom: number | null = null) =>
    gamingTax(ggr, taxRule(verticalSchedule(GAMING_TAX.rates[state], v), custom, 70));

  test('verified 2026 schedules: add-ons, handle taxes and custom rates', () => {
    expect(tax('New Jersey', 100)).toBeCloseTo(9.25, 9);
    expect(tax('Michigan', 100)).toBeCloseTo(20.25, 9);
    expect(tax('Indiana', 20)).toBeCloseTo(20 * 0.13, 9);
    expect(tax('Mississippi', 100)).toBeCloseTo(0.6 * 0.044 + 1.008 * 0.066 + 98.392 * 0.088 + 100 * 0.032, 9);
    expect(tax('Tennessee', 100, 'sports')).toBeCloseTo(100 * 0.0185 / 0.095, 9);
    expect(tax('Ohio', 100, 'sports')).toBeCloseTo(20, 9);
    expect(tax('Michigan', 100, 'land', 0.1)).toBeCloseTo(10, 9);
    for (const [state, entry] of Object.entries(GAMING_TAX.rates)) {
      if (entry.lastVerified) expect(entry.sources?.length, state).toBeGreaterThan(0);
    }
  });

  test('a custom rate applies to online operators where the state has no online schedule', () => {
    expect(tax('Nevada', 100, 'igaming', 0.15)).toBeCloseTo(15, 12);
  });

  test('taxAtWage interpolates the grid and extends the top marginal rate', () => {
    const grid = { min: 0, max: 3000, step: 1000 };
    const table = [0, 100, 300, 600];
    expect(taxAtWage(table, grid, 1500)).toBeCloseTo(200, 12);
    expect(taxAtWage(table, grid, 4000)).toBeCloseTo(900, 12);
    expect(taxAtWage(table, grid, 0)).toBe(0);
  });

  test('income tax is computed per worker, with the BEA ratio as fallback', () => {
    const tables = {
      wageGrid: { min: 0, max: 100000, step: 50000 },
      federal: { tax: [0, 4000, 12000] },
      states: { Testland: { abbrev: 'TL', state: [0, 1500, 4000], local: [0, 500, 1000] } },
    };
    const d = incomeTax(4, 100, tables, 'Testland');
    expect(d.federal).toBeCloseTo(3200 * 100 / 1e6, 12);
    expect(d.stateLocal).toBeCloseTo((1200 + 400) * 100 / 1e6, 12);
    const fb = incomeTax(4, 100, tables, 'Nowhere', { household_tax_ratio: 0.2, suta_avg_rate: null, suta_wage_base: null, sdi_employer_rate: null, pfml_employer_rate: null });
    expect(fb.method).toBe('bea_ratio');
    expect(fb.total).toBeCloseTo(0.8, 12);
  });

  test('federal payroll parameters use the 2026 Social Security wage base', () => {
    expect(fiscalDataFor('Nevada').federalPayroll.fica_ss_wage_cap).toBe(184_500);
  });
});

describe('fiscal lines', () => {
  const effects = (d: number, i = 0, n = 0) => ({ direct: d, indirect: i, induced: n, total: d + i + n });
  const input = { cashWages: effects(20, 8, 6), jobs: effects(400, 100, 80), topi: effects(5, 1, 2) };

  test('the statutory gaming tax replaces the gaming share of direct TOPI', () => {
    const data = fiscalDataFor('Pennsylvania');
    const f = buildFiscal({ ...input, gamingTax: { amount: 30, effectiveRate: 0.3 }, gamingStreamTopi: 5 }, data);
    expect(f.lines.find((l) => l.key === 'topi')!.direct).toBeCloseTo(5 * data.nonGamingShare, 12);
    expect(f.lines.find((l) => l.key === 'gaming')!.direct).toBe(30);
    const sum = f.lines.reduce((s, l) => s + l.total, 0);
    expect(f.totals.all.total).toBeCloseTo(sum, 12);
    expect(f.totals.federal.total + f.totals.stateLocal.total).toBeCloseTo(sum, 12);
  });

  test('tribal: the compact share replaces all direct gaming TOPI', () => {
    const data = fiscalDataFor('Oklahoma');
    const f = buildFiscal({ ...input, gamingTax: { amount: 6, effectiveRate: 0.06 }, gamingStreamTopi: 5, tribal: true }, data);
    expect(f.lines.find((l) => l.key === 'topi')!.direct).toBeCloseTo(0, 12);
    expect(f.lines.find((l) => l.key === 'gaming')!.label).toBe('Tribal revenue sharing (compact)');
    const none = buildFiscal({ ...input, gamingStreamTopi: 5, tribal: true }, data);
    expect(none.lines.some((l) => l.key === 'gaming')).toBe(false);
  });

  test('a land-based total-revenue input is never taxed as GGR', async () => {
    const model = await loadModel('NJ');
    const a: Analysis = { ...defaultAnalysis(), state: 'New Jersey', inputMode: 'total', revenue: { gaming: null, food: null, lodging: null, other: null, total: 100 } };
    expect(computeScenario(a, model)!.gamingTax).toBeNull();
    expect(computeScenario({ ...a, propertyType: 'ONLINE_CASINO' }, model)!.gamingTax!.ggr).toBe(100);
  });
});

describe('optional modules', () => {
  test('net share combines visitor revenue and recaptured resident play', () => {
    expect(netShare({ enabled: false, nonResidentShare: 40, recaptureShare: 0 })).toBeNull();
    expect(netShare({ enabled: true, nonResidentShare: 40, recaptureShare: 20 })).toBeCloseTo(0.4 + 0.6 * 0.2, 12);
    expect(netShare({ enabled: true, nonResidentShare: 140, recaptureShare: -5 })).toBe(1);
  });

  test('construction uses sector 23, the in-state share and job-years', async () => {
    const model = await nv();
    const a: Analysis = { ...defaultAnalysis(), construction: { enabled: true, cost: 200, localShare: 60, years: 2 } };
    const c = computeScenario(a, model)!.construction!;
    expect(c.localSpend).toBe(120);
    expect(c.impact.output.total / 120).toBeCloseTo(multipliers(model.respond('23')).Type_II_Output, 12);
    expect(c.annualJobs).toBeCloseTo(c.impact.jobs.total / 2, 12);
    expect(c.impact.cashWages.direct).toBeCloseTo(c.impact.compensation.direct * WAGE_BASIS.sectors['23'], 12);
  });
});

describe('save and share', () => {
  test('share links round-trip, including non-ASCII names', () => {
    const a: Analysis = { ...defaultAnalysis(), name: 'Casino Québec — test' };
    expect(decodeAnalysis(encodeAnalysis(a))).toEqual(a);
    const url = shareUrl(a, 'https://example.org/tools/economic-impact/?x=1#top');
    expect(analysisFromUrl(new URL(url).search)).toEqual(a);
    expect(decodeAnalysis('not-base64!')).toBeNull();
  });

  test('Revenue Forecaster links pre-fill the analysis', () => {
    const a = analysisFromForecaster('?from=forecaster&state=Ohio&name=Proposed%20Casino&propertyType=713210&gaming=149.4&food=28.1&lodging=0&other=31.5&gaming_emp=2,405&archetype=regional')!;
    expect(a).toMatchObject({ state: 'Ohio', name: 'Proposed Casino', propertyType: '713210', inputMode: 'department' });
    expect(a.revenue).toEqual({ gaming: 149.4, food: 28.1, lodging: null, other: 31.5, total: null });
    expect(analysisFromForecaster('?from=forecaster&state=Atlantis&propertyType=XYZ')).toMatchObject({ state: 'Nevada', propertyType: '721120' });
    expect(analysisFromForecaster('?state=Ohio')).toBeNull();
  });

  test('v2 links migrate to the current shape', () => {
    const v2 = {
      v: 2, state: 'Iowa', casinoName: 'Old link', propertyType: '713210', inputMode: 'department',
      revenues: { gaming: 120, food: 15, lodging: null, other: null, total: null },
      knownData: { gaming: { emp: 500, wages: 18 }, food: { emp: null, wages: null } },
      gamingTaxCustomRate: '0.2', slotRevenuePct: 80, analysisYear: 2024, ownership: 'commercial',
      netImpact: { enabled: true, nonResidentShare: 30, recaptureShare: 10 },
      construction: { enabled: false, cost: null, localShare: 60, years: 2 },
    };
    const a = migrate(v2)!;
    expect(a).toMatchObject({
      v: 3, state: 'Iowa', name: 'Old link', dollarYear: 2024,
      revenue: { gaming: 120, food: 15 }, gamingTax: { customRate: 0.2, slotSharePct: 80 },
    });
    expect(a.known.gaming).toEqual({ jobs: 500, wages: 18 });
    expect(a.known.lodging).toEqual({ jobs: null, wages: null });
  });
});
