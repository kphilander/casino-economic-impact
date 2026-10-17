/**
 * Run the full impact + tax calculation for a single analysis.
 *
 * This is the engine behind the dashboard, scenario comparison, sensitivity
 * analysis and every export: they all read the same bundle, so the numbers
 * cannot drift apart between views.
 */
import multiplierData from '../data/multipliers.json';
import gamingTaxRatesData from '../data/gamingTaxRates.json';
import employmentTaxRatesData from '../data/employmentTaxRates.json';
import incomeTaxData from '../data/incomeTaxRates.json';
import laborCalibration from '../data/laborCalibration.json';
import fiscalAssumptions from '../data/fiscalAssumptions.json';
import wageBasis from '../data/wageBasis.json';
import {
  calculateCombinedImpact, calculateGamingTax, getTaxableGgr,
  isOnlinePropertyType, getDeflator, DEFAULT_ANALYSIS_YEAR,
} from './calculations';
import { buildFiscal, netShare, scaleTotals, computeConstructionImpact } from './fiscal';
import { buildTaxConfig } from './taxConfig';

const EFFECTS = ['direct', 'indirect', 'induced'];

/** Data for buildFiscal for one state, from the bundled tax tables. */
export function fiscalDataFor(state) {
  return {
    stateEmp: employmentTaxRatesData.states[state],
    federalPayroll: employmentTaxRatesData.federal,
    incomeTax: incomeTaxData,
    stateName: state,
    nonGamingShare: fiscalAssumptions.gamingTopi.nonGamingShare,
  };
}

export function computeScenario(analysis) {
  const {
    state, propertyType, inputMode, revenues, knownData,
    gamingTaxCustomRate, slotRevenuePct,
  } = analysis;
  const analysisYear = analysis.analysisYear ?? DEFAULT_ANALYSIS_YEAR;
  const employmentBasis = analysis.employmentBasis || 'calibrated';
  const tribal = analysis.ownership === 'tribal' && !isOnlinePropertyType(analysis.propertyType);

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
    { analysisYear, laborCalibration, employmentBasis, wageBasis, ownership: tribal ? 'tribal' : 'commercial' },
  );

  // Gaming tax (on GGR)
  const stateTaxConfig = gamingTaxRatesData.rates[state];
  let gamingTaxResult = null;
  const hasGamingTax = isOnline
    ? (propertyType === 'ONLINE_CASINO' ? stateTaxConfig?.hasIGaming : stateTaxConfig?.hasSportsBetting)
    : stateTaxConfig?.hasCommercial;
  const ggr = getTaxableGgr(inputMode, isOnline, revenues);
  const hasCustom = gamingTaxCustomRate != null && gamingTaxCustomRate !== '';
  // Tribal properties pay no state gaming tax; the custom rate is the compact
  // revenue share, if any.
  if ((tribal ? hasCustom : (hasGamingTax || hasCustom)) && ggr > 0) {
    const taxConfig = buildTaxConfig(stateTaxConfig, gamingTaxCustomRate, slotRevenuePct, propertyType);
    const amount = calculateGamingTax(ggr, taxConfig);
    gamingTaxResult = { amount, effectiveRate: ggr > 0 ? amount / ggr : 0, ggr };
  }

  // Direct TOPI of the revenue stream that the statutory tax applies to. For a
  // tribal property entered as total revenue, the whole input is the tribal
  // gaming enterprise, so its direct TOPI is the one replaced.
  const gamingStream = results?.byRevenue.find(r => r.type === 'gaming' || ((isOnline || tribal) && r.type === 'total'));
  const fiscalData = fiscalDataFor(state);
  const fiscal = buildFiscal({
    results, gamingTaxResult, tribal,
    gamingStreamTopiDirect: (gamingTaxResult || tribal) && gamingStream ? gamingStream.tax.direct : 0,
  }, fiscalData);

  // Legacy shapes consumed by older report code paths.
  const payrollTaxResult = fiscal && {
    ...Object.fromEntries(EFFECTS.map(e => [e, fiscal.payroll[e].total])),
    get total() { return this.direct + this.indirect + this.induced; },
  };
  const householdTaxResult = fiscal && {
    ...Object.fromEntries(EFFECTS.map(e => [e, fiscal.income[e].total])),
    get total() { return this.direct + this.indirect + this.induced; },
  };
  const totalTax = fiscal?.totals.all.total || 0;

  const share = netShare(analysis.netImpact);
  const net = results && share != null
    ? { share, totals: scaleTotals(results.totals, share) }
    : null;

  const constructionRow = (multiplierData.construction || []).find(d => d.State === state);
  const construction = computeConstructionImpact(
    analysis.construction, constructionRow, getDeflator(analysisYear), fiscalData,
    { direct: wageBasis.sectors['23'] ?? wageBasis.private, ripple: wageBasis.private });

  return {
    results, fiscal, gamingTaxResult, payrollTaxResult, householdTaxResult,
    totalTax, stateTaxConfig, net, construction, analysisYear, employmentBasis,
    ownership: tribal ? 'tribal' : 'commercial',
  };
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
    gamingTax: bundle.gamingTaxResult?.amount || 0,
    totalTax: bundle.totalTax,
  };
}
