/**
 * Model data: national inputs are bundled; each state's StateIO tables are a
 * separate chunk loaded on first use.
 */
import nationalJson from '../data/io/national.json';
import { buildModel, type NationalTables, type RegionalModel, type StateTables } from './io';
import type { GamblingRatios, OnlineRatios } from './profiles';

export interface NationalData extends NationalTables {
  metadata: {
    generatedBy: string;
    stateior: string;
    ioYear: number;
    employmentYear: number;
    sources: { file: string; md5: string }[];
    employmentSatellite: string;
    ftePerJob: string;
  };
  states: Record<string, string>;
  gambling: GamblingRatios & { source: string; parentSector: string };
  online: OnlineRatios & { source: string; fteSector: string };
}

export const NATIONAL = nationalJson as unknown as NationalData;

export interface StateRef { abbrev: string; name: string }

export const STATES: StateRef[] = Object.entries(NATIONAL.states)
  .map(([abbrev, name]) => ({ abbrev, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const stateByName = (name: string): StateRef | undefined => STATES.find((s) => s.name === name);

const loaders = import.meta.glob<StateTables>('../data/io/[A-Z][A-Z].json', { import: 'default' });
const models = new Map<string, Promise<RegionalModel>>();

/** The regional model for a state (by abbreviation), built once per session. */
export function loadModel(abbrev: string): Promise<RegionalModel> {
  let m = models.get(abbrev);
  if (!m) {
    const load = loaders[`../data/io/${abbrev}.json`];
    if (!load) return Promise.reject(new Error(`No input-output tables for ${abbrev}`));
    m = load().then((tables) => buildModel(tables, NATIONAL));
    models.set(abbrev, m);
  }
  return m;
}
