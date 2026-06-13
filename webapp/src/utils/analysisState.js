/**
 * Serializable analysis model + persistence.
 *
 * A single "analysis" captures every input that drives the impact
 * calculation. This module turns that into:
 *   - a shareable URL (compact, base64-encoded), and
 *   - named projects saved in localStorage.
 *
 * Keeping one canonical shape here means save/share, scenario comparison,
 * and exports all speak the same language.
 */

export const ANALYSIS_VERSION = 1;
const PROJECTS_KEY = 'gems_projects';
const URL_PARAM = 'a';

/** The fields that fully define an analysis (mirrors App input state). */
export function buildAnalysis(input) {
  const {
    state, casinoName, propertyType, inputMode,
    revenues, knownData, gamingTaxCustomRate, slotRevenuePct,
  } = input;
  return {
    v: ANALYSIS_VERSION,
    state,
    casinoName: casinoName || '',
    propertyType,
    inputMode,
    revenues: { ...revenues },
    knownData: cloneKnownData(knownData),
    gamingTaxCustomRate: gamingTaxCustomRate ?? null,
    slotRevenuePct: slotRevenuePct ?? 70,
  };
}

function cloneKnownData(kd) {
  if (!kd) return {};
  const out = {};
  for (const key of Object.keys(kd)) {
    out[key] = { emp: kd[key]?.emp ?? null, wages: kd[key]?.wages ?? null };
  }
  return out;
}

/** Apply a decoded analysis back onto App setters. Tolerant of partial data. */
export function applyAnalysis(analysis, setters) {
  if (!analysis) return;
  const {
    setState, setCasinoName, setPropertyType, setInputMode,
    setRevenues, setKnownData, setGamingTaxCustomRate, setSlotRevenuePct,
  } = setters;
  if (analysis.state) setState(analysis.state);
  setCasinoName(analysis.casinoName || '');
  if (analysis.propertyType) setPropertyType(analysis.propertyType);
  if (analysis.inputMode) setInputMode(analysis.inputMode);
  if (analysis.revenues) setRevenues({ gaming: null, food: null, lodging: null, other: null, total: null, ...analysis.revenues });
  if (analysis.knownData) setKnownData(analysis.knownData);
  setGamingTaxCustomRate(analysis.gamingTaxCustomRate ?? null);
  setSlotRevenuePct(analysis.slotRevenuePct ?? 70);
}

// ---------------------------------------------------------------- URL encoding

/** Unicode-safe base64 (btoa chokes on multi-byte chars otherwise). */
function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64decode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(padded)));
}

export function encodeAnalysis(analysis) {
  return b64encode(JSON.stringify(analysis));
}

export function decodeAnalysis(token) {
  try {
    const obj = JSON.parse(b64decode(token));
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

/** Full shareable URL for the current analysis. */
export function buildShareURL(analysis) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(URL_PARAM, encodeAnalysis(analysis));
  return url.toString();
}

/** Read a shared analysis from the current URL, if present. */
export function readAnalysisFromURL() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get(URL_PARAM);
  return token ? decodeAnalysis(token) : null;
}

export function clearURLParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete(URL_PARAM);
  window.history.replaceState({}, '', url.pathname + url.search);
}

// ---------------------------------------------------------------- projects

export function loadProjects() {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persistProjects(list) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save projects', e);
  }
}

export function saveProject(name, analysis) {
  const list = loadProjects();
  const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const entry = { id, name: name.trim() || 'Untitled analysis', savedAt: new Date().toISOString(), analysis };
  list.unshift(entry);
  persistProjects(list);
  return entry;
}

export function deleteProject(id) {
  persistProjects(loadProjects().filter((p) => p.id !== id));
}

export function renameProject(id, name) {
  const list = loadProjects().map((p) => (p.id === id ? { ...p, name } : p));
  persistProjects(list);
}
