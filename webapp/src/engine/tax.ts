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
  | { kind: 'flat'; rate: number; addOn: number }
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
  if (s.flatRate != null) return { kind: 'flat', rate: s.flatRate, addOn };
  if (s.handleRate != null && s.assumedHold) return { kind: 'flat', rate: s.handleRate / s.assumedHold, addOn };
  if (s.effectiveRate != null) return { kind: 'flat', rate: s.effectiveRate, addOn };
  return { kind: 'none' };
}

/** Graduated tax: each rate applies to revenue between its threshold and the next ($M). */
export function tieredTax(amount: number, tiers: Tier[]): number {
  if (!(amount > 0) || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  let tax = 0;
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i].threshold;
    const end = i < sorted.length - 1 ? sorted[i + 1].threshold : Infinity;
    if (amount <= start) break;
    tax += (Math.min(amount, end) - start) * sorted[i].rate;
  }
  return tax;
}

export function gamingTax(ggr: number, rule: TaxRule): number {
  if (!(ggr > 0)) return 0;
  switch (rule.kind) {
    case 'custom': return ggr * rule.rate;
    case 'flat': return ggr * (rule.rate + rule.addOn);
    case 'tiered': return tieredTax(ggr, rule.tiers) + ggr * rule.addOn;
    case 'splitTiered':
      return tieredTax(ggr * rule.slotShare, rule.slotTiers)
        + tieredTax(ggr * (1 - rule.slotShare), rule.tableTiers) + ggr * rule.addOn;
    case 'splitFlat':
      return ggr * (rule.slotShare * rule.slotsRate + (1 - rule.slotShare) * rule.tableRate + rule.addOn);
    case 'none': return 0;
  }
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

/**
 * Employer payroll taxes on cash wages ($M) paid to a number of filled jobs,
 * each at the average wage. Federal: Social Security (to the wage cap),
 * Medicare, FUTA. State: unemployment insurance (to the state wage base) and
 * employer SDI and paid-leave contributions.
 */
export function payrollTax(wages: number, jobs: number, st: StatePayroll | undefined, fed: FederalPayroll): LevelSplit {
  if (!(wages > 0) || !(jobs > 0) || !st) return { federal: 0, state: 0, total: 0 };
  const dollars = wages * 1e6;
  const avg = dollars / jobs;
  const ss = Math.min(avg, fed.fica_ss_wage_cap) * fed.fica_ss_rate * jobs;
  const medicare = dollars * fed.fica_medicare_rate;
  const futa = Math.min(avg, fed.futa_wage_base) * fed.futa_rate * jobs;
  const suta = st.suta_avg_rate && st.suta_wage_base ? Math.min(avg, st.suta_wage_base) * st.suta_avg_rate * jobs : 0;
  const sdi = st.sdi_employer_rate && st.sdi_employer_rate > 0 ? dollars * st.sdi_employer_rate : 0;
  const pfml = st.pfml_employer_rate && st.pfml_employer_rate > 0 ? dollars * st.pfml_employer_rate : 0;
  const federal = (ss + medicare + futa) / 1e6;
  const state = (suta + sdi + pfml) / 1e6;
  return { federal, state, total: federal + state };
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
}

/**
 * Household income taxes on cash wages ($M) of a number of jobs: each job's
 * average wage is taxed as a single filer's wages under 2025 federal, state
 * and typical local schedules. Without a state table, the BEA ratio of
 * personal current taxes to wages applies to the total.
 */
export function incomeTax(wages: number, jobs: number, tables: IncomeTaxTables, stateName: string, fallback?: StatePayroll): IncomeTax {
  const none: IncomeTax = { federal: 0, state: 0, local: 0, stateLocal: 0, total: 0, method: 'none' };
  if (!(wages > 0)) return none;
  const st = tables.states[stateName];
  if (!st || !(jobs > 0)) {
    const ratio = fallback?.household_tax_ratio;
    return ratio ? { ...none, total: wages * ratio, method: 'bea_ratio' } : none;
  }
  const w = (wages * 1e6) / jobs;
  const toM = (perJob: number) => (perJob * jobs) / 1e6;
  const federal = toM(taxAtWage(tables.federal.tax, tables.wageGrid, w));
  const state = toM(taxAtWage(st.state, tables.wageGrid, w));
  const local = toM(taxAtWage(st.local, tables.wageGrid, w));
  return { federal, state, local, stateLocal: state + local, total: federal + state + local, method: 'per_worker' };
}
