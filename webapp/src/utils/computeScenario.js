/**
 * Run the full impact + tax calculation for a single analysis.
 *
 * This is the engine behind scenario comparison and sensitivity analysis: it
 * mirrors exactly what the dashboard computes for the active inputs, so any
 * number of scenarios can be evaluated consistently and side by side.
 */
import multiplierData from '../data/multipliers.json';
import gamingTaxRatesData from '../data/gamingTaxRates.json';
import employmentTaxRatesData from '../data/employmentTaxRates.json';
import {
  calculateCombinedImpact, calculateGamingTax, calculatePayrollTax,
  calculateHouseholdTax, isOnlinePropertyType,
} from './calculations';
import { buildTaxConfig } from './taxConfig';

export function computeScenario(analysis) {
  const {
    state, propertyType, inputMode, revenues, knownData,
    gamingTaxCustomRate, slotRevenuePct,
  } = analysis;

  const isOnline = isOnlinePropertyType(propertyType);

  const results = calculateCombinedImpact(
    revenues,
    multiplierData.multipliers,
    multiplierData.gambling,
    state,
    true,
    knownData || {},
    null,
    propertyType || null,
    multiplierData.propertyTypes || null,
    inputMode,
    multiplierData.onlineGaming || null,
  );

  // Gaming tax (on GGR)
  const stateTaxConfig = gamingTaxRatesData.rates[state];
  let gamingTaxResult = null;
  const hasGamingTax = isOnline
    ? (propertyType === 'ONLINE_CASINO' ? stateTaxConfig?.hasIGaming : stateTaxConfig?.hasSportsBetting)
    : stateTaxConfig?.hasCommercial;
  const ggr = inputMode === 'total' ? (revenues.total || 0) : (revenues.gaming || 0);
  const hasCustom = gamingTaxCustomRate != null && gamingTaxCustomRate !== '';
  if ((hasGamingTax || hasCustom) && ggr > 0) {
    const taxConfig = buildTaxConfig(stateTaxConfig, gamingTaxCustomRate, slotRevenuePct, propertyType);
    const amount = calculateGamingTax(ggr, taxConfig);
    gamingTaxResult = { amount, effectiveRate: ggr > 0 ? amount / ggr : 0, ggr };
  }

  // Payroll + household taxes (on wages/employment)
  const stateEmp = employmentTaxRatesData.states[state];
  const federal = employmentTaxRatesData.federal;
  let payrollTaxResult = null;
  let householdTaxResult = null;
  if (results && stateEmp) {
    const w = results.totals.wages;
    const e = results.totals.employment;
    payrollTaxResult = {
      direct: calculatePayrollTax(w.direct, e.direct, stateEmp, federal),
      indirect: calculatePayrollTax(w.indirect, e.indirect, stateEmp, federal),
      induced: calculatePayrollTax(w.induced, e.induced, stateEmp, federal),
      get total() { return this.direct + this.indirect + this.induced; },
    };
    householdTaxResult = {
      direct: calculateHouseholdTax(w.direct, stateEmp),
      indirect: calculateHouseholdTax(w.indirect, stateEmp),
      induced: calculateHouseholdTax(w.induced, stateEmp),
      get total() { return this.direct + this.indirect + this.induced; },
    };
  }

  const totalTax = (gamingTaxResult?.amount || 0)
    + (results?.totals.tax.total || 0)
    + (payrollTaxResult?.total || 0)
    + (householdTaxResult?.total || 0);

  return { results, gamingTaxResult, payrollTaxResult, householdTaxResult, totalTax, stateTaxConfig };
}

/** Convenience: the headline scalars used in comparison/sensitivity views. */
export function headlineMetrics(bundle) {
  const r = bundle.results;
  if (!r) return null;
  return {
    output: r.totals.output.total,
    gdp: r.totals.gdp.total,
    employment: r.totals.employment.total,
    wages: r.totals.wages.total,
    totalTax: bundle.totalTax,
  };
}
