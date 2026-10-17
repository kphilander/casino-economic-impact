import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_ANALYSIS_YEAR,
  calculateCombinedImpact,
  calculateIncomeTaxDetail,
  calculatePayrollTax,
  calculatePayrollTaxDetail,
  calculateSingleImpact,
  getDeflator,
  jobsRangeForStream,
  taxAtWage,
} from './calculations.js';
import { buildFiscal, computeConstructionImpact, netShare, scaleTotals } from './fiscal.js';

const readJSON = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const jobsRanges = readJSON('../data/jobsRange.json');
const employmentTaxRates = readJSON('../data/employmentTaxRates.json');

const closeTo = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
};

const row = {
  State: 'Nevada', Sector: '7132',
  Direct_VA_Coef: 0.5, Direct_Wage_Coef: 0.2, Direct_Tax_Coef: 0.05,
  Emp_Coef: 10, Direct_Jobs_Per_1M_Output: 5, Indirect_Emp_Coef: 8, Induced_Emp_Coef: 6,
  FTE_Per_Job: 0.8, Direct_FTE_Per_1M_Output: 4, Indirect_FTE_Coef: 6.4, Induced_FTE_Coef: 4.8,
  Type_I_Output: 1.4, Type_II_Output: 1.7, Type_I_VA: 0.65, Type_II_VA: 0.8,
  Type_I_Wage: 0.3, Type_II_Wage: 0.38, Type_I_Tax: 0.07, Type_II_Tax: 0.09,
};
const range = { p05: 0.6, p95: 2.0 };

test('deflator follows the selected dollar year, not the browser clock', () => {
  closeTo(getDeflator(2024), 304.702 / 313.689);
  closeTo(getDeflator(2023), 1);
  assert.equal(DEFAULT_ANALYSIS_YEAR, 2025);
  const y2024 = calculateSingleImpact(100, row, null, null, { deflator: getDeflator(2024) });
  closeTo(y2024.employment.direct, 100 * (304.702 / 313.689) * 5);
});

test('direct jobs stay at the coefficient and carry a predictive range', () => {
  const r = calculateSingleImpact(100, row, null, null, { deflator: 1, jobsRange: range });
  closeTo(r.employment.direct, 100 * 5);
  closeTo(r.employment.indirect, 15 * 8);            // supplier jobs as modeled
  closeTo(r.employment.induced, 15 * 6);             // induced jobs as modeled
  closeTo(r.fte.direct, 100 * 4);
  assert.equal(r.employment.source, 'calculated');
  closeTo(r.employment.detail.range.direct[0], 300);
  closeTo(r.employment.detail.range.direct[1], 1000);
  closeTo(r.employment.detail.range.total[1], 1000 + 120 + 90);
  assert.equal(calculateSingleImpact(100, row, null, null, { deflator: 1 }).employment.detail, null);
});

test('user-entered jobs carry no model range', () => {
  const r = calculateSingleImpact(100, row, 420, null, { deflator: 1, jobsRange: range });
  assert.equal(r.employment.direct, 420);
  assert.equal(r.employment.detail, null);
});

test('jobs ranges map to streams by property type, mode and ownership', () => {
  const t = jobsRanges.propertyTypes;
  assert.equal(jobsRangeForStream(jobsRanges, '721120', 'total', 'total'), t['721120']);
  assert.equal(jobsRangeForStream(jobsRanges, '722410', 'total', 'total'), null);          // bars: no benchmark
  assert.equal(jobsRangeForStream(jobsRanges, '721120', 'department', 'gaming'), t['713210']);
  assert.equal(jobsRangeForStream(jobsRanges, '713290', 'department', 'gaming'), t['713290']);
  assert.equal(jobsRangeForStream(jobsRanges, '721120', 'department', 'lodging'), null);
  assert.equal(jobsRangeForStream(jobsRanges, 'ONLINE_CASINO', 'total', 'total'), null);
  assert.equal(jobsRangeForStream(jobsRanges, '713210', 'total', 'total', 'tribal'), null);
  for (const v of Object.values(t)) {
    assert.ok(v.p05 < 1 && v.p95 > 1 && v.n >= 10 && v.pValueNoBias > 0.05);
  }
});

