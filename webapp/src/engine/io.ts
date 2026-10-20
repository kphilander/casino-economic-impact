/**
 * Regional input-output model, computed from a state's StateIO tables.
 *
 * This reproduces 08_state_multipliers_2023.R:
 *   D = V q^-1 (market shares), B = U g^-1 (input coefficients),
 *   A = D B (industry technology assumption), L = (I - A)^-1.
 *   Type II closes the model with a household row (employee compensation per
 *   dollar of output) and a household column: households spend a share of
 *   each dollar of compensation (after payroll and income taxes and saving;
 *   08c_household_spending.R) in the pattern of the state's personal
 *   consumption, so the column is share x in-state PCE / all PCE, mapped to
 *   industries with D.
 *   Value-added components are StateIO V001-V003 per dollar of output. Jobs
 *   are 2023 QCEW filled jobs per $1M of 2023 StateIO output; estimated FTEs
 *   apply BEA national FTE/job ratios by industry.
 *
 * A response is the effect of $1M of final demand for one industry,
 * decomposed by the industry in which each effect occurs.
 */
import {
  type Matrix, at, fromRows, identityMinus, invert, matrix, multiply, timesColumn,
} from './linalg';

export interface StateTables {
  state: string;
  abbrev: string;
  ioYear: number;
  employmentYear: number;
  units: string;
  /** Make table, industry x commodity. */
  make: number[][];
  /** Domestic use table (in-state supply), commodity x industry. */
  use: number[][];
  industryOutput: number[];
  commodityOutput: number[];
  compensation: number[];
  topi: number[];
  gos: number[];
  /** Personal consumption expenditure (F010) of in-state commodities. */
  pce: number[];
  /** Personal consumption expenditure of the state from all origins (in-state, other states, imports). */
  pceAll: number;
  /**
   * Household spending per dollar of compensation (central value and the range
   * for sensitivity), with its inputs: the state's average 2023 QCEW private
   * wage and the national consumption share of disposable income.
   */
  householdSpending: { share: number; low: number; high: number; avgWage: number; consumptionShare: number };
  jobs2023: (number | null)[];
  output2023: (number | null)[];
  valueAdded2023: (number | null)[];
}

export interface Industry { code: string; name: string }

export interface NationalTables {
  industries: Industry[];
  commodities: string[];
  ftePerJob: number[];
}

export const METRICS = ['output', 'va', 'compensation', 'topi', 'jobs', 'fte'] as const;
export type Metric = (typeof METRICS)[number];
export const EFFECTS = ['direct', 'indirect', 'induced'] as const;
export type Effect = (typeof EFFECTS)[number];

/**
 * Effects of $1M of final demand. Dollar metrics are in $M; jobs and FTEs are
 * counts per $1M of 2023-dollar demand. Each vector is indexed by industry.
 */
export type Response = Record<Metric, Record<Effect, Float64Array>>;

export interface RegionalModel {
  state: string;
  abbrev: string;
  industries: Industry[];
  n: number;
  index: Record<string, number>;
  A: Matrix;
  /** Type I Leontief inverse (n x n). */
  L: Matrix;
  /** Type II Leontief inverse with the household sector last ((n+1) x (n+1)). */
  L2: Matrix;
  coefficients: {
    va: Float64Array;
    compensation: Float64Array;
    topi: Float64Array;
    /** Jobs per $1M of 2023 output. */
    jobs: Float64Array;
    /** Estimated FTEs per $1M of 2023 output. */
    fte: Float64Array;
    /** Jobs per $1M of 2023 value added. */
    jobsPerVa: Float64Array;
    ftePerJob: Float64Array;
  };
  householdRow: Float64Array;
  householdColumn: Float64Array;
  household: HouseholdClosure;
  /** Response to $1M of final demand for an industry (memoized). */
  respond(code: string): Response;
  /** The same model with another household spending share, or the earlier closure (memoized). */
  withHouseholdSpending(spending: number | 'legacy'): RegionalModel;
}

export interface HouseholdClosure {
  /** Household spending per dollar of compensation in this model; null for the earlier closure. */
  share: number | null;
  /** In-state share of personal consumption. */
  instateShare: number;
  /** In-state household purchases per dollar of compensation (sum of the household column). */
  inState: number;
  range: { low: number; central: number; high: number };
  /** Disposable income per dollar of compensation, and the national share of it that households spend. */
  disposable: number;
  consumptionShare: number;
}

