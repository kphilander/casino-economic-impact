/**
 * Pure fiscal and optional-module logic, separated from computeScenario so it
 * can be unit-tested without the bundled JSON data (all data is passed in).
 */
import {
  calculatePayrollTaxDetail, calculateIncomeTaxDetail, calculateSingleImpact,
} from './calculations.js';

export const EFFECTS = ['direct', 'indirect', 'induced'];

function line(key, label, level, values, note = null) {
  const v = { direct: values.direct || 0, indirect: values.indirect || 0, induced: values.induced || 0 };
  return { key, label, level, ...v, total: v.direct + v.indirect + v.induced, note };
}

function sumLines(lines, predicate = () => true) {
  const out = { direct: 0, indirect: 0, induced: 0, total: 0 };
  for (const l of lines.filter(predicate)) {
    for (const e of [...EFFECTS, 'total']) out[e] += l[e];
  }
  return out;
}

/**
 * Fiscal lines for one set of impact totals.
 *
 * - Statutory gaming tax REPLACES the gaming stream's share of direct TOPI:
 *   direct taxes on gaming = statutory gaming tax + the non-gaming share of the
 *   I-O direct TOPI (fiscalAssumptions.json documents how that share is
 *   estimated). Supplier and induced TOPI are unchanged.
 * - Payroll and household income taxes are split federal vs. state/local and
 *   use estimated cash wages and filled jobs per effect.
 *
 * data = { stateEmp, federalPayroll, incomeTax, stateName, nonGamingShare }
 */
export function buildFiscal({ results, gamingTaxResult = null, gamingStreamTopiDirect = 0, tribal = false }, data) {
  if (!results) return null;
  const t = results.totals;
  const { stateEmp, federalPayroll, incomeTax, stateName } = data;
  const nonGamingShare = data.nonGamingShare ?? 1;
  const lines = [];

  let topiDirect = t.tax.direct;
  if (tribal) {
    // Tribal gaming on trust land pays compact revenue sharing rather than
    // state gaming, sales or property taxes: the gaming stream's direct TOPI
    // is replaced entirely by the revenue share (if one is entered).
    topiDirect = t.tax.direct - gamingStreamTopiDirect;
    if (gamingTaxResult) {
      lines.push(line('gaming', 'Tribal revenue sharing (compact)', 'state_local',
        { direct: gamingTaxResult.amount },
        `${(gamingTaxResult.effectiveRate * 100).toFixed(1)}% of GGR`));
    }
  } else if (gamingTaxResult) {
    // The statutory tax replaces the gaming share of the gaming stream's TOPI.
    topiDirect = t.tax.direct - (1 - nonGamingShare) * gamingStreamTopiDirect;
    lines.push(line('gaming', 'Gaming tax (statutory, on GGR)', 'state_local',
      { direct: gamingTaxResult.amount },
      `${(gamingTaxResult.effectiveRate * 100).toFixed(1)}% effective rate`));
  }
  lines.push(line('topi', gamingTaxResult ? 'Other taxes on production and imports' : 'Taxes on production and imports (TOPI)',
    'state_local', { direct: topiDirect, indirect: t.tax.indirect, induced: t.tax.induced },
    'Sales, property, excise and license taxes from the I-O model (mostly state and local)'));

  const payroll = {};
  const income = {};
  for (const e of EFFECTS) {
    payroll[e] = calculatePayrollTaxDetail(t.cashWages[e], t.employment[e], stateEmp, federalPayroll);
    income[e] = calculateIncomeTaxDetail(t.cashWages[e], t.employment[e], incomeTax, stateName, stateEmp);
  }
  const pick = (obj, k) => Object.fromEntries(EFFECTS.map(e => [e, obj[e][k]]));
  lines.push(line('payroll_federal', 'Federal payroll taxes (FICA, FUTA)', 'federal', pick(payroll, 'federal')));
  lines.push(line('payroll_state', 'State payroll taxes (UI, SDI, PFML)', 'state_local', pick(payroll, 'state')));
  if (income.direct.method === 'bea_ratio') {
    // The BEA ratio has no federal/state split; report it as one line.
    lines.push(line('income_combined', 'Household income taxes (BEA ratio)', 'state_local', pick(income, 'total'),
      'Federal, state and local combined; BEA personal current taxes / wages'));
  } else {
    lines.push(line('income_federal', 'Federal income tax (households)', 'federal', pick(income, 'federal')));
    lines.push(line('income_state_local', 'State and local income tax (households)', 'state_local', pick(income, 'stateLocal')));
  }

  const kept = lines.filter(l => l.key === 'gaming' || l.key === 'topi' || Math.abs(l.total) > 1e-12);
  return {
    lines: kept,
    totals: {
      all: sumLines(kept),
      federal: sumLines(kept, l => l.level === 'federal'),
      stateLocal: sumLines(kept, l => l.level === 'state_local'),
    },
    incomeTaxMethod: income.direct.method,
    payroll, income,
  };
}

const clampPct = (v) => Math.min(100, Math.max(0, Number(v) || 0));

/**
 * Net new impact: the share of revenue that is new to the state economy.
 *   net share = non-resident share + resident share x recapture share
 * where the recapture share is the part of residents' gaming spending that
 * would otherwise have left the state (e.g. play at out-of-state casinos).
 * The remainder is treated as displaced local spending. Linear scaling is
 * exact for the I-O quantities; fiscal lines are reported gross.
 */
export function netShare(netImpact) {
  if (!netImpact?.enabled) return null;
  const nonRes = clampPct(netImpact.nonResidentShare) / 100;
  const recap = clampPct(netImpact.recaptureShare) / 100;
  return nonRes + (1 - nonRes) * recap;
}

/** Scale every additive impact metric by a share (net-impact module). */
export function scaleTotals(totals, share) {
  const out = {};
  for (const metric of ['output', 'gdp', 'employment', 'fte', 'wages', 'cashWages', 'tax']) {
    out[metric] = {};
    for (const e of [...EFFECTS, 'total']) out[metric][e] = (totals[metric]?.[e] || 0) * share;
  }
  return out;
}

/**
 * One-time construction-phase impact from StateIO construction (23)
 * multipliers. Jobs are job-years over the build period.
 */
export function computeConstructionImpact(construction, constructionRow, deflator, fiscalData, cashWageShare) {
  if (!construction?.enabled || !constructionRow) return null;
  const cost = Number(construction.cost) || 0;
  const localSpend = cost * clampPct(construction.localShare ?? 100) / 100;
  const years = Math.max(1, Number(construction.years) || 1);
  if (localSpend <= 0) return null;
  const impact = calculateSingleImpact(localSpend, constructionRow, null, null, { deflator, cashWageShare });
  if (!impact) return null;
  const fiscal = buildFiscal({ results: { totals: impact } }, fiscalData);
  return { cost, localSpend, years, ...impact, fiscal, annualJobs: impact.employment.total / years };
}
