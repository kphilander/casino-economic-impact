/**
 * Unit tests of the calculation rules: labor-data replacement, the gaming-tax
 * payroll adjustment, jobs ranges, gaming, payroll and income taxes, fiscal
 * replacement of gaming TOPI, the optional modules and save/share.
 */
import { describe, expect, test } from 'vitest';
import { loadModel } from './data';
import { activityResponse } from './activities';
import { streamImpact, type StreamOptions } from './impact';
import { multipliers, type StateTables } from './io';
import { householdSpendingRange } from './sensitivity';
import { CPI, deflator } from './prices';
import {
  GAMING_TAX, PAYROLL_ADJUSTMENT, WAGE_BASIS, compsApplied, computeScenario, defaultAnalysis, fiscalDataFor,
  DIRECT_JOBS_RATE, coefficientRangeFor, directJobsRate, jobsRangeFor, netShare, payrollFactor, type Analysis,
} from './scenario';
import { gamingTax, gamingTaxSteps, payrollTax, taxAtWage, incomeTax, taxRule, verticalSchedule, type GamingVertical } from './tax';
import { buildFiscal } from './fiscal';
import { analysisFromForecaster, analysisFromUrl, decodeAnalysis, encodeAnalysis, loadDraft, migrate, saveDraft, shareUrl } from './share';

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

  test('scenario lowers direct compensation by the factor and leaves GDP', async () => {
    const model = await loadModel('PA');
    const a: Analysis = { ...defaultAnalysis(), state: 'Pennsylvania', propertyType: '713210', revenue: { gaming: 200, food: null, lodging: null, other: null, total: null } };
    const r = computeScenario(a, model)!;
    const noTax = computeScenario({ ...a, state: 'Pennsylvania', gamingTax: { customRate: 0, slotSharePct: 70 } }, model)!;
    const f = Math.exp(-PAYROLL_ADJUSTMENT.slope * r.gamingTax!.effectiveRate);
    expect(r.payrollAdjustment!.factor).toBeCloseTo(f, 12);
    expect(r.totals.compensation.direct).toBeCloseTo(noTax.totals.compensation.direct * f, 9);
    // Direct jobs fall with the rate through the national gaming rate, not through this factor.
    expect(r.totals.jobs.direct).toBeCloseTo(noTax.totals.jobs.direct * Math.exp(-DIRECT_JOBS_RATE.slope * r.gamingTax!.effectiveRate), 9);
    expect(r.totals.gdp.direct).toBeCloseTo(noTax.totals.gdp.direct, 9);
    expect(r.totals.jobs.induced).toBeLessThan(noTax.totals.jobs.induced);
  });

  test('ranges map to streams by property type, mode and ownership', () => {
    expect(jobsRangeFor('713290', 'commercial', 'total', 'total')!.p05).toBe(0.3261);
    expect(jobsRangeFor('721120', 'commercial', 'department', 'gaming')!.p05).toBe(DIRECT_JOBS_RATE.ranges.gamingDepartment.p05);
    expect(jobsRangeFor('721120', 'commercial', 'total', 'total')!.p95).toBe(DIRECT_JOBS_RATE.ranges['721120'].p95);
    expect(jobsRangeFor('713210', 'commercial', 'total', 'total')!.p05).toBe(DIRECT_JOBS_RATE.ranges['713210'].p05);
    expect(coefficientRangeFor('721120', 'commercial', 'department', 'gaming')!.p05).toBe(0.5605);
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
    // Re-verified 2026-10-20: Connecticut online casino gaming moved to 20% in October 2026.
    expect(tax('Connecticut', 100, 'igaming')).toBeCloseTo(20, 9);
    // Illinois: slots 70% of $40M = $28M (15% to $25M, then 22.5%); tables $12M at 15%.
    expect(tax('Illinois', 40)).toBeCloseTo(25 * 0.15 + 3 * 0.225 + 12 * 0.15, 9);
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
    expect(f.lines.find((l) => l.key === 'gaming')!.label).toBe('Tribal revenue share (compact)');
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

  test('the working draft survives a reload and tolerates missing storage', () => {
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const saved = g.localStorage;
    g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    try {
      expect(loadDraft()).toBeNull();
      const a: Analysis = { ...defaultAnalysis(), state: 'Iowa', name: 'Draft' };
      saveDraft(a);
      expect(loadDraft()).toEqual(a);
      store.set('gems_draft', JSON.stringify({ v: 2, state: 'Ohio', casinoName: 'Old', revenues: { gaming: 50 } }));
      expect(loadDraft()).toMatchObject({ v: 3, state: 'Ohio', name: 'Old', revenue: { gaming: 50 } });
      store.set('gems_draft', '{not json');
      expect(loadDraft()).toBeNull();
    } finally {
      g.localStorage = saved;
    }
    expect(() => saveDraft(defaultAnalysis())).not.toThrow();
    expect(loadDraft()).toBeNull();
  });

  test('Revenue Forecaster links pre-fill the analysis', () => {
    const a = analysisFromForecaster('?from=forecaster&state=Ohio&name=Proposed%20Casino&propertyType=713210&gaming=149.4&food=28.1&lodging=0&other=31.5&gaming_emp=2,405&archetype=regional')!;
    expect(a).toMatchObject({ state: 'Ohio', name: 'Proposed Casino', propertyType: '713210', inputMode: 'department' });
    expect(a.revenue).toEqual({ gaming: 149.4, food: 28.1, lodging: null, other: 31.5, total: null });
    expect(analysisFromForecaster('?from=forecaster&state=Atlantis&propertyType=XYZ')).toMatchObject({ state: 'Nevada', propertyType: '721120' });
    expect(analysisFromForecaster('?state=Ohio')).toBeNull();
    // The link can carry the dollar year of the revenue; a year outside the CPI table is ignored.
    expect(a.dollarYear).toBeNull();
    expect(analysisFromForecaster('?from=forecaster&state=Ohio&gaming=100&dollarYear=2024')!.dollarYear).toBe(2024);
    expect(analysisFromForecaster('?from=forecaster&state=Ohio&gaming=100&dollarYear=2031')!.dollarYear).toBeNull();
  });

  test('Revenue Forecaster links can set the slot share of GGR', () => {
    const share = (q: string) => analysisFromForecaster(`?from=forecaster&state=Pennsylvania&gaming=100${q}`)!.gamingTax.slotSharePct;
    expect(share('')).toBe(70);
    expect(share('&slotShare=60')).toBe(60);
    expect(share('&slotShare=0')).toBe(0);
    expect(share('&slotShare=100')).toBe(100);
    expect(share('&slotShare=93.5')).toBe(93.5);
    // Out of range or not a number: the default stays.
    expect(share('&slotShare=101')).toBe(70);
    expect(share('&slotShare=-5')).toBe(70);
    expect(share('&slotShare=abc')).toBe(70);
    expect(share('&slotShare=')).toBe(70);
    // The custom rate is not touched.
    expect(analysisFromForecaster('?from=forecaster&gaming=100&slotShare=60')!.gamingTax.customRate).toBeNull();
  });

  test('a Revenue Forecaster export link sets the slot share used by a split gaming tax', async () => {
    // Link built by the forecaster's buildEconomicImpactURL for a $293.5M mega_resort forecast.
    const link = '?from=forecaster&state=Pennsylvania&name=Example&propertyType=721120&inputMode=department&gaming=293.5&food=160.3&lodging=191.4&other=101.3&archetype=mega_resort&slotShare=60&dollarYear=2025';
    const a = analysisFromForecaster(link)!;
    expect(a.revenue).toEqual({ gaming: 293.5, food: 160.3, lodging: 191.4, other: 101.3, total: null });
    expect(a.gamingTax.slotSharePct).toBe(60);
    expect(a.dollarYear).toBe(2025);
    const model = await loadModel('PA');
    const r = computeScenario(a, model)!;
    const pa = GAMING_TAX.rates.Pennsylvania;
    expect(r.gamingTax!.amount).toBeCloseTo(293.5 * (0.6 * pa.slotsRate! + 0.4 * pa.tableRate!), 9);
    // Without the parameter the default 70% applies.
    const old = computeScenario(analysisFromForecaster(link.replace('&slotShare=60', ''))!, model)!;
    expect(old.gamingTax!.amount).toBeCloseTo(293.5 * (0.7 * pa.slotsRate! + 0.3 * pa.tableRate!), 9);
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

describe('computation basis shown in the interface', () => {
  test('gaming tax steps are the computation: bands of a graduated schedule sum to the tax', () => {
    const rule = taxRule(GAMING_TAX.rates.Nevada, null, 70);
    const steps = gamingTaxSteps(250, rule);
    expect(steps.map((x) => x.rate)).toEqual([0.035, 0.045, 0.0675]);
    expect(steps.reduce((s, x) => s + x.base, 0)).toBeCloseTo(250, 12);
    expect(steps.reduce((s, x) => s + x.tax, 0)).toBeCloseTo(gamingTax(250, rule), 12);
    const il = gamingTaxSteps(100, taxRule(GAMING_TAX.rates.Illinois, null, 80));
    expect(il.filter((x) => x.part === 'slots').reduce((s, x) => s + x.base, 0)).toBeCloseTo(80, 12);
    expect(gamingTaxSteps(100, taxRule(GAMING_TAX.rates.Tennessee.sportsBetting, null, 70))[0].rate).toBeCloseTo(0.0185 / 0.095, 12);
  });

  test('payroll components and income tax per worker add up to the lines', () => {
    const data = fiscalDataFor('California');
    const p = payrollTax(30, 600, data.statePayroll, data.federalPayroll);
    const parts = Object.values(p.parts).reduce((s, x) => s + x, 0);
    expect(parts).toBeCloseTo(p.total, 12);
    expect(p.employer + p.employee).toBeCloseTo(p.total, 12);
    // Employee Social Security and Medicare: 7.65% of a $50,000 wage, federal revenue.
    expect(p.employee).toBeCloseTo(30 * 0.0765, 12);
    expect(p.federal - p.employee).toBeCloseTo(p.parts.socialSecurity + p.parts.medicare + p.parts.futa, 12);
    expect(p.avgWage).toBeCloseTo(50000, 9);
    const t = incomeTax(30, 600, data.incomeTax, 'California');
    expect(t.perWorker.federal * 600 / 1e6).toBeCloseTo(t.federal, 12);
    expect((t.perWorker.state + t.perWorker.local) * 600 / 1e6).toBeCloseTo(t.stateLocal, 12);
  });

  test('stream basis reproduces the displayed figures', async () => {
    const model = await nv();
    const r = computeScenario({ ...defaultAnalysis(), known: { ...defaultAnalysis().known, food: { jobs: null, wages: 9 } } }, model)!;
    for (const s of r.streams) {
      const b = s.impact.basis;
      expect(b.revenue * b.perMillion.va.direct).toBeCloseTo(s.impact.gdp.direct, 9);
      expect(b.revenue * b.perMillion.va.induced * s.impact.inducedScale).toBeCloseTo(s.impact.gdp.induced, 9);
      expect(b.revenue * b.deflator * b.perMillion.jobs.indirect).toBeCloseTo(s.impact.jobs.indirect, 9);
    }
    const gaming = r.streams.find((s) => s.key === 'gaming')!;
    expect(gaming.impact.basis.revenue * gaming.impact.basis.perMillion.compensation.direct * gaming.impact.basis.compensationFactor)
      .toBeCloseTo(gaming.impact.compensation.direct, 9);
    const food = r.streams.find((s) => s.key === 'food')!;
    expect(food.impact.basis.knownWages! / food.impact.basis.cashShare.direct).toBeCloseTo(food.impact.compensation.direct, 12);
    // Industry trace: for a StateIO industry, jobs = output required x deflator x jobs per $1M.
    const lodging = r.streams.find((s) => s.key === 'lodging')!.impact;
    lodging.rippleJobsByIndustry.forEach((j, i) => {
      expect(j).toBeCloseTo(lodging.rippleOutputByIndustry[i] * lodging.basis.deflator * model.coefficients.jobs[i], 9);
    });
  });

  test('fiscal basis: TOPI removed equals the replaced gaming share', async () => {
    const r = computeScenario(defaultAnalysis(), await nv())!;
    const t = r.fiscal.basis.topi;
    expect(t.removed).toBeCloseTo((1 - t.retainedShare) * t.gamingStreamTopi, 12);
    expect(r.fiscal.lines.find((l) => l.key === 'topi')!.direct).toBeCloseTo(t.modeledDirect - t.removed, 12);
    expect(r.fiscal.basis.effects.direct.payroll.federal).toBeCloseTo(r.fiscal.lines.find((l) => l.key === 'payroll_federal')!.direct, 12);
  });
});

describe('household closure (Type II)', () => {
  const tables = import.meta.glob<StateTables>('../data/io/[A-Z][A-Z].json', { eager: true, import: 'default' });

  test('the spending share follows from the calculator tax rules in every state', () => {
    const entries = Object.values(tables);
    expect(entries).toHaveLength(50);
    const c = entries[0].householdSpending.consumptionShare;
    for (const t of entries) {
      const hs = t.householdSpending;
      const w = hs.avgWage;
      const fd = fiscalDataFor(t.state);
      const p = payrollTax(w / 1e6, 1, fd.statePayroll, fd.federalPayroll);
      const employer = p.employer * 1e6 / w;
      const employee = p.employee * 1e6 / w;
      expect(employee).toBeCloseTo((Math.min(w, fd.federalPayroll.fica_ss_wage_cap) * fd.federalPayroll.fica_ss_rate + w * fd.federalPayroll.fica_medicare_rate) / w, 12);
      const income = incomeTax(w / 1e6, 1, fd.incomeTax, t.state, fd.statePayroll).total * 1e6 / w;
      const disposable = 1 - WAGE_BASIS.private * (employer + employee + income);
      expect(hs.consumptionShare, t.state).toBe(c);
      expect(hs.share, t.state).toBeCloseTo(c * disposable, 9);
      expect(hs.high, t.state).toBeCloseTo(disposable, 9);
      expect(hs.low, t.state).toBeLessThan(hs.share);
      expect(hs.share, t.state).toBeGreaterThan(0.6);
      expect(hs.share, t.state).toBeLessThan(0.8);
    }
  });

  test('the household column spends the share in the in-state pattern', async () => {
    const m = await nv();
    const h = m.household;
    expect(h.share).toBe(h.range.central);
    expect(h.inState).toBeCloseTo(h.share! * h.instateShare, 3);
    // The earlier closure spent all in-state consumption per dollar of compensation.
    const legacy = m.withHouseholdSpending('legacy');
    expect(legacy.household.share).toBeNull();
    expect(legacy.household.inState).toBeGreaterThan(1.7 * h.inState);
  });

  test('a higher spending share raises induced effects only', async () => {
    const m = await nv();
    const hi = m.withHouseholdSpending(m.household.range.high);
    expect(m.withHouseholdSpending(m.household.range.central)).toBe(m);
    expect(m.withHouseholdSpending(m.household.range.high)).toBe(hi);
    const [a, b] = [multipliers(m.respond('713')), multipliers(hi.respond('713'))];
    expect(b.Type_I_Output).toBe(a.Type_I_Output);
    expect(b.Type_II_Output).toBeGreaterThan(a.Type_II_Output);
    const rows = householdSpendingRange(defaultAnalysis(), m);
    expect(rows.map((r) => r.key)).toEqual(['low', 'central', 'high']);
    expect(rows[0].jobs).toBeLessThan(rows[1].jobs);
    expect(rows[1].jobs).toBeLessThan(rows[2].jobs);
    expect(rows[1].jobs).toBeCloseTo(computeScenario(defaultAnalysis(), m)!.totals.jobs.total, 9);
  });
});

describe('corrections of November 2026', () => {
  test('a slot share of 0 or 100 is used as entered; only a missing value takes the default', () => {
    const pa = GAMING_TAX.rates.Pennsylvania;
    expect(gamingTax(100, taxRule(pa, null, 0))).toBeCloseTo(100 * pa.tableRate!, 10);
    expect(gamingTax(100, taxRule(pa, null, 100))).toBeCloseTo(100 * pa.slotsRate!, 10);
    expect(gamingTax(100, taxRule(pa, null, 150))).toBeCloseTo(100 * pa.slotsRate!, 10);
    expect(gamingTax(100, taxRule(pa, null, NaN))).toBeCloseTo(100 * (0.7 * pa.slotsRate! + 0.3 * pa.tableRate!), 10);
  });

  test('gaming accounts: implied surplus is negative at a high statutory rate, positive at a low one', async () => {
    const pa = computeScenario({ ...defaultAnalysis(), state: 'Pennsylvania' }, await loadModel('PA'))!;
    const nev = computeScenario(defaultAnalysis(), await nv())!;
    const g = pa.gamingAccounts!;
    expect(g.impliedSurplus).toBeCloseTo(g.valueAdded - g.compensation - g.gamingTax - g.otherTopi, 10);
    expect(g.impliedSurplus).toBeLessThan(0);
    expect(nev.gamingAccounts!.impliedSurplus).toBeGreaterThan(0);
    const total = computeScenario({ ...defaultAnalysis(), inputMode: 'total', revenue: { ...defaultAnalysis().revenue, total: 300 } }, await nv())!;
    expect(total.gamingAccounts).toBeNull();
  });

  test('the fallback income-tax line is in neither level subtotal', () => {
    const f = buildFiscal({
      cashWages: { direct: 10, indirect: 2, induced: 2, total: 14 }, jobs: { direct: 0, indirect: 0, induced: 0, total: 0 },
      topi: { direct: 0, indirect: 0, induced: 0, total: 0 },
    }, fiscalDataFor('Nevada'));
    const combined = f.lines.find((l) => l.key === 'income_combined')!;
    expect(combined.level).toBe('all');
    expect(f.totals.all.total).toBeCloseTo(f.totals.federal.total + f.totals.stateLocal.total + combined.total, 10);
  });

  test('jobs satellite: plausible 2023 output and no sector with output but no jobs', async () => {
    const loaders = import.meta.glob<StateTables>('../data/io/[A-Z][A-Z].json', { import: 'default' });
    const noJobs = new Set(['HS', 'GFE', 'GSLE']);
    for (const [path, load] of Object.entries(loaders)) {
      const t = await load();
      const model = await loadModel(t.abbrev);
      const sum = (v: (number | null)[], codes: string[]) => codes.reduce((s, c) => s + (v[model.index[c]] ?? 0), 0);
      const retail = ['441', '445', '452', '4A0'];
      const growth = sum(t.output2023, retail) / sum(t.industryOutput, retail);
      for (const c of retail) {
        const i = model.index[c];
        // Each retail sector grows with the state's retail total.
        expect(t.output2023[i]! / t.industryOutput[i], `${path} ${c}`).toBeCloseTo(growth, 8);
        // Lowest: other retail in Washington (large nonstore retailers), about 1.9.
        expect(model.coefficients.jobs[i], `${path} ${c}`).toBeGreaterThan(1);
        expect(model.coefficients.jobs[i], `${path} ${c}`).toBeLessThan(15);
      }
      model.industries.forEach((ind, i) => {
        if (noJobs.has(ind.code) || !((t.output2023[i] ?? 0) > 0)) return;
        // Railroads are outside QCEW; their national coefficient is close to zero.
        if (ind.code !== '482') expect(model.coefficients.jobs[i], `${path} ${ind.code}`).toBeGreaterThan(0);
      });
    }
  });
});

describe('optional complimentaries', () => {
  const base = (): Analysis => ({
    ...defaultAnalysis(), state: 'Nevada', propertyType: '721120',
    revenue: { gaming: 293.5, food: 160.3, lodging: 191.4, other: 101.3, total: null },
  });
  const revenues = (r: ReturnType<typeof computeScenario>) => Object.fromEntries(r!.streams.map((s) => [s.key, s.revenue]));

  test('empty complimentaries leave the analysis unchanged', async () => {
    const model = await nv();
    const a = base();
    expect(a.comps).toEqual({ food: null, lodging: null, other: null });
    expect(compsApplied(a)).toBeNull();
    expect(compsApplied({ ...a, comps: { food: 0, lodging: null, other: 0 } })).toBeNull();
    const r = computeScenario(a, model)!;
    expect(revenues(r)).toEqual({ gaming: 293.5, food: 160.3, lodging: 191.4, other: 101.3 });
  });

  test('comps move from the gaming stream to the departments; the gaming tax stays on GGR', async () => {
    const model = await nv();
    const comps = { food: 39.6, lodging: 59.9, other: 4.1 };
    const a = { ...base(), comps };
    const r = computeScenario(a, model)!;
    const total = 39.6 + 59.9 + 4.1;
    const rev = revenues(r);
    expect(rev.gaming).toBeCloseTo(293.5 - total, 12);
    expect(rev.food).toBeCloseTo(160.3 + 39.6, 12);
    expect(rev.lodging).toBeCloseTo(191.4 + 59.9, 12);
    expect(rev.other).toBeCloseTo(101.3 + 4.1, 12);
    // Total output is unchanged in revenue terms; the tax is on the full GGR.
    expect(r.streams.reduce((s, x) => s + x.revenue, 0)).toBeCloseTo(293.5 + 160.3 + 191.4 + 101.3, 9);
    const plain = computeScenario(base(), model)!;
    expect(r.gamingTax!.ggr).toBe(293.5);
    expect(r.gamingTax!.amount).toBeCloseTo(plain.gamingTax!.amount, 12);
    // Each stream equals a plain analysis with the moved revenue, apart from the tax base.
    const moved = computeScenario({ ...base(), revenue: { gaming: 293.5 - total, food: 160.3 + 39.6, lodging: 191.4 + 59.9, other: 101.3 + 4.1, total: null } }, model)!;
    for (const k of ['food', 'lodging', 'other'] as const) {
      const s1 = r.streams.find((s) => s.key === k)!, s2 = moved.streams.find((s) => s.key === k)!;
      expect(s1.impact.output.total).toBeCloseTo(s2.impact.output.total, 9);
      expect(s1.impact.jobs.total).toBeCloseTo(s2.impact.jobs.total, 9);
    }
    expect(r.gamingAccounts!.revenue).toBeCloseTo(293.5 - total, 12);
    expect(r.gamingAccounts!.gamingTax).toBeCloseTo(plain.gamingTax!.amount, 12);
  });

  test('with comps, the national jobs rate applies to GGR less comps at the tax rate on GGR', async () => {
    // Pennsylvania has a high gaming tax, so the tax base and the rate both matter.
    const model = await loadModel('PA');
    const comps = { food: 39.6, lodging: 59.9, other: 4.1 };
    const total = 39.6 + 59.9 + 4.1;
    const pa = (): Analysis => ({ ...base(), state: 'Pennsylvania', dollarYear: 2025 });
    const plain = computeScenario(pa(), model)!;
    const r = computeScenario({ ...pa(), comps }, model)!;
    expect(r.deflator).not.toBe(1);
    // The gaming tax and its effective rate are those of the full GGR.
    expect(r.gamingTax!.ggr).toBe(293.5);
    expect(r.gamingTax!.amount).toBeCloseTo(plain.gamingTax!.amount, 12);
    expect(r.gamingTax!.effectiveRate).toBeCloseTo(plain.gamingTax!.effectiveRate, 12);
    // Direct gaming jobs = national rate at that tax rate x (GGR - comps) in 2023 dollars.
    const per = DIRECT_JOBS_RATE.level * Math.exp(-DIRECT_JOBS_RATE.slope * r.gamingTax!.effectiveRate);
    const g = r.streams.find((s) => s.key === 'gaming')!;
    expect(g.revenue).toBeCloseTo(293.5 - total, 12);
    expect(g.impact.sources.jobs).toBe('rate');
    expect(g.impact.jobs.direct).toBeCloseTo((293.5 - total) * r.deflator * per, 9);
    const g0 = plain.streams.find((s) => s.key === 'gaming')!.impact;
    expect(g.impact.jobs.direct / g0.jobs.direct).toBeCloseTo((293.5 - total) / 293.5, 12);
    // The rate summary reports the same rate, its source and the per-$1M value.
    expect(r.directJobsRate).toEqual({ ...plain.directJobsRate, perMillion: expect.any(Number) });
    expect(r.directJobsRate!.rate).toBeCloseTo(r.gamingTax!.effectiveRate, 12);
    expect(r.directJobsRate!.rateSource).toBe('computed');
    expect(r.directJobsRate!.perMillion).toBeCloseTo(per, 12);
    // The departments that receive comps keep their own coefficients.
    for (const k of ['food', 'lodging', 'other'] as const) {
      expect(r.streams.find((s) => s.key === k)!.impact.sources.jobs).toBe('model');
    }
  });

  test('stand-alone casino with comps: the jobs rate applies to all of GGR', async () => {
    const model = await loadModel('PA');
    const casino = (): Analysis => ({
      ...defaultAnalysis(), state: 'Pennsylvania', propertyType: '713210', dollarYear: 2025,
      revenue: { gaming: 200, food: 20, lodging: null, other: 5, total: null },
    });
    const comps = { food: 12, lodging: null, other: 3 };
    const plain = computeScenario(casino(), model)!;
    const r = computeScenario({ ...casino(), comps }, model)!;
    const g = r.streams.find((s) => s.key === 'gaming')!;
    const g0 = plain.streams.find((s) => s.key === 'gaming')!;
    // Output of the gaming stream is GGR less the comps; the tax is on GGR.
    expect(g.revenue).toBeCloseTo(200 - 15, 12);
    expect(r.gamingTax!.amount).toBeCloseTo(plain.gamingTax!.amount, 12);
    // Direct gaming jobs and FTEs do not change: rate x all of GGR in 2023 dollars.
    const per = DIRECT_JOBS_RATE.level * Math.exp(-DIRECT_JOBS_RATE.slope * r.gamingTax!.effectiveRate);
    expect(g.impact.sources.jobs).toBe('rate');
    expect(g.impact.basis.directJobsRevenue).toBe(200);
    expect(g.impact.jobs.direct).toBeCloseTo(200 * r.deflator * per, 9);
    expect(g.impact.jobs.direct).toBeCloseTo(g0.impact.jobs.direct, 9);
    expect(g.impact.fte.direct).toBeCloseTo(g0.impact.fte.direct, 9);
    // Everything else in the gaming stream follows the smaller output.
    expect(g.impact.output.direct).toBeCloseTo(185, 12);
    expect(g.impact.jobs.indirect / g0.impact.jobs.indirect).toBeCloseTo(185 / 200, 12);
    // The departments that receive the comps gain jobs on them.
    const food = r.streams.find((s) => s.key === 'food')!, food0 = plain.streams.find((s) => s.key === 'food')!;
    expect(food.revenue).toBeCloseTo(32, 12);
    expect(food.impact.jobs.direct / food0.impact.jobs.direct).toBeCloseTo(32 / 20, 12);
    // Without comps the base is the stream's own revenue.
    expect(g0.impact.basis.directJobsRevenue).toBe(200);
    // A casino hotel keeps the rate on GGR less the comps.
    const hotel = computeScenario({ ...casino(), propertyType: '721120', comps }, model)!;
    const gh = hotel.streams.find((s) => s.key === 'gaming')!;
    expect(gh.impact.basis.directJobsRevenue).toBeCloseTo(185, 12);
    expect(gh.impact.jobs.direct).toBeCloseTo(185 * hotel.deflator * per, 9);
  });

  test('comps above GGR are scaled down; total mode and online ignore them', () => {
    const a = { ...base(), revenue: { ...base().revenue, gaming: 50 }, comps: { food: 60, lodging: 40, other: null } };
    const c = compsApplied(a)!;
    expect(c.scale).toBeCloseTo(0.5, 12);
    expect(c.total).toBeCloseTo(50, 12);
    expect(c.byDepartment).toEqual({ food: 30, lodging: 20, other: 0 });
    expect(compsApplied({ ...a, inputMode: 'total' })).toBeNull();
    expect(compsApplied({ ...a, propertyType: 'ONLINE_CASINO' })).toBeNull();
  });

  test('forecaster links and share links carry complimentaries', () => {
    const link = '?from=forecaster&state=Nevada&name=Example&propertyType=721120&inputMode=department&gaming=293.5&food=160.3&lodging=191.4&other=101.3&archetype=mega_resort&slotShare=60&dollarYear=2025&compFood=39.6&compLodging=59.9&compOther=4.1';
    const a = analysisFromForecaster(link)!;
    expect(a.comps).toEqual({ food: 39.6, lodging: 59.9, other: 4.1 });
    expect(a.revenue.gaming).toBe(293.5);
    expect(analysisFromForecaster('?from=forecaster&gaming=100&compFood=abc&compLodging=-3')!.comps).toEqual({ food: null, lodging: null, other: null });
    expect(decodeAnalysis(encodeAnalysis(a))).toEqual(a);
    // Saved analyses from before the input have no comps.
    expect(migrate({ ...a, comps: undefined })!.comps).toEqual({ food: null, lodging: null, other: null });
  });
});

describe('national gaming rate for direct jobs', () => {
  const pa = (over: Partial<Analysis> = {}): Analysis => ({
    ...defaultAnalysis(), state: 'Pennsylvania', propertyType: '713210',
    revenue: { gaming: 200, food: 20, lodging: null, other: null, total: null }, ...over,
  });

  test('rate is level x exp(-slope x tax rate) for commercial casino gaming streams only', () => {
    const { level, slope } = DIRECT_JOBS_RATE;
    expect(directJobsRate(0, '713210', 'commercial', 'department', 'gaming')).toBeCloseTo(level, 12);
    expect(directJobsRate(0.4, '721120', 'commercial', 'department', 'gaming')).toBeCloseTo(level * Math.exp(-slope * 0.4), 12);
    expect(directJobsRate(0.4, '721120', 'commercial', 'total', 'total')).toBeCloseTo(level * Math.exp(-slope * 0.4), 12);
    expect(directJobsRate(-1, '713210', 'commercial', 'total', 'total')).toBeCloseTo(level, 12);
    expect(directJobsRate(0.4, '721120', 'commercial', 'department', 'lodging')).toBeNull();
    expect(directJobsRate(0.4, '713290', 'commercial', 'department', 'gaming')).toBeNull();
    expect(directJobsRate(0.4, '722410', 'commercial', 'department', 'gaming')).toBeNull();
    expect(directJobsRate(0.1, '713210', 'tribal', 'department', 'gaming')).toBeNull();
    expect(directJobsRate(0.2, 'ONLINE_CASINO', 'commercial', 'department', 'gaming')).toBeNull();
  });

  test('scenario replaces direct gaming jobs and FTEs and nothing else', async () => {
    const model = await loadModel('PA');
    const r = computeScenario(pa(), model)!;
    const old = computeScenario(pa(), model, { directJobs: 'coefficient' })!;
    const g = r.streams.find((s) => s.key === 'gaming')!.impact;
    const g0 = old.streams.find((s) => s.key === 'gaming')!.impact;
    const per = DIRECT_JOBS_RATE.level * Math.exp(-DIRECT_JOBS_RATE.slope * r.gamingTax!.effectiveRate);
    expect(g.sources.jobs).toBe('rate');
    expect(g.jobs.direct).toBeCloseTo(200 * r.deflator * per, 9);
    expect(g.fte.direct / g.jobs.direct).toBeCloseTo(g0.fte.direct / g0.jobs.direct, 12);
    expect(r.directJobsRate!.perMillion).toBeCloseTo(per, 12);
    expect(r.directJobsRate!.stateCoefficient).toBeCloseTo(g0.jobs.direct / (200 * r.deflator), 12);
    for (const m of ['output', 'gdp', 'compensation', 'cashWages', 'topi'] as const) expect(g[m]).toEqual(g0[m]);
    expect(g.jobs.indirect).toBe(g0.jobs.indirect);
    expect(g.jobs.induced).toBe(g0.jobs.induced);
    const food = (x: typeof r) => x.streams.find((s) => s.key === 'food')!.impact;
    expect(food(r).jobs).toEqual(food(old).jobs);
    expect(food(r).sources.jobs).toBe('model');
    expect(old.directJobsRate).toBeNull();
  });

  test('observed jobs replace the rate; slot parlors and tribal properties keep the coefficient', async () => {
    const model = await loadModel('PA');
    const known = computeScenario(pa({ known: { ...defaultAnalysis().known, gaming: { jobs: 700, wages: null } } }), model)!;
    expect(known.streams[0].impact.jobs.direct).toBe(700);
    expect(known.streams[0].impact.sources.jobs).toBe('user');
    expect(known.directJobsRate).toBeNull();
    for (const over of [{ propertyType: '713290' }, { ownership: 'tribal' }] as Partial<Analysis>[]) {
      const r = computeScenario(pa(over), model)!;
      const old = computeScenario(pa(over), model, { directJobs: 'coefficient' })!;
      expect(r.totals.jobs).toEqual(old.totals.jobs);
      expect(r.directJobsRate).toBeNull();
    }
  });
});
