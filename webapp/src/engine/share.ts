/**
 * Save and share: an analysis serializes to a URL parameter and to named
 * projects in localStorage. Links and projects saved by earlier versions
 * (v1, v2) migrate to the current shape.
 */
import {
  DEPARTMENTS, PROPERTY_TYPES, defaultAnalysis, emptyKnown,
  type Analysis, type Department, type PropertyType,
} from './scenario';
import { stateByName } from './data';

const URL_PARAM = 'a';
const PROJECTS_KEY = 'gems_projects';

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Accepts the current shape and the v1/v2 shapes; null if unusable. */
export function migrate(raw: unknown): Analysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, any>;
  const base = defaultAnalysis();
  const pt: PropertyType = o.propertyType in PROPERTY_TYPES ? o.propertyType : base.propertyType;
  const legacy = o.v !== 3;
  const rev = (legacy ? o.revenues : o.revenue) ?? {};
  const known = emptyKnown();
  const kd = (legacy ? o.knownData : o.known) ?? {};
  for (const d of DEPARTMENTS) {
    known[d] = { jobs: num(legacy ? kd[d]?.emp : kd[d]?.jobs), wages: num(kd[d]?.wages) };
  }
  const tax = legacy
    ? { customRate: num(o.gamingTaxCustomRate), slotSharePct: num(o.slotRevenuePct) ?? 70 }
    : { customRate: num(o.gamingTax?.customRate), slotSharePct: num(o.gamingTax?.slotSharePct) ?? 70 };
  return {
    v: 3,
    state: typeof o.state === 'string' ? o.state : base.state,
    name: String((legacy ? o.casinoName : o.name) ?? ''),
    propertyType: pt,
    ownership: o.ownership === 'tribal' ? 'tribal' : 'commercial',
    inputMode: o.inputMode === 'total' ? 'total' : 'department',
    revenue: {
      gaming: num(rev.gaming), food: num(rev.food), lodging: num(rev.lodging),
      other: num(rev.other), total: num(rev.total),
    } as Record<Department | 'total', number | null>,
    known,
    gamingTax: tax,
    dollarYear: num(legacy ? o.analysisYear : o.dollarYear),
    netImpact: {
      enabled: !!o.netImpact?.enabled,
      nonResidentShare: num(o.netImpact?.nonResidentShare),
      recaptureShare: num(o.netImpact?.recaptureShare) ?? 0,
    },
    construction: {
      enabled: !!o.construction?.enabled,
      cost: num(o.construction?.cost),
      localShare: num(o.construction?.localShare) ?? 60,
      years: num(o.construction?.years) ?? 2,
    },
  };
}

// ------------------------------------------------------------ URL

function b64encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64decode(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export const encodeAnalysis = (a: Analysis): string => b64encode(JSON.stringify(a));

export function decodeAnalysis(token: string): Analysis | null {
  try {
    return migrate(JSON.parse(b64decode(token)));
  } catch {
    return null;
  }
}

export function shareUrl(a: Analysis, href = window.location.href): string {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(URL_PARAM, encodeAnalysis(a));
  return url.toString();
}

export function analysisFromUrl(search = window.location.search): Analysis | null {
  const token = new URLSearchParams(search).get(URL_PARAM);
  return token ? decodeAnalysis(token) : null;
}

/**
 * Pre-fill from the Casino Revenue Forecaster
 * (gamblingpolicy.com/tools/revenue-forecaster), which links here with
 * ?from=forecaster&state=&name=&propertyType=&gaming=&food=&lodging=&other=
 * (revenue in $M).
 */
export function analysisFromForecaster(search = window.location.search): Analysis | null {
  const p = new URLSearchParams(search);
  if (p.get('from') !== 'forecaster') return null;
  const a = defaultAnalysis();
  const state = p.get('state');
  const pt = p.get('propertyType');
  const rev = (k: string) => {
    const n = num(p.get(k)?.replace(/,/g, ''));
    return n != null && n > 0 ? n : null;
  };
  return {
    ...a,
    state: state && stateByName(state) ? state : a.state,
    name: p.get('name') ?? '',
    propertyType: pt && pt in PROPERTY_TYPES ? (pt as PropertyType) : a.propertyType,
    inputMode: 'department',
    revenue: { gaming: rev('gaming'), food: rev('food'), lodging: rev('lodging'), other: rev('other'), total: null },
  };
}

/** Remove import parameters (share link or forecaster) from the address bar. */
export function clearImportParams(): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get('from') === 'forecaster') url.search = '';
  else url.searchParams.delete(URL_PARAM);
  window.history.replaceState({}, '', url.pathname + url.search);
}

// ------------------------------------------------------------ projects

export interface Project { id: string; name: string; savedAt: string; analysis: Analysis }

export function loadProjects(): Project[] {
  try {
    const list = JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? '[]');
    if (!Array.isArray(list)) return [];
    return list.flatMap((p) => {
      const analysis = migrate(p?.analysis);
      return analysis && p?.id ? [{ id: String(p.id), name: String(p.name ?? 'Untitled analysis'), savedAt: String(p.savedAt ?? ''), analysis }] : [];
    });
  } catch {
    return [];
  }
}

function persist(list: Project[]): boolean {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function saveProject(name: string, analysis: Analysis): Project[] {
  const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const list = [{ id, name: name.trim() || 'Untitled analysis', savedAt: new Date().toISOString(), analysis }, ...loadProjects()];
  persist(list);
  return list;
}

export function deleteProject(id: string): Project[] {
  const list = loadProjects().filter((p) => p.id !== id);
  persist(list);
  return list;
}

export function renameProject(id: string, name: string): Project[] {
  const list = loadProjects().map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p));
  persist(list);
  return list;
}