test('combined impact keeps coefficient jobs and sums ranges across streams', () => {
  const multipliers = [
    { ...row, Sector: '722' }, { ...row, Sector: '721' }, { ...row, Sector: '711AS' },
  ];
  const res = calculateCombinedImpact(
    { gaming: 100, food: 20, lodging: 0, other: 0 }, multipliers, [row], 'Nevada', true, {}, null,
    '721120', null, 'department', null, { analysisYear: 2023, jobsRanges },
  );
  const g = jobsRanges.propertyTypes['713210'];
  const e = res.totals.employment;
  closeTo(e.direct, 500 + 100);                                   // gaming + food, both at coefficient
  closeTo(e.detail.range.direct[0], 500 * g.p05 + 100);           // only gaming carries a range
  closeTo(e.detail.range.direct[1], 500 * g.p95 + 100);
});

test('payroll detail splits federal and state and matches the legacy total', () => {
  const st = employmentTaxRates.states.California;
  const fed = employmentTaxRates.federal;
  const d = calculatePayrollTaxDetail(50, 1000, st, fed);
  closeTo(d.federal + d.state, d.total);
  closeTo(d.total, calculatePayrollTax(50, 1000, st, fed));
  // FICA SS + Medicare + FUTA on $50,000 average wage per job
  closeTo(d.federal, (50000 * 0.062 + 50000 * 0.0145 + 7000 * 0.006) * 1000 / 1e6, 1e-9);
});

test('taxAtWage interpolates the wage grid and extrapolates the top marginal rate', () => {
  const grid = { min: 0, max: 3000, step: 1000 };
  const table = [0, 100, 300, 600];
  closeTo(taxAtWage(table, grid, 1500), 200);
  closeTo(taxAtWage(table, grid, 3000), 600);
  closeTo(taxAtWage(table, grid, 4000), 900);
  assert.equal(taxAtWage(table, grid, 0), 0);
});

test('household income tax is computed per worker and split by level', () => {
  const incomeTax = {
    wageGrid: { min: 0, max: 100000, step: 50000 },
    federal: { tax: [0, 4000, 12000] },
    states: { Testland: { state: [0, 1500, 4000], local: [0, 500, 1000] } },
  };
  // 100 jobs, $4M wages -> $40,000 per job (interpolated between 0 and 50k)
  const d = calculateIncomeTaxDetail(4, 100, incomeTax, 'Testland');
  closeTo(d.federal, 3200 * 100 / 1e6);
  closeTo(d.state, 1200 * 100 / 1e6);
  closeTo(d.local, 400 * 100 / 1e6);
  closeTo(d.total, d.federal + d.stateLocal);
  assert.equal(d.method, 'per_worker');

  const fallback = calculateIncomeTaxDetail(4, 100, incomeTax, 'Nowhere', { household_tax_ratio: 0.2 });
  assert.equal(fallback.method, 'bea_ratio');
  closeTo(fallback.total, 0.8);
});

test('statutory gaming tax replaces the gaming share of direct TOPI and lines are additive', () => {
  const impact = calculateSingleImpact(100, row, null, null, { deflator: 1 });
  const results = { totals: impact };
  const data = {
    stateEmp: employmentTaxRates.states.Pennsylvania, federalPayroll: employmentTaxRates.federal,
    incomeTax: null, stateName: 'Pennsylvania',
  };
  const gaming = { amount: 40, effectiveRate: 0.4, ggr: 100 };

  const additive = buildFiscal({ results, gamingTaxResult: gaming, gamingStreamTopiDirect: impact.tax.direct },
    { ...data, nonGamingShare: 1 });
  const topi = additive.lines.find(l => l.key === 'topi');
  closeTo(topi.direct, impact.tax.direct);
  closeTo(additive.lines.find(l => l.key === 'gaming').direct, 40);

  const netted = buildFiscal({ results, gamingTaxResult: gaming, gamingStreamTopiDirect: impact.tax.direct },
    { ...data, nonGamingShare: 0.25 });
  closeTo(netted.lines.find(l => l.key === 'topi').direct, impact.tax.direct * 0.25);

  for (const f of [additive, netted]) {
    const sum = f.lines.reduce((s, l) => s + l.total, 0);
    closeTo(f.totals.all.total, sum);
    closeTo(f.totals.federal.total + f.totals.stateLocal.total, f.totals.all.total);
  }
  // BEA-ratio fallback is a single combined household line
  assert.ok(additive.lines.some(l => l.key === 'income_combined'));
});

