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
  GAMING_TAX, PAYROLL_ADJUSTMENT, WAGE_BASIS, computeScenario, defaultAnalysis, fiscalDataFor,
  jobsRangeFor, netShare, payrollFactor, type Analysis,
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
