/**
 * Activities the calculator models, each mapped to a response of the regional
 * model per $1M of revenue (final demand).
 */
import type { RegionalModel, Response } from './io';
import { applyProfile, gamblingProfile, onlineProfile } from './profiles';
import { NATIONAL } from './data';

export type ActivityKey = 'gambling' | 'online' | 'lodging' | 'food' | 'other' | 'construction';

export interface Activity {
  key: ActivityKey;
  label: string;
  /** Industry code shown with results and used for the direct wage basis. */
  sector: string;
  /** StateIO summary industry whose response the activity starts from. */
  ioSector: string;
}

export const ACTIVITIES: Record<ActivityKey, Activity> = {
  gambling: { key: 'gambling', label: 'Gambling industries', sector: '7132', ioSector: '713' },
  online: { key: 'online', label: 'Online gambling', sector: 'ONLINE', ioSector: '713' },
  lodging: { key: 'lodging', label: 'Accommodation', sector: '721', ioSector: '721' },
  food: { key: 'food', label: 'Food services and drinking places', sector: '722', ioSector: '722' },
  other: { key: 'other', label: 'Performing arts, spectator sports, museums', sector: '711AS', ioSector: '711AS' },
  construction: { key: 'construction', label: 'Construction', sector: '23', ioSector: '23' },
};

const responses = new WeakMap<RegionalModel, Map<ActivityKey, Response>>();

/** Response of the regional model to $1M of revenue for an activity (memoized). */
export function activityResponse(model: RegionalModel, key: ActivityKey): Response {
  let byKey = responses.get(model);
  if (!byKey) { byKey = new Map(); responses.set(model, byKey); }
  const hit = byKey.get(key);
  if (hit) return hit;
  let r: Response;
  if (key === 'gambling') {
    r = applyProfile(model.respond('713'), gamblingProfile(NATIONAL.gambling));
  } else if (key === 'online') {
    const fte5415 = model.coefficients.ftePerJob[model.index[NATIONAL.online.fteSector]];
    r = applyProfile(activityResponse(model, 'gambling'), onlineProfile(NATIONAL.online, fte5415));
  } else {
    r = model.respond(ACTIVITIES[key].ioSector);
  }
  byKey.set(key, r);
  return r;
}

/** FTEs per filled job for the activity's direct workforce. */
export function directFtePerJob(model: RegionalModel, key: ActivityKey): number {
  const code = key === 'online' ? NATIONAL.online.fteSector : ACTIVITIES[key].ioSector;
  return model.coefficients.ftePerJob[model.index[code]];
}
