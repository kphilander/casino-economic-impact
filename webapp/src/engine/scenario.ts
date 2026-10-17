/**
 * One analysis, end to end: revenue streams -> regional impacts -> gaming tax
 * -> fiscal lines, plus the net-impact and construction modules. The results
 * view, scenario comparison and sensitivity analysis all call computeScenario,
 * so their numbers cannot diverge.
 */
import gamingTaxRates from '../data/gamingTaxRates.json';
import employmentTaxRates from '../data/employmentTaxRates.json';
import incomeTaxRates from '../data/incomeTaxRates.json';
import jobsRangeData from '../data/jobsRange.json';
import fiscalAssumptions from '../data/fiscalAssumptions.json';
import wageBasisData from '../data/wageBasis.json';
import payrollAdjustmentData from '../data/payrollAdjustment.json';
import type { RegionalModel } from './io';
import { ACTIVITIES, activityResponse, directFtePerJob, type ActivityKey } from './activities';
import { addImpacts, scaleImpact, streamImpact, type Effects, type Impact, type ImpactMetric, type JobsRange } from './impact';
import { buildFiscal, type Fiscal, type FiscalData } from './fiscal';
import {
  gamingTax as computeGamingTax, hasGamingTax, taxRule, verticalSchedule,
  type FederalPayroll, type GamingVertical, type IncomeTaxTables, type StateGamingTax,
  type StatePayroll, type TaxRule,
} from './tax';
import { deflator as deflatorFor, LATEST_CPI_YEAR } from './prices';

// ------------------------------------------------------------ inputs

export type PropertyType = '721120' | '713210' | '713290' | '722410' | 'ONLINE_CASINO' | 'ONLINE_SPORTSBOOK';

export const PROPERTY_TYPES: Record<PropertyType, { label: string; online: boolean; description: string }> = {
  '721120': { label: 'Resort with hotel and casino', online: false, description: 'Casino hotel (NAICS 721120)' },
  '713210': { label: 'Stand-alone casino', online: false, description: 'Casino without a hotel (NAICS 713210)' },
  '713290': { label: 'Slot parlor or bingo hall', online: false, description: 'Racino, slot parlor or bingo hall (NAICS 713290)' },
  '722410': { label: 'Bar or restaurant with slots', online: false, description: 'Video gaming terminals in bars and restaurants' },
  ONLINE_CASINO: { label: 'Online casino (iGaming)', online: true, description: 'Online casino gaming operator' },
  ONLINE_SPORTSBOOK: { label: 'Online sportsbook', online: true, description: 'Online sports betting operator' },
};

export const isOnline = (pt: PropertyType): boolean => PROPERTY_TYPES[pt].online;

export const DEPARTMENTS = ['gaming', 'food', 'lodging', 'other'] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  gaming: 'Gaming (GGR)', food: 'Food and beverage', lodging: 'Lodging', other: 'Entertainment and other',
};

const DEPARTMENT_ACTIVITY: Record<Department, ActivityKey> = {
  gaming: 'gambling', food: 'food', lodging: 'lodging', other: 'other',
};

export interface KnownData { jobs: number | null; wages: number | null }

export interface Analysis {
  v: 3;
  state: string;
  name: string;
  propertyType: PropertyType;
  ownership: 'commercial' | 'tribal';
  inputMode: 'department' | 'total';
  /** Revenue in $M of the dollar year. */
  revenue: Record<Department | 'total', number | null>;
  /** Observed direct jobs and cash wages ($M) by department. */
  known: Record<Department, KnownData>;
  gamingTax: { customRate: number | null; slotSharePct: number };
  /** Dollar year of the revenue inputs; null = latest complete CPI year. */
  dollarYear: number | null;
  netImpact: { enabled: boolean; nonResidentShare: number | null; recaptureShare: number };
  construction: { enabled: boolean; cost: number | null; localShare: number; years: number };
}

export const emptyKnown = (): Record<Department, KnownData> => ({
  gaming: { jobs: null, wages: null }, food: { jobs: null, wages: null },
  lodging: { jobs: null, wages: null }, other: { jobs: null, wages: null },
});

