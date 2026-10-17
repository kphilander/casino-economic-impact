/**
 * Impact of one revenue stream: a response of the regional model scaled by
 * revenue, with the optional replacement of modeled labor by observed data and
 * the gaming-tax adjustment of direct compensation.
 */
import { EFFECTS, METRICS, type Effect, type Metric, type Response } from './io';

export interface Effects { direct: number; indirect: number; induced: number; total: number }

export const zeroEffects = (): Effects => ({ direct: 0, indirect: 0, induced: 0, total: 0 });

const effects = (direct: number, indirect: number, induced: number): Effects =>
  ({ direct, indirect, induced, total: direct + indirect + induced });

export const IMPACT_METRICS = ['output', 'gdp', 'compensation', 'cashWages', 'jobs', 'fte', 'topi'] as const;
export type ImpactMetric = (typeof IMPACT_METRICS)[number];

export interface JobsRange { direct: [number, number]; total: [number, number] }

/** What a stream impact was computed from, for display of the computation. */
export interface ImpactBasis {
  revenue: number;
  deflator: number;
  /** Response totals per $1M of revenue, before labor-data replacement and rescaling. */
  perMillion: Record<Metric, Record<Effect, number>>;
  cashShare: { direct: number; ripple: number };
  compensationFactor: number;
  jobsRangeRatios: { p05: number; p95: number } | null;
  directFtePerJob: number;
  knownJobs: number | null;
  knownWages: number | null;
}

export interface Impact extends Record<ImpactMetric, Effects> {
  sources: { jobs: 'model' | 'user'; compensation: 'model' | 'user' | 'adjusted' };
  /** Direct compensation before the gaming-tax adjustment, where one applies. */
  compensationAdjustment: { factor: number; modelDirect: number } | null;
  /** 90% predictive interval for direct and total jobs (model jobs only). */
  jobsRange: JobsRange | null;
  /** Factor applied to induced effects when direct compensation changes. */
  inducedScale: number;
  /** Supplier plus induced jobs by industry where they occur. */
  rippleJobsByIndustry: Float64Array;
  /** Supplier plus induced output ($M) by industry. */
  rippleOutputByIndustry: Float64Array;
  basis: ImpactBasis;
}

export interface StreamOptions {
  /** Converts analysis-year dollars to the 2023 dollars of the jobs satellite. */
  deflator: number;
  /** Observed direct jobs (filled jobs). */
  knownJobs?: number | null;
  /** Observed direct cash wages, $M. */
  knownWages?: number | null;
  /** QCEW-comparable wage share of compensation: own sector (direct) and all private (ripple). */
  cashShare: { direct: number; ripple: number };
  /** Multiplier on modeled direct compensation (gaming-tax adjustment); 1 = none. */
  compensationFactor?: number;
  /** 5th and 95th percentile ratios of true to modeled direct jobs, or null. */
  jobsRange?: { p05: number; p95: number } | null;
  /** FTEs per job of the direct workforce, for observed jobs. */
  directFtePerJob: number;
}

