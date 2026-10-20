/**
 * Gaming, payroll and household income taxes. Amounts are in $M.
 */

// ------------------------------------------------------------ gaming tax

export interface Tier { threshold: number; rate: number }

/** One state's schedule for a gaming vertical (gamingTaxRates.json). */
export interface GamingTaxSchedule {
  rateStructure?: string;
  effectiveRate?: number;
  flatRate?: number;
  tiers?: Tier[];
  slotTiers?: Tier[];
  tableTiers?: Tier[];
  slotsRate?: number;
  tableRate?: number;
  slotTableSplit?: boolean;
  handleRate?: number;
  assumedHold?: number;
  additionalRate?: number;
  description?: string;
}

export interface StateGamingTax extends GamingTaxSchedule {
  abbrev: string;
  hasCommercial: boolean;
  hasTribal?: boolean;
  hasIGaming?: boolean;
  hasSportsBetting?: boolean;
  iGaming?: GamingTaxSchedule;
  sportsBetting?: GamingTaxSchedule;
  localTaxNotes?: string;
  sourceYear?: number;
  lastVerified?: string;
  sources?: string[];
}

export type GamingVertical = 'land' | 'igaming' | 'sports';

/** A schedule reduced to what the calculation needs. */
export type TaxRule =
  | { kind: 'custom'; rate: number }
  | { kind: 'flat'; rate: number; addOn: number; source: 'flat' | 'handle' | 'effective'; handleRate?: number; hold?: number }
  | { kind: 'tiered'; tiers: Tier[]; addOn: number }
  | { kind: 'splitTiered'; slotTiers: Tier[]; tableTiers: Tier[]; slotShare: number; addOn: number }
  | { kind: 'splitFlat'; slotsRate: number; tableRate: number; slotShare: number; addOn: number }
  | { kind: 'none' };

export function verticalSchedule(state: StateGamingTax | undefined, vertical: GamingVertical): GamingTaxSchedule | undefined {
  if (!state) return undefined;
  if (vertical === 'igaming') return state.iGaming;
  if (vertical === 'sports') return state.sportsBetting;
  return state;
}

export function hasGamingTax(state: StateGamingTax | undefined, vertical: GamingVertical): boolean {
  if (!state) return false;
  if (vertical === 'igaming') return !!state.hasIGaming;
  if (vertical === 'sports') return !!state.hasSportsBetting;
  return state.hasCommercial;
}

/**
 * Rule for a schedule. A custom rate replaces the schedule and any add-on.
 * A tax on handle converts to a GGR rate with the documented hold.
 */
export function taxRule(s: GamingTaxSchedule | undefined, customRate: number | null, slotSharePct: number): TaxRule {
  if (customRate != null) return { kind: 'custom', rate: customRate };
  if (!s) return { kind: 'none' };
  const addOn = s.additionalRate ?? 0;
  const slotShare = (slotSharePct || 70) / 100;
  if (s.rateStructure === 'split_tiered' && s.slotTiers && s.tableTiers) {
    return { kind: 'splitTiered', slotTiers: s.slotTiers, tableTiers: s.tableTiers, slotShare, addOn };
  }
  if (s.rateStructure === 'tiered' && s.tiers) return { kind: 'tiered', tiers: s.tiers, addOn };
  if ((s.rateStructure === 'split_game_type' || s.slotTableSplit) && s.slotsRate != null && s.tableRate != null) {
    return { kind: 'splitFlat', slotsRate: s.slotsRate, tableRate: s.tableRate, slotShare, addOn };
  }
  if (s.flatRate != null) return { kind: 'flat', rate: s.flatRate, addOn, source: 'flat' };
  if (s.handleRate != null && s.assumedHold) {
    return { kind: 'flat', rate: s.handleRate / s.assumedHold, addOn, source: 'handle', handleRate: s.handleRate, hold: s.assumedHold };
  }
  if (s.effectiveRate != null) return { kind: 'flat', rate: s.effectiveRate, addOn, source: 'effective' };
  return { kind: 'none' };
}