export function defaultAnalysis(): Analysis {
  return {
    v: 3,
    state: 'Nevada',
    name: '',
    propertyType: '721120',
    ownership: 'commercial',
    inputMode: 'department',
    revenue: { gaming: 250, food: 40, lodging: 60, other: 10, total: null },
    known: emptyKnown(),
    gamingTax: { customRate: null, slotSharePct: 70 },
    dollarYear: null,
    netImpact: { enabled: false, nonResidentShare: null, recaptureShare: 0 },
    construction: { enabled: false, cost: null, localShare: 60, years: 2 },
  };
}

// ------------------------------------------------------------ reference data

export const GAMING_TAX = gamingTaxRates as unknown as { metadata: Record<string, unknown>; rates: Record<string, StateGamingTax> };
const EMPLOYMENT_TAX = employmentTaxRates as unknown as { federal: FederalPayroll; states: Record<string, StatePayroll> };
const INCOME_TAX = incomeTaxRates as unknown as IncomeTaxTables;

interface RangeEntry { label: string; n: number; biasFactor: number; pValueNoBias: number; p05: number; p95: number }
export const JOBS_RANGES = jobsRangeData as unknown as { gamingDepartmentProxy: string; propertyTypes: Record<string, RangeEntry> };
export const WAGE_BASIS = wageBasisData as unknown as { sectors: Record<string, number>; private: number };
export const PAYROLL_ADJUSTMENT = payrollAdjustmentData as unknown as {
  slope: number; slopeSE: number; slopeCI95: [number, number]; n: number;
  leaveOneOutMAE: { before: number; after: number };
};
export const NON_GAMING_TOPI_SHARE: number = fiscalAssumptions.gamingTopi.nonGamingShare;

export function fiscalDataFor(state: string): FiscalData {
  return {
    stateName: state,
    statePayroll: EMPLOYMENT_TAX.states[state],
    federalPayroll: EMPLOYMENT_TAX.federal,
    incomeTax: INCOME_TAX,
    nonGamingShare: NON_GAMING_TOPI_SHARE,
  };
}

// ------------------------------------------------------------ rules

type StreamKey = Department | 'total';

/**
 * Multiplier on direct compensation of a land-based gaming stream for the
 * gaming tax carried in its revenue: exp(-slope x rate). The slope comes from
 * the model's payroll share of casino revenue against the 2022 Economic
 * Census (payrollAdjustment.json); the model is unbiased at a zero rate.
 */
export function payrollFactor(rate: number, online: boolean, inputMode: Analysis['inputMode'], stream: StreamKey): number {
  if (!(rate > 0) || online) return 1;
  const gamingStream = stream === 'gaming' || (inputMode === 'total' && stream === 'total');
  return gamingStream ? Math.exp(-PAYROLL_ADJUSTMENT.slope * rate) : 1;
}

/**
 * Direct-jobs predictive range for a stream (jobsRange.json): the property
 * type's range in total mode; in department mode the gaming stream uses the
 * stand-alone casino range (the slot-parlor range for slot parlors). None for
 * bars with slots, tribal properties, online operators or other departments.
 */
export function jobsRangeFor(pt: PropertyType, ownership: Analysis['ownership'], inputMode: Analysis['inputMode'], stream: StreamKey): { p05: number; p95: number } | null {
  if (ownership === 'tribal' || isOnline(pt)) return null;
  const types = JOBS_RANGES.propertyTypes;
  if (inputMode === 'total' && stream === 'total') return types[pt] ?? null;
  if (stream === 'gaming') return types[pt === '713290' ? '713290' : JOBS_RANGES.gamingDepartmentProxy] ?? null;
  return null;
}

/** Share of revenue that is new to the state: visitors plus recaptured resident play. */
export function netShare(n: Analysis['netImpact']): number | null {
  if (!n.enabled) return null;
  const clamp = (v: number | null) => Math.min(100, Math.max(0, Number(v) || 0)) / 100;
  const nonRes = clamp(n.nonResidentShare);
  return nonRes + (1 - nonRes) * clamp(n.recaptureShare);
}