test('net share combines visitor revenue and recaptured resident play', () => {
  assert.equal(netShare({ enabled: false, nonResidentShare: 40 }), null);
  closeTo(netShare({ enabled: true, nonResidentShare: 40, recaptureShare: 20 }), 0.4 + 0.6 * 0.2);
  closeTo(netShare({ enabled: true, nonResidentShare: 140, recaptureShare: -5 }), 1);
  const impact = calculateSingleImpact(100, row, null, null, { deflator: 1 });
  const net = scaleTotals(impact, 0.5);
  closeTo(net.gdp.total, impact.gdp.total * 0.5);
  closeTo(net.employment.direct, impact.employment.direct * 0.5);
});

test('construction phase uses the construction row, in-state share and job-years', () => {
  const c = computeConstructionImpact({ enabled: true, cost: 200, localShare: 60, years: 2 },
    { ...row, Sector: '23' }, 1,
    { stateEmp: employmentTaxRates.states.Nevada, federalPayroll: employmentTaxRates.federal });
  closeTo(c.localSpend, 120);
  closeTo(c.output.total, 120 * 1.7);
  closeTo(c.annualJobs, c.employment.total / 2);
  assert.ok(c.fiscal.totals.all.total > 0);
  assert.equal(computeConstructionImpact({ enabled: false, cost: 200 }, row, 1, {}), null);
});

test('verified 2026 gaming tax schedules: add-ons, handle taxes and corrected rates', async () => {
  const { calculateGamingTax } = await import('./calculations.js');
  const { buildTaxConfig } = await import('./taxConfig.js');
  const rates = readJSON('../data/gamingTaxRates.json').rates;
  const tax = (state, ggr, pt = null, custom = null) =>
    calculateGamingTax(ggr, buildTaxConfig(rates[state], custom, 70, pt));
  closeTo(tax('New Jersey', 100), 9.25, 1e-9);                       // 8% + 1.25% IAT
  closeTo(tax('Michigan', 100), 20.25, 1e-9);                        // 8.1% + 10.9% + 1.25% fee
  closeTo(tax('Indiana', 20), 20 * 0.13, 1e-9);                      // 10% first tier + 3% supplemental
  closeTo(tax('Mississippi', 100), 0.6 * 0.044 + 1.008 * 0.066 + 98.392 * 0.088 + 100 * 0.032, 1e-9);
  closeTo(tax('Tennessee', 100, 'ONLINE_SPORTSBOOK'), 100 * 0.0185 / 0.095, 1e-9); // handle tax -> GGR
  closeTo(tax('Ohio', 100, 'ONLINE_SPORTSBOOK'), 20, 1e-9);
  closeTo(tax('Michigan', 100, null, 0.1), 10, 1e-9);                // custom rate replaces add-ons
  for (const [state, entry] of Object.entries(rates)) {
    if (entry.lastVerified) assert.ok(Array.isArray(entry.sources) && entry.sources.length > 0, state);
  }
});

test('cash wages use the QCEW-comparable share of each sector; ripple uses all-private', () => {
  const wb = readJSON('../data/wageBasis.json');
  const r = calculateSingleImpact(100, row, null, null, { deflator: 1, cashWageShare: { direct: wb.sectors['7132'], ripple: wb.private } });
  closeTo(r.cashWages.direct, r.wages.direct * wb.sectors['7132']);
  closeTo(r.cashWages.indirect, r.wages.indirect * wb.private);
  const known = calculateSingleImpact(100, row, null, 14, { deflator: 1, cashWageShare: { direct: 0.7, ripple: 0.8 } });
  closeTo(known.wages.direct, 14 / 0.7);
  closeTo(known.cashWages.direct, 14);
  assert.ok(wb.sectors['713'] < wb.private && wb.private < 0.85);
});