/** One band or component of a gaming tax computation ($M). */
export interface TaxStep {
  part: 'all' | 'slots' | 'tables' | 'addOn';
  /** Band limits on the part's revenue; to = null for the top band. */
  from: number;
  to: number | null;
  base: number;
  rate: number;
  tax: number;
}

/** Graduated tax: each rate applies to revenue between its threshold and the next ($M). */
function tierSteps(amount: number, tiers: Tier[], part: TaxStep['part']): TaxStep[] {
  if (!(amount > 0) || tiers.length === 0) return [];
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  const steps: TaxStep[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i].threshold;
    const to = i < sorted.length - 1 ? sorted[i + 1].threshold : null;
    if (amount <= from) break;
    const base = Math.min(amount, to ?? Infinity) - from;
    steps.push({ part, from, to, base, rate: sorted[i].rate, tax: base * sorted[i].rate });
  }
  return steps;
}

/** The computation of the gaming tax on GGR ($M), step by step; the tax is their sum. */
export function gamingTaxSteps(ggr: number, rule: TaxRule): TaxStep[] {
  if (!(ggr > 0) || rule.kind === 'none') return [];
  const flat = (part: TaxStep['part'], base: number, rate: number): TaxStep => ({ part, from: 0, to: null, base, rate, tax: base * rate });
  const addOn = rule.kind !== 'custom' && rule.addOn ? [flat('addOn', ggr, rule.addOn)] : [];
  switch (rule.kind) {
    case 'custom': return [flat('all', ggr, rule.rate)];
    case 'flat': return [flat('all', ggr, rule.rate), ...addOn];
    case 'tiered': return [...tierSteps(ggr, rule.tiers, 'all'), ...addOn];
    case 'splitTiered':
      return [...tierSteps(ggr * rule.slotShare, rule.slotTiers, 'slots'),
        ...tierSteps(ggr * (1 - rule.slotShare), rule.tableTiers, 'tables'), ...addOn];
    case 'splitFlat':
      return [flat('slots', ggr * rule.slotShare, rule.slotsRate), flat('tables', ggr * (1 - rule.slotShare), rule.tableRate), ...addOn];
  }
}

export function gamingTax(ggr: number, rule: TaxRule): number {
  return gamingTaxSteps(ggr, rule).reduce((s, x) => s + x.tax, 0);
}

// ------------------------------------------------------------ payroll taxes

export interface FederalPayroll {
  fica_ss_rate: number;
  fica_ss_wage_cap: number;
  fica_medicare_rate: number;
  futa_rate: number;
  futa_wage_base: number;
}

export interface StatePayroll {
  suta_avg_rate: number | null;
  suta_wage_base: number | null;
  sdi_employer_rate: number | null;
  pfml_employer_rate: number | null;
  household_tax_ratio: number | null;
}

export interface LevelSplit { federal: number; state: number; total: number }

export interface PayrollTax extends LevelSplit {
  /** Average cash wage per job, dollars. */
  avgWage: number;
  /** Employer and employee (withheld) payroll taxes, $M. */
  employer: number;
  employee: number;
  /**
   * Components, $M. socialSecurity and medicare are the employer halves;
   * employeeSocialSecurity and employeeMedicare are withheld from wages.
   */
  parts: {
    socialSecurity: number; medicare: number; futa: number; suta: number; sdi: number; pfml: number;
    employeeSocialSecurity: number; employeeMedicare: number;
  };
}

/**
 * Payroll taxes on cash wages ($M) paid to a number of filled jobs, each at
 * the average wage. Federal: employer and employee Social Security (to the
 * wage cap) and Medicare, and FUTA. State: unemployment insurance (to the
 * state wage base) and employer SDI and paid-leave contributions. Employee
 * SDI and paid-leave contributions are not included.
 */
