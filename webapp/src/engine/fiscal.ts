/**
 * Fiscal effects: non-duplicative tax lines by level of government.
 *
 * - The statutory gaming tax replaces the gaming share of the gaming stream's
 *   direct taxes on production and imports (TOPI). StateIO gives every state
 *   the national TOPI intensity of 713, so the gaming tax embedded in it is a
 *   national average unrelated to the state's own rate. Direct taxes on gaming
 *   = statutory gaming tax + nonGamingShare x modeled direct TOPI of the
 *   gaming stream (fiscalAssumptions.json). Supplier and induced TOPI are kept.
 * - Tribal gaming pays compact revenue sharing, not state gaming, sales or
 *   property taxes on trust land, so the gaming stream's direct TOPI is
 *   replaced entirely by the revenue share, if one is entered.
 * - Payroll and income taxes use estimated cash wages and filled jobs of each
 *   effect.
 */
import { EFFECTS, type Effect } from './io';
import type { Effects } from './impact';
import {
  incomeTax, payrollTax, type FederalPayroll, type IncomeTax, type IncomeTaxTables,
  type PayrollTax, type StatePayroll,
} from './tax';

export type Level = 'federal' | 'state_local';

export interface FiscalLine extends Effects {
  key: 'gaming' | 'topi' | 'payroll_federal' | 'payroll_state' | 'income_federal' | 'income_state_local' | 'income_combined';
  label: string;
  level: Level;
  note: string | null;
}

export interface Fiscal {
  lines: FiscalLine[];
  totals: { all: Effects; federal: Effects; stateLocal: Effects };
  incomeTaxMethod: IncomeTax['method'];
  /** What the lines were computed from, for display of the computation. */
  basis: {
    effects: Record<Effect, { cashWages: number; jobs: number; payroll: PayrollTax; income: IncomeTax }>;
    topi: { modeledDirect: number; gamingStreamTopi: number; removed: number; retainedShare: number; tribal: boolean; replaced: boolean };
    statePayroll: StatePayroll | undefined;
    federalPayroll: FederalPayroll;
  };
}

export interface FiscalData {
  stateName: string;
  statePayroll: StatePayroll | undefined;
  federalPayroll: FederalPayroll;
  incomeTax: IncomeTaxTables;
  nonGamingShare: number;
}

export interface FiscalInput {
  cashWages: Effects;
  jobs: Effects;
  topi: Effects;
  /** Statutory gaming tax or compact revenue share, if any. */
  gamingTax?: { amount: number; effectiveRate: number } | null;
  /** Modeled direct TOPI of the stream the gaming tax applies to. */
  gamingStreamTopi?: number;
  tribal?: boolean;
}

function line(key: FiscalLine['key'], label: string, level: Level, v: Partial<Record<Effect, number>>, note: string | null = null): FiscalLine {
  const direct = v.direct ?? 0;
  const indirect = v.indirect ?? 0;
  const induced = v.induced ?? 0;
  return { key, label, level, direct, indirect, induced, total: direct + indirect + induced, note };
}

function sumLines(lines: FiscalLine[]): Effects {
  const out = { direct: 0, indirect: 0, induced: 0, total: 0 };
  for (const l of lines) for (const e of [...EFFECTS, 'total'] as const) out[e] += l[e];
  return out;
}

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

export function buildFiscal(input: FiscalInput, data: FiscalData): Fiscal {
  const { gamingTax = null, gamingStreamTopi = 0, tribal = false } = input;
  const lines: FiscalLine[] = [];
  let topiDirect = input.topi.direct;
  if (tribal) {
    topiDirect -= gamingStreamTopi;
    if (gamingTax) {
      lines.push(line('gaming', 'Tribal revenue share (compact)', 'state_local',
        { direct: gamingTax.amount }, `${pct(gamingTax.effectiveRate)} of GGR`));
    }
  } else if (gamingTax) {
    topiDirect -= (1 - data.nonGamingShare) * gamingStreamTopi;
    lines.push(line('gaming', 'Gaming tax (statutory, on GGR)', 'state_local',
      { direct: gamingTax.amount }, `${pct(gamingTax.effectiveRate)} effective rate`));
  }
  lines.push(line('topi', gamingTax ? 'Other taxes on production and imports' : 'Taxes on production and imports',
    'state_local', { direct: topiDirect, indirect: input.topi.indirect, induced: input.topi.induced },
    'I-O model values for sales, property, excise and license taxes. Most are state and local taxes.'));

  const payroll = {} as Record<Effect, PayrollTax>;
  const income = {} as Record<Effect, IncomeTax>;
  for (const e of EFFECTS) {
    payroll[e] = payrollTax(input.cashWages[e], input.jobs[e], data.statePayroll, data.federalPayroll);
    income[e] = incomeTax(input.cashWages[e], input.jobs[e], data.incomeTax, data.stateName, data.statePayroll);
  }
  const pick = <T, K extends keyof T>(o: Record<Effect, T>, k: K) =>
    Object.fromEntries(EFFECTS.map((e) => [e, o[e][k] as number])) as Record<Effect, number>;
  lines.push(line('payroll_federal', 'Federal payroll taxes (FICA, FUTA)', 'federal', pick(payroll, 'federal')));
  lines.push(line('payroll_state', 'State payroll taxes (UI, SDI, PFML)', 'state_local', pick(payroll, 'state')));
  if (income.direct.method === 'bea_ratio') {
    lines.push(line('income_combined', 'Household income taxes (BEA ratio)', 'state_local', pick(income, 'total'),
      'Federal, state and local taxes together: the BEA ratio of personal current taxes to wages'));
  } else {
    lines.push(line('income_federal', 'Federal income tax (households)', 'federal', pick(income, 'federal')));
    lines.push(line('income_state_local', 'State and local income tax (households)', 'state_local', pick(income, 'stateLocal')));
  }

  const kept = lines.filter((l) => l.key === 'gaming' || l.key === 'topi' || Math.abs(l.total) > 1e-12);
  return {
    lines: kept,
    totals: {
      all: sumLines(kept),
      federal: sumLines(kept.filter((l) => l.level === 'federal')),
      stateLocal: sumLines(kept.filter((l) => l.level === 'state_local')),
    },
    incomeTaxMethod: income.direct.method,
    basis: {
      effects: Object.fromEntries(EFFECTS.map((e) => [e, {
        cashWages: input.cashWages[e], jobs: input.jobs[e], payroll: payroll[e], income: income[e],
      }])) as Fiscal['basis']['effects'],
      topi: {
        modeledDirect: input.topi.direct, gamingStreamTopi, removed: input.topi.direct - topiDirect,
        retainedShare: tribal ? 0 : data.nonGamingShare, tribal, replaced: tribal || !!gamingTax,
      },
      statePayroll: data.statePayroll,
      federalPayroll: data.federalPayroll,
    },
  };
}