test('tribal properties: the compact revenue share replaces gaming TOPI', () => {
  const impact = calculateSingleImpact(100, row, null, null, { deflator: 1 });
  const data = { stateEmp: employmentTaxRates.states.Oklahoma, federalPayroll: employmentTaxRates.federal, incomeTax: null, stateName: 'Oklahoma', nonGamingShare: 0.346 };
  const share = { amount: 6, effectiveRate: 0.06, ggr: 100 };
  const f = buildFiscal({ results: { totals: impact }, gamingTaxResult: share, gamingStreamTopiDirect: impact.tax.direct, tribal: true }, data);
  closeTo(f.lines.find(l => l.key === 'topi').direct, 0);
  assert.equal(f.lines.find(l => l.key === 'gaming').label, 'Tribal revenue sharing (compact)');
  const none = buildFiscal({ results: { totals: impact }, gamingTaxResult: null, gamingStreamTopiDirect: impact.tax.direct, tribal: true }, data);
  assert.ok(!none.lines.some(l => l.key === 'gaming'));
  closeTo(none.lines.find(l => l.key === 'topi').direct, 0);
});

test('tribal total-mode input removes the direct TOPI of the whole gaming enterprise', () => {
  const impact = calculateSingleImpact(100, row, null, null, { deflator: 1 });
  const results = { totals: impact, byRevenue: [{ type: 'total', ...impact }] };
  const data = { stateEmp: employmentTaxRates.states.Oklahoma, federalPayroll: employmentTaxRates.federal, incomeTax: null, stateName: 'Oklahoma', nonGamingShare: 0.346 };
  const stream = results.byRevenue.find(r => r.type === 'gaming' || r.type === 'total');
  const f = buildFiscal({ results, gamingTaxResult: null, gamingStreamTopiDirect: stream.tax.direct, tribal: true }, data);
  closeTo(f.lines.find(l => l.key === 'topi').direct, 0);
  closeTo(f.lines.find(l => l.key === 'topi').indirect, impact.tax.indirect);
});

test('gaming-tax payroll adjustment lowers direct compensation and rebases induced effects', async () => {
  const { payrollFactorForStream } = await import('./calculations.js');
  const adj = readJSON('../data/payrollAdjustment.json');
  closeTo(payrollFactorForStream(adj, 0.4, '713210', 'total', 'total'), Math.exp(-adj.slope * 0.4));
  assert.equal(payrollFactorForStream(adj, 0, '713210', 'total', 'total'), 1);              // no tax: unbiased
  assert.equal(payrollFactorForStream(adj, 0.4, '721120', 'department', 'lodging'), 1);    // gaming stream only
  assert.equal(payrollFactorForStream(adj, 0.2, 'ONLINE_CASINO', 'total', 'total'), 1);
  const f = 0.7;
  const base = calculateSingleImpact(100, row, null, null, { deflator: 1 });
  const r = calculateSingleImpact(100, row, null, null, { deflator: 1, compensationFactor: f });
  closeTo(r.wages.direct, base.wages.direct * f);
  closeTo(r.wages.indirect, base.wages.indirect);
  const scale = (base.wages.direct * f + base.wages.indirect) / (base.wages.direct + base.wages.indirect);
  closeTo(r.gdp.induced, base.gdp.induced * scale);
  closeTo(r.employment.induced, base.employment.induced * scale);
  closeTo(r.gdp.direct, base.gdp.direct);
  closeTo(r.employment.direct, base.employment.direct);
  assert.equal(r.wages.source, 'adjusted');
  const known = calculateSingleImpact(100, row, null, 14, { deflator: 1, compensationFactor: f });
  assert.equal(known.wages.source, 'user');                                                // known wages win
});