export function payrollTax(wages: number, jobs: number, st: StatePayroll | undefined, fed: FederalPayroll): PayrollTax {
  if (!(wages > 0) || !(jobs > 0) || !st) {
    return {
      federal: 0, state: 0, total: 0, avgWage: 0, employer: 0, employee: 0,
      parts: { socialSecurity: 0, medicare: 0, futa: 0, suta: 0, sdi: 0, pfml: 0, employeeSocialSecurity: 0, employeeMedicare: 0 },
    };
  }
  const dollars = wages * 1e6;
  const avg = dollars / jobs;
  const ss = Math.min(avg, fed.fica_ss_wage_cap) * fed.fica_ss_rate * jobs;
  const medicare = dollars * fed.fica_medicare_rate;
  const futa = Math.min(avg, fed.futa_wage_base) * fed.futa_rate * jobs;
  const suta = st.suta_avg_rate && st.suta_wage_base ? Math.min(avg, st.suta_wage_base) * st.suta_avg_rate * jobs : 0;
  const sdi = st.sdi_employer_rate && st.sdi_employer_rate > 0 ? dollars * st.sdi_employer_rate : 0;
  const pfml = st.pfml_employer_rate && st.pfml_employer_rate > 0 ? dollars * st.pfml_employer_rate : 0;
  // The employee halves of Social Security and Medicare have the same rates and cap.
  const employee = (ss + medicare) / 1e6;
  const employer = (ss + medicare + futa + suta + sdi + pfml) / 1e6;
  const federal = (2 * (ss + medicare) + futa) / 1e6;
  const state = (suta + sdi + pfml) / 1e6;
  return {
    federal, state, total: federal + state, avgWage: avg, employer, employee,
    parts: {
      socialSecurity: ss / 1e6, medicare: medicare / 1e6, futa: futa / 1e6, suta: suta / 1e6, sdi: sdi / 1e6, pfml: pfml / 1e6,
      employeeSocialSecurity: ss / 1e6, employeeMedicare: medicare / 1e6,
    },
  };
}

// ------------------------------------------------------------ income taxes

export interface WageGrid { min: number; max: number; step: number }

export interface IncomeTaxTables {
  wageGrid: WageGrid;
  federal: { tax: number[] };
  states: Record<string, { abbrev: string; state: number[]; local: number[]; method?: string; verified?: boolean }>;
}

/** Tax at wage w from a table on an even grid; the top segment's marginal rate extends above the grid. */
export function taxAtWage(table: number[], grid: WageGrid, w: number): number {
  if (!(w > 0)) return 0;
  const last = table.length - 1;
  if (w >= grid.max) return table[last] + ((table[last] - table[last - 1]) * (w - grid.max)) / grid.step;
  const x = (Math.max(w, grid.min) - grid.min) / grid.step;
  const i = Math.floor(x);
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

export interface IncomeTax {
  federal: number;
  state: number;
  local: number;
  stateLocal: number;
  total: number;
  method: 'per_worker' | 'bea_ratio' | 'none';
  /** Average cash wage per job and tax per worker at that wage, dollars (per-worker method). */
  avgWage: number;
  perWorker: { federal: number; state: number; local: number };
}

/**
 * Household income taxes on cash wages ($M) of a number of jobs: each job's
 * average wage is taxed as a single filer's wages under 2025 federal, state
 * and typical local schedules. Without a state table, the BEA ratio of
 * personal current taxes to wages applies to the total.
 */
export function incomeTax(wages: number, jobs: number, tables: IncomeTaxTables, stateName: string, fallback?: StatePayroll): IncomeTax {
  const none: IncomeTax = {
    federal: 0, state: 0, local: 0, stateLocal: 0, total: 0, method: 'none', avgWage: 0, perWorker: { federal: 0, state: 0, local: 0 },
  };
  if (!(wages > 0)) return none;
  const st = tables.states[stateName];
  if (!st || !(jobs > 0)) {
    const ratio = fallback?.household_tax_ratio;
    return ratio ? { ...none, total: wages * ratio, method: 'bea_ratio' } : none;
  }
  const w = (wages * 1e6) / jobs;
  const perWorker = {
    federal: taxAtWage(tables.federal.tax, tables.wageGrid, w),
    state: taxAtWage(st.state, tables.wageGrid, w),
    local: taxAtWage(st.local, tables.wageGrid, w),
  };
  const toM = (perJob: number) => (perJob * jobs) / 1e6;
  const federal = toM(perWorker.federal);
  const state = toM(perWorker.state);
  const local = toM(perWorker.local);
  return { federal, state, local, stateLocal: state + local, total: federal + state + local, method: 'per_worker', avgWage: w, perWorker };
}