// ------------------------------------------------------------ result

export interface Stream {
  key: StreamKey;
  label: string;
  activity: ActivityKey;
  revenue: number;
  impact: Impact;
}

export type Totals = Record<ImpactMetric, Effects> & { jobsRange: JobsRange | null; rippleJobsByIndustry: Float64Array };

export interface GamingTaxResult {
  amount: number;
  effectiveRate: number;
  ggr: number;
  rule: TaxRule;
  tribal: boolean;
}

export interface ConstructionResult {
  cost: number;
  localSpend: number;
  years: number;
  impact: Impact;
  fiscal: Fiscal;
  annualJobs: number;
}

export interface ScenarioResult {
  analysis: Analysis;
  dollarYear: number;
  deflator: number;
  streams: Stream[];
  totals: Totals;
  gamingTax: GamingTaxResult | null;
  /** Rate used by the payroll adjustment and the change in direct compensation. */
  payrollAdjustment: { rate: number; factor: number; directChange: number } | null;
  fiscal: Fiscal;
  net: { share: number; totals: Record<ImpactMetric, Effects> } | null;
  construction: ConstructionResult | null;
  stateTax: StateGamingTax | undefined;
}

function vertical(pt: PropertyType): GamingVertical {
  if (pt === 'ONLINE_CASINO') return 'igaming';
  if (pt === 'ONLINE_SPORTSBOOK') return 'sports';
  return 'land';
}

const positive = (v: number | null | undefined): number => (v != null && v > 0 ? v : 0);

