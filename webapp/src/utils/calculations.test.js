import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  WAGE_SHARE_OF_COMPENSATION,
  calculateCombinedImpact,
  calculatePayrollTax,
  calculateSingleImpact,
  getDeflator,
  getTaxableGgr,
} from './calculations.js';

const stateData = {
  State: 'Nevada',
  Sector: '713',
  Direct_VA_Coef: 0.5,
  Direct_Wage_Coef: 0.2,
  Direct_Tax_Coef: 0.05,
  Emp_Coef: 10,
  Direct_Jobs_Per_1M_Output: 5,
  Indirect_Emp_Coef: 8,
  Induced_Emp_Coef: 6,
  Type_I_Output: 1.4,
  Type_II_Output: 1.7,
  Type_I_VA: 0.65,
  Type_II_VA: 0.8,
  Type_I_Wage: 0.3,
  Type_II_Wage: 0.38,
  Type_I_Tax: 0.07,
  Type_II_Tax: 0.09,
};

const closeTo = (actual, expected, tolerance = 1e-10) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test('modeled results retain Type II totals and expose a separate cash-wage base', () => {
  const result = calculateSingleImpact(100, stateData);

  closeTo(result.output.direct, 100);
  closeTo(result.output.indirect, 40);
  closeTo(result.output.induced, 30);
  closeTo(result.output.total, 170);
  closeTo(result.gdp.direct, 50);
  closeTo(result.gdp.indirect, 15);
  closeTo(result.gdp.induced, 15);
  closeTo(result.gdp.total, 80);
  closeTo(result.wages.direct, 20);
  closeTo(result.wages.indirect, 10);
  closeTo(result.wages.induced, 8);
  closeTo(result.wages.total, 38);
  closeTo(
    result.employment.direct,
    100 * getDeflator(new Date().getFullYear()) * stateData.Direct_Jobs_Per_1M_Output,
  );
  assert.equal(result.wages.source, 'calculated');
  closeTo(result.cashWages.total, 38 * WAGE_SHARE_OF_COMPENSATION);
  assert.equal(result.adjustments.inducedScale, 1);
});

test('known cash wages replace direct compensation and rebase induced effects only', () => {
  const knownCashWages = 10;
  const result = calculateSingleImpact(100, stateData, null, knownCashWages);
  const knownCompensation = knownCashWages / WAGE_SHARE_OF_COMPENSATION;
  const scale = (knownCompensation + 10) / 30;

  closeTo(result.wages.direct, knownCompensation);
  assert.equal(result.wages.indirect, 10);
  closeTo(result.wages.induced, 8 * scale);
  closeTo(result.output.indirect, 40);
  closeTo(result.output.induced, 30 * scale);
  closeTo(result.gdp.indirect, 15);
  closeTo(result.gdp.induced, 15 * scale);
  closeTo(
    result.employment.induced,
    (15 * scale * getDeflator(new Date().getFullYear())) * stateData.Induced_Emp_Coef,
  );
  closeTo(result.tax.induced, 2 * scale);
  closeTo(result.cashWages.direct, knownCashWages);
  closeTo(result.adjustments.inducedScale, scale);
});

test('known employment replaces direct jobs without changing modeled ripple jobs', () => {
  const modeled = calculateSingleImpact(100, stateData);
  const observed = calculateSingleImpact(100, stateData, 75);

  assert.equal(observed.employment.direct, 75);
  assert.equal(observed.employment.source, 'user');
  closeTo(observed.employment.indirect, modeled.employment.indirect);
  closeTo(observed.employment.induced, modeled.employment.induced);
});

test('combined impact aggregates cash wages separately from employee compensation', () => {
  const result = calculateCombinedImpact(
    { gaming: 100 },
    [stateData],
    [stateData],
    'Nevada',
    true,
    { gaming: { emp: 75, wages: 10 } },
  );

  assert.equal(result.totals.employment.direct, 75);
  closeTo(result.totals.cashWages.direct, 10);
  assert.ok(result.totals.wages.direct > result.totals.cashWages.direct);
});

test('payroll tax uses cash wages and the number of filled jobs', () => {
  const stateRates = {
    suta_avg_rate: 0.02,
    suta_wage_base: 10_000,
    sdi_employer_rate: 0,
    pfml_employer_rate: 0,
  };
  const federal = {
    fica_ss_rate: 0.062,
    fica_ss_wage_cap: 176_100,
    fica_medicare_rate: 0.0145,
    futa_rate: 0.006,
    futa_wage_base: 7_000,
  };

  // $1M across ten jobs is below the SS cap but above the FUTA/SUTA bases.
  const expected = 1 * (0.062 + 0.0145) + (10 * 7_000 * 0.006) / 1e6
    + (10 * 10_000 * 0.02) / 1e6;
  closeTo(calculatePayrollTax(1, 10, stateRates, federal), expected);
});

test('inflation adjustment uses BLS calendar-year averages and latest-complete fallback', () => {
  closeTo(getDeflator(2023), 1);
  closeTo(getDeflator(2025), 304.702 / 321.943);
  closeTo(getDeflator(2026), 304.702 / 321.943);
});

test('land-based property labels do not substitute hospitality coefficients for gaming', () => {
  const lodgingProxy = { ...stateData, Direct_VA_Coef: 0.9, Sector: '721' };
  const propertyTypes = {
    '721120': [{ ...lodgingProxy, State: 'Nevada' }],
    '722410': [{ ...lodgingProxy, State: 'Nevada' }],
  };

  const casinoHotel = calculateCombinedImpact(
    { total: 100 }, [stateData], [stateData], 'Nevada', true, null,
    null, '721120', propertyTypes, 'total',
  );
  const barGaming = calculateCombinedImpact(
    { total: 100 }, [stateData], [stateData], 'Nevada', true, null,
    null, '722410', propertyTypes, 'total',
  );

  closeTo(casinoHotel.totals.gdp.direct, 50);
  closeTo(barGaming.totals.gdp.direct, 50);
});

test('legacy total operating revenue is not silently taxed as land-based GGR', () => {
  assert.equal(getTaxableGgr('total', false, { total: 100, gaming: 100 }), 0);
  assert.equal(getTaxableGgr('total', true, { total: 100 }), 100);
  assert.equal(getTaxableGgr('department', false, { gaming: 60, total: 100 }), 60);
});

test('federal payroll parameters use the 2026 Social Security wage base', () => {
  const rates = JSON.parse(fs.readFileSync(
    new URL('../data/employmentTaxRates.json', import.meta.url),
    'utf8',
  ));
  assert.equal(rates.federal.fica_ss_wage_cap, 184_500);
  assert.equal(rates.federal.fica_ss_rate, 0.062);
  assert.equal(rates.federal.fica_medicare_rate, 0.0145);
});

test('deployed multiplier metadata is complete and idempotent', () => {
  const bundle = JSON.parse(fs.readFileSync(
    new URL('../data/multipliers.json', import.meta.url),
    'utf8',
  ));
  assert.equal(bundle.metadata.stateCount, 50);
  assert.equal(bundle.metadata.multiplierRowCount, 200);
  assert.equal(bundle.states.length, 50);

  for (const code of ['721120', '713210', '713290', '722410']) {
    const description = bundle.propertyTypeMetadata[code].description;
    assert.equal((description.match(/canonical gambling coefficients/g) || []).length, 1);
  }
});