const finite = (x: number): number => (Number.isFinite(x) ? x : 0);

/**
 * Build a state's model. `spending` replaces the state's household spending
 * share; 'legacy' uses the closure of earlier versions (in-state consumption
 * per dollar of compensation), for regression tests only.
 */
export function buildModel(t: StateTables, national: NationalTables, spending?: number | 'legacy'): RegionalModel {
  const industries = national.industries;
  const n = industries.length;
  const k = national.commodities.length;
  if (t.make.length !== n || t.make[0].length !== k || t.use.length !== k || t.use[0].length !== n) {
    throw new Error(`Unexpected table dimensions for ${t.state}`);
  }
  const g = t.industryOutput;
  const q = t.commodityOutput;

  const D = fromRows(t.make);
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) D.data[i * k + c] = finite(D.data[i * k + c] / q[c]);
  const B = fromRows(t.use);
  for (let c = 0; c < k; c++) for (let j = 0; j < n; j++) B.data[c * n + j] = finite(B.data[c * n + j] / g[j]);
  const A = multiply(D, B);
  const L = invert(identityMinus(A));

  const va = new Float64Array(n);
  const compensation = new Float64Array(n);
  const topi = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    va[j] = finite((t.compensation[j] + t.topi[j] + t.gos[j]) / g[j]);
    compensation[j] = finite(t.compensation[j] / g[j]);
    topi[j] = finite(t.topi[j] / g[j]);
  }

  // Household closure. Households spend `share` of each dollar of
  // compensation; the in-state part follows in-state consumption. D converts
  // the column from commodities to industries.
  const legacy = spending === 'legacy';
  const share = legacy ? null : spending ?? t.householdSpending.share;
  let totalCompensation = 0;
  for (let j = 0; j < n; j++) totalCompensation += Number.isFinite(t.compensation[j]) ? t.compensation[j] : 0;
  const pcePerComp = t.pce.map((p) => finite(legacy ? p / totalCompensation : (share! * p) / t.pceAll));
  const householdColumn = timesColumn(D, pcePerComp);
  const householdRow = compensation;
  const Abar = matrix(n + 1, n + 1);
  for (let i = 0; i < n; i++) {
    Abar.data.set(A.data.subarray(i * n, i * n + n), i * (n + 1));
    Abar.data[i * (n + 1) + n] = householdColumn[i];
    Abar.data[n * (n + 1) + i] = householdRow[i];
  }
  const L2 = invert(identityMinus(Abar));

  // 2023 employment satellite. Sectors without QCEW-compatible jobs or output
  // (housing, government enterprises) carry zero.
  const jobs = new Float64Array(n);
  const jobsPerVa = new Float64Array(n);
  const ftePerJob = Float64Array.from(national.ftePerJob);
  const fte = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const e = t.jobs2023[j];
    const o = t.output2023[j];
    const v = t.valueAdded2023[j];
    if (e != null && o != null && o > 0) jobs[j] = e / (o / 1e6);
    if (e != null && v != null && v > 0) jobsPerVa[j] = e / (v / 1e6);
    fte[j] = jobs[j] * ftePerJob[j];
  }

  const pceInState = t.pce.reduce((s, p) => s + finite(p), 0);
  const household: HouseholdClosure = {
    share,
    instateShare: finite(pceInState / t.pceAll),
    inState: householdColumn.reduce((s, x) => s + x, 0),
    range: { low: t.householdSpending.low, central: t.householdSpending.share, high: t.householdSpending.high },
    disposable: t.householdSpending.high,
    consumptionShare: t.householdSpending.consumptionShare,
  };
  const variants = new Map<number | 'legacy', RegionalModel>();

  const index: Record<string, number> = {};
  industries.forEach((ind, i) => { index[ind.code] = i; });
  const coefficients = { va, compensation, topi, jobs, fte, jobsPerVa, ftePerJob };
  const cache = new Map<string, Response>();

  function respond(code: string): Response {
    const hit = cache.get(code);
    if (hit) return hit;
    const j = index[code];
    if (j == null) throw new Error(`Unknown industry ${code}`);
    const x0 = new Float64Array(n);
    x0[j] = 1;
    const x1 = new Float64Array(n);
    const x2 = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      x1[i] = at(L, i, j);
      x2[i] = at(L2, i, j);
    }
    const output = { direct: x0, indirect: x1.map((v, i) => v - x0[i]), induced: x2.map((v, i) => v - x1[i]) };
    const scale = (c: Float64Array) => ({
      direct: output.direct.map((v, i) => v * c[i]),
      indirect: output.indirect.map((v, i) => v * c[i]),
      induced: output.induced.map((v, i) => v * c[i]),
    });
    const r: Response = {
      output,
      va: scale(va),
      compensation: scale(compensation),
      topi: scale(topi),
      jobs: scale(jobs),
      fte: scale(fte),
    };
    cache.set(code, r);
    return r;
  }

  const model: RegionalModel = {
    state: t.state, abbrev: t.abbrev, industries, n, index, A, L, L2,
    coefficients, householdRow, householdColumn, household, respond,
    withHouseholdSpending(s) {
      if (s === share || (s === 'legacy' && legacy)) return model;
      let m = variants.get(s);
      if (!m) { m = buildModel(t, national, s); variants.set(s, m); }
      return m;
    },
  };
  return model;
}