export function streamImpact(response: Response, revenue: number, o: StreamOptions): Impact | null {
  if (!(revenue > 0)) return null;
  const t = Object.fromEntries(METRICS.map((m) => [m, Object.fromEntries(
    EFFECTS.map((e) => [e, response[m][e].reduce((s, v) => s + v, 0)]),
  ) as Record<Effect, number>])) as Record<Metric, Record<Effect, number>>;
  const per = (m: Metric, e: Effect) => revenue * t[m][e];
  const jobsDollars = revenue * o.deflator;

  // Direct compensation: observed cash wages grossed up to compensation, or
  // the modeled value with the gaming-tax adjustment, or the modeled value.
  const modelCompDirect = per('compensation', 'direct');
  const factor = o.compensationFactor ?? 1;
  let compDirect: number;
  let compSource: Impact['sources']['compensation'];
  if (o.knownWages != null && o.knownWages > 0) {
    compDirect = o.knownWages / o.cashShare.direct;
    compSource = 'user';
  } else if (factor !== 1) {
    compDirect = modelCompDirect * factor;
    compSource = 'adjusted';
  } else {
    compDirect = modelCompDirect;
    compSource = 'model';
  }
  const compIndirect = per('compensation', 'indirect');

  // Induced effects are proportional to the household income of the direct
  // and supplier rounds, so a change in direct compensation rescales them.
  const modelTypeI = modelCompDirect + compIndirect;
  const inducedScale = compSource !== 'model' && modelTypeI > 0 ? (compDirect + compIndirect) / modelTypeI : 1;
  const compInduced = per('compensation', 'induced') * inducedScale;

  const userJobs = o.knownJobs != null && o.knownJobs > 0;
  const jobsDirect = userJobs ? o.knownJobs! : jobsDollars * t.jobs.direct;
  const jobsIndirect = jobsDollars * t.jobs.indirect;
  const jobsInduced = jobsDollars * t.jobs.induced * inducedScale;
  const ripple = jobsIndirect + jobsInduced;
  const jobsRange: JobsRange | null = o.jobsRange && !userJobs ? {
    direct: [jobsDirect * o.jobsRange.p05, jobsDirect * o.jobsRange.p95],
    total: [jobsDirect * o.jobsRange.p05 + ripple, jobsDirect * o.jobsRange.p95 + ripple],
  } : null;

  const rippleJobsByIndustry = response.jobs.indirect.map(
    (v, i) => jobsDollars * (v + response.jobs.induced[i] * inducedScale),
  );
  const rippleOutputByIndustry = response.output.indirect.map(
    (v, i) => revenue * (v + response.output.induced[i] * inducedScale),
  );

  return {
    output: effects(revenue, per('output', 'indirect'), per('output', 'induced') * inducedScale),
    gdp: effects(per('va', 'direct'), per('va', 'indirect'), per('va', 'induced') * inducedScale),
    compensation: effects(compDirect, compIndirect, compInduced),
    cashWages: effects(
      compSource === 'user' ? o.knownWages! : compDirect * o.cashShare.direct,
      compIndirect * o.cashShare.ripple,
      compInduced * o.cashShare.ripple,
    ),
    jobs: effects(jobsDirect, jobsIndirect, jobsInduced),
    fte: effects(
      userJobs ? jobsDirect * o.directFtePerJob : jobsDollars * t.fte.direct,
      jobsDollars * t.fte.indirect,
      jobsDollars * t.fte.induced * inducedScale,
    ),
    topi: effects(per('topi', 'direct'), per('topi', 'indirect'), per('topi', 'induced') * inducedScale),
    sources: { jobs: userJobs ? 'user' : 'model', compensation: compSource },
    compensationAdjustment: compSource === 'adjusted' ? { factor, modelDirect: modelCompDirect } : null,
    jobsRange,
    inducedScale,
    rippleJobsByIndustry,
    rippleOutputByIndustry,
    basis: {
      revenue, deflator: o.deflator, perMillion: t, cashShare: o.cashShare, compensationFactor: factor,
      jobsRangeRatios: o.jobsRange ?? null, directFtePerJob: o.directFtePerJob,
      knownJobs: userJobs ? o.knownJobs! : null, knownWages: compSource === 'user' ? o.knownWages! : null,
    },
  };
}

/** Sum impacts metric by metric. Ranges add, using point values where a stream has none. */
export function addImpacts(list: Impact[]): Omit<Impact, 'sources' | 'compensationAdjustment' | 'inducedScale' | 'basis'> {
  const out = Object.fromEntries(IMPACT_METRICS.map((m) => [m, zeroEffects()])) as Record<ImpactMetric, Effects>;
  for (const imp of list) {
    for (const m of IMPACT_METRICS) for (const e of [...EFFECTS, 'total'] as const) out[m][e] += imp[m][e];
  }
  const anyRange = list.some((i) => i.jobsRange);
  const jobsRange: JobsRange | null = anyRange ? list.reduce<JobsRange>((acc, i) => {
    const r = i.jobsRange ?? { direct: [i.jobs.direct, i.jobs.direct], total: [i.jobs.total, i.jobs.total] };
    return {
      direct: [acc.direct[0] + r.direct[0], acc.direct[1] + r.direct[1]],
      total: [acc.total[0] + r.total[0], acc.total[1] + r.total[1]],
    };
  }, { direct: [0, 0], total: [0, 0] }) : null;
  const n = list[0]?.rippleJobsByIndustry.length ?? 0;
  const rippleJobsByIndustry = new Float64Array(n);
  const rippleOutputByIndustry = new Float64Array(n);
  for (const imp of list) {
    imp.rippleJobsByIndustry.forEach((v, i) => { rippleJobsByIndustry[i] += v; });
    imp.rippleOutputByIndustry.forEach((v, i) => { rippleOutputByIndustry[i] += v; });
  }
  return { ...out, jobsRange, rippleJobsByIndustry, rippleOutputByIndustry };
}

/** Scale every additive metric by a share (net-impact module). */
export function scaleImpact<T extends Record<ImpactMetric, Effects>>(imp: T, share: number): Record<ImpactMetric, Effects> {
  return Object.fromEntries(IMPACT_METRICS.map((m) => [m, {
    direct: imp[m].direct * share, indirect: imp[m].indirect * share,
    induced: imp[m].induced * share, total: imp[m].total * share,
  }])) as Record<ImpactMetric, Effects>;
}
