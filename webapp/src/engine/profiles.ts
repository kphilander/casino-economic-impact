/**
 * Production profiles for activities that are not StateIO summary industries.
 *
 * Gambling (NAICS 7132) is the StateIO 713 response adapted with national
 * USEEIO 713200/US ratios (generate_complete_multipliers.R): direct
 * coefficients are rescaled, and the supplier and induced increments of each
 * metric are scaled by that metric's supplier-side ratio. Jobs and FTEs per
 * dollar of supplier or induced value added stay at the 713 values, so their
 * increments scale with value added.
 *
 * Online gambling applies the scenario ratios of
 * 14_online_gambling_multipliers.R to the gambling profile, with direct FTEs
 * at the computer systems design (5415) FTE/job ratio.
 *
 * Scaling keeps the 713 distribution of effects across industries; the
 * industry detail of a profiled response is therefore approximate.
 */
import { METRICS, type Metric, type Response } from './io';

export interface Profile {
  /** Multipliers on the direct effect, by metric (default 1). */
  direct: Partial<Record<Metric, number>>;
  /** Multipliers on the supplier and induced effects, by metric (default 1). */
  increment: Partial<Record<Metric, number>>;
  /** Replaces direct FTEs with direct jobs x this ratio. */
  directFtePerJob?: number;
}

export interface GamblingRatios {
  direct: { va: number; compensation: number; topi: number; jobs: number; jobsPerVa: number };
  increment: { output: number; va: number; compensation: number; topi: number };
}

export interface OnlineRatios {
  direct: { va: number; compensation: number; topi: number; jobsPerVa: number };
  increment: { output: number; va: number; compensation: number; topi: number };
}

export function gamblingProfile(r: GamblingRatios): Profile {
  return {
    direct: {
      va: r.direct.va, compensation: r.direct.compensation, topi: r.direct.topi,
      jobs: r.direct.jobs, fte: r.direct.jobs,
    },
    increment: {
      output: r.increment.output, va: r.increment.va, compensation: r.increment.compensation,
      topi: r.increment.topi, jobs: r.increment.va, fte: r.increment.va,
    },
  };
}

/** Applied to the gambling response, not to 713. */
export function onlineProfile(r: OnlineRatios, directFtePerJob: number): Profile {
  return {
    direct: {
      va: r.direct.va, compensation: r.direct.compensation, topi: r.direct.topi,
      // Jobs per dollar of direct value added fall by jobsPerVa and value added
      // per dollar of revenue by va.
      jobs: r.direct.jobsPerVa * r.direct.va,
    },
    increment: {
      output: r.increment.output, va: r.increment.va, compensation: r.increment.compensation,
      topi: r.increment.topi, jobs: r.increment.va, fte: r.increment.va,
    },
    directFtePerJob,
  };
}

export function applyProfile(r: Response, p: Profile): Response {
  const out = {} as Response;
  for (const m of METRICS) {
    const d = p.direct[m] ?? 1;
    const inc = p.increment[m] ?? 1;
    out[m] = {
      direct: r[m].direct.map((v) => v * d),
      indirect: r[m].indirect.map((v) => v * inc),
      induced: r[m].induced.map((v) => v * inc),
    };
  }
  if (p.directFtePerJob != null) {
    out.fte.direct = out.jobs.direct.map((v) => v * p.directFtePerJob!);
  }
  return out;
}