/** Totals of a response over industries, by metric and effect. */
export function totals(r: Response): Record<Metric, Record<Effect, number>> {
  const out = {} as Record<Metric, Record<Effect, number>>;
  for (const m of METRICS) {
    out[m] = { direct: 0, indirect: 0, induced: 0 };
    for (const e of EFFECTS) {
      let s = 0;
      for (const v of r[m][e]) s += v;
      out[m][e] = s;
    }
  }
  return out;
}

/**
 * Multipliers in the form the R pipeline writes them (per $1 of output for
 * dollar metrics; per $1M of output for jobs and FTEs).
 */
export interface Multipliers {
  Direct_VA_Coef: number;
  Direct_Wage_Coef: number;
  Direct_Tax_Coef: number;
  Type_I_Output: number;
  Type_II_Output: number;
  Type_I_VA: number;
  Type_II_VA: number;
  Type_I_Wage: number;
  Type_II_Wage: number;
  Type_I_Tax: number;
  Type_II_Tax: number;
  Direct_Jobs_Per_1M_Output: number;
  Type_I_Jobs_Per_1M_Output: number;
  Type_II_Jobs_Per_1M_Output: number;
  Direct_FTE_Per_1M_Output: number;
  Type_I_FTE_Per_1M_Output: number;
  Type_II_FTE_Per_1M_Output: number;
  Indirect_Emp_Coef: number;
  Induced_Emp_Coef: number;
}

export function multipliers(r: Response): Multipliers {
  const t = totals(r);
  const typeI = (m: Metric) => t[m].direct + t[m].indirect;
  const typeII = (m: Metric) => typeI(m) + t[m].induced;
  return {
    Direct_VA_Coef: t.va.direct,
    Direct_Wage_Coef: t.compensation.direct,
    Direct_Tax_Coef: t.topi.direct,
    Type_I_Output: typeI('output'),
    Type_II_Output: typeII('output'),
    Type_I_VA: typeI('va'),
    Type_II_VA: typeII('va'),
    Type_I_Wage: typeI('compensation'),
    Type_II_Wage: typeII('compensation'),
    Type_I_Tax: typeI('topi'),
    Type_II_Tax: typeII('topi'),
    Direct_Jobs_Per_1M_Output: t.jobs.direct,
    Type_I_Jobs_Per_1M_Output: typeI('jobs'),
    Type_II_Jobs_Per_1M_Output: typeII('jobs'),
    Direct_FTE_Per_1M_Output: t.fte.direct,
    Type_I_FTE_Per_1M_Output: typeI('fte'),
    Type_II_FTE_Per_1M_Output: typeII('fte'),
    Indirect_Emp_Coef: t.va.indirect > 0 ? t.jobs.indirect / t.va.indirect : 0,
    Induced_Emp_Coef: t.va.induced > 0 ? t.jobs.induced / t.va.induced : 0,
  };
}