export function computeScenario(a: Analysis, model: RegionalModel): ScenarioResult | null {
  const online = isOnline(a.propertyType);
  const tribal = a.ownership === 'tribal' && !online;
  const dollarYear = a.dollarYear ?? LATEST_CPI_YEAR;
  const deflator = deflatorFor(dollarYear);
  const stateTax = GAMING_TAX.rates[a.state];
  const v = vertical(a.propertyType);

  // Gaming tax on GGR. A land-based total-revenue input may include rooms,
  // food and other revenue, so it is never taxed as GGR.
  const ggr = a.inputMode === 'total' ? (online ? positive(a.revenue.total) : 0) : positive(a.revenue.gaming);
  const custom = a.gamingTax.customRate;
  let gamingTax: GamingTaxResult | null = null;
  if ((tribal ? custom != null : hasGamingTax(stateTax, v) || custom != null) && ggr > 0) {
    const rule = taxRule(verticalSchedule(stateTax, v), custom, a.gamingTax.slotSharePct);
    const amount = computeGamingTax(ggr, rule);
    gamingTax = { amount, effectiveRate: amount / ggr, ggr, rule, tribal };
  }
  const taxRate = gamingTax ? gamingTax.effectiveRate
    : custom != null ? custom
      : !online && !tribal && stateTax?.hasCommercial ? stateTax.effectiveRate ?? 0 : 0;

  // Revenue streams.
  const plan: { key: StreamKey; label: string; activity: ActivityKey; revenue: number; known: KnownData }[] = [];
  if (a.inputMode === 'total') {
    const sumKnown = (k: keyof KnownData) => DEPARTMENTS.reduce((s, d) => s + positive(a.known[d][k]), 0) || null;
    plan.push({
      key: 'total', label: PROPERTY_TYPES[a.propertyType].label, activity: online ? 'online' : 'gambling',
      revenue: positive(a.revenue.total), known: { jobs: sumKnown('jobs'), wages: sumKnown('wages') },
    });
  } else if (online) {
    plan.push({
      key: 'gaming', label: a.propertyType === 'ONLINE_SPORTSBOOK' ? 'Sports betting GGR' : 'Online GGR',
      activity: 'online', revenue: positive(a.revenue.gaming), known: a.known.gaming,
    });
  } else {
    for (const d of DEPARTMENTS) {
      plan.push({ key: d, label: DEPARTMENT_LABELS[d], activity: DEPARTMENT_ACTIVITY[d], revenue: positive(a.revenue[d]), known: a.known[d] });
    }
  }

  const streams: Stream[] = [];
  for (const p of plan) {
    if (!(p.revenue > 0)) continue;
    const impact = streamImpact(activityResponse(model, p.activity), p.revenue, {
      deflator,
      knownJobs: p.known.jobs,
      knownWages: p.known.wages,
      // Own-sector wage share for direct effects (all-private for online
      // operators); all-private for supplier and induced effects.
      cashShare: { direct: WAGE_BASIS.sectors[ACTIVITIES[p.activity].sector] ?? WAGE_BASIS.private, ripple: WAGE_BASIS.private },
      compensationFactor: payrollFactor(taxRate, online, a.inputMode, p.key),
      jobsRange: jobsRangeFor(a.propertyType, tribal ? 'tribal' : 'commercial', a.inputMode, p.key),
      directFtePerJob: directFtePerJob(model, p.activity),
    });
    if (impact) streams.push({ key: p.key, label: p.label, activity: p.activity, revenue: p.revenue, impact });
  }
  if (streams.length === 0) return null;

  const totals = addImpacts(streams.map((s) => s.impact)) as Totals;
  const adjusted = streams.filter((s) => s.impact.compensationAdjustment);
  const payrollAdjustment = adjusted.length ? {
    rate: taxRate,
    factor: adjusted[0].impact.compensationAdjustment!.factor,
    directChange: adjusted.reduce((s, x) => s + x.impact.compensation.direct - x.impact.compensationAdjustment!.modelDirect, 0),
  } : null;

  // The gaming tax replaces direct TOPI of the stream it is levied on. For a
  // tribal property entered as total revenue, that is the whole enterprise.
  const gamingStream = streams.find((s) => s.key === 'gaming' || ((online || tribal) && s.key === 'total'));
  const fiscalData = fiscalDataFor(a.state);
  const fiscal = buildFiscal({
    cashWages: totals.cashWages, jobs: totals.jobs, topi: totals.topi,
    gamingTax, tribal,
    gamingStreamTopi: (gamingTax || tribal) && gamingStream ? gamingStream.impact.topi.direct : 0,
  }, fiscalData);

  const share = netShare(a.netImpact);
  const net = share != null ? { share, totals: scaleImpact(totals, share) } : null;

  let construction: ConstructionResult | null = null;
  const c = a.construction;
  const localSpend = positive(c.cost) * Math.min(100, Math.max(0, c.localShare ?? 100)) / 100;
  if (c.enabled && localSpend > 0) {
    const impact = streamImpact(activityResponse(model, 'construction'), localSpend, {
      deflator,
      cashShare: { direct: WAGE_BASIS.sectors['23'] ?? WAGE_BASIS.private, ripple: WAGE_BASIS.private },
      directFtePerJob: directFtePerJob(model, 'construction'),
    })!;
    const years = Math.max(1, Number(c.years) || 1);
    construction = {
      cost: positive(c.cost), localSpend, years, impact,
      fiscal: buildFiscal({ cashWages: impact.cashWages, jobs: impact.jobs, topi: impact.topi }, fiscalData),
      annualJobs: impact.jobs.total / years,
    };
  }

  return {
    analysis: a, dollarYear, deflator, streams, totals, gamingTax, payrollAdjustment,
    fiscal, net, construction, stateTax,
  };
}

export interface Headline {
  output: number;
  gdp: number;
  jobs: number;
  compensation: number;
  gamingTax: number;
  totalTax: number;
}

export function headline(r: ScenarioResult): Headline {
  return {
    output: r.totals.output.total,
    gdp: r.totals.gdp.total,
    jobs: r.totals.jobs.total,
    compensation: r.totals.compensation.total,
    gamingTax: r.gamingTax?.amount ?? 0,
    totalTax: r.fiscal.totals.all.total,
  };
}
