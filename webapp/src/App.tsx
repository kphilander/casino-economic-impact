import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { BRAND, BUILD, PRODUCT_NAME_VERSIONED, buildLabel, suggestedCitation } from './brand';
import type { RegionalModel } from './engine/io';
import { computeScenario, defaultAnalysis, PROPERTY_TYPES, type Analysis, type ScenarioResult } from './engine/scenario';
import { analysisFromForecaster, analysisFromUrl, clearImportParams, loadDraft, saveDraft } from './engine/share';
import { InputsPanel } from './ui/InputsPanel';
import { ResultsView } from './ui/ResultsView';
import { CompareView, type SavedScenario } from './ui/CompareView';
import { SensitivityView } from './ui/SensitivityView';
import { MethodView } from './ui/MethodView';
import { ShareBar } from './ui/ShareBar';
import { MobileSummary } from './ui/MobileSummary';
import { useModels } from './ui/useModels';

type Tab = 'results' | 'compare' | 'sensitivity' | 'method';

const TABS: { key: Tab; label: string }[] = [
  { key: 'results', label: 'Results' },
  { key: 'compare', label: 'Compare' },
  { key: 'sensitivity', label: 'Sensitivity' },
  { key: 'method', label: 'Method' },
];

const tabFromHash = (): Tab => {
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.key === h) ? (h as Tab) : 'results';
};

export function App() {
  const [fromForecaster, setFromForecaster] = useState(() => analysisFromForecaster() != null);
  // A share link or a forecaster import comes first; otherwise the analysis
  // that was on screen when this browser last closed the page.
  const [analysis, setAnalysis] = useState<Analysis>(
    () => analysisFromUrl() ?? analysisFromForecaster() ?? loadDraft() ?? defaultAnalysis(),
  );
  const [tab, setTabState] = useState<Tab>(tabFromHash);
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const { models, error } = useModels([analysis.state]);
  const model = models[analysis.state];
  const result = useMemo(() => (model ? computeScenario(analysis, model) : null), [analysis, model]);
  const update = useCallback((f: (a: Analysis) => Analysis) => setAnalysis(f), []);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const mainRef = useRef<HTMLDivElement>(null);

  // A shared or imported analysis loads once; the address bar then returns to the plain URL.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has('a') || p.get('from') === 'forecaster') clearImportParams();
  }, []);

  useEffect(() => { saveDraft(analysis); }, [analysis]);

  // The open tab is in the URL hash, so a reload or a copied address keeps it.
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    const url = window.location.pathname + window.location.search + (t === 'results' ? '' : `#${t}`);
    window.history.replaceState(null, '', url);
  }, []);
  useEffect(() => {
    const onHash = () => setTabState(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const target = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : step ? (i + step + TABS.length) % TABS.length : -1;
    if (target < 0) return;
    e.preventDefault();
    setTab(TABS[target].key);
    tabRefs.current[TABS[target].key]?.focus();
  };

  // While the tables of a newly selected state load, keep the last results on
  // screen (dimmed) instead of an empty panel.
  const [shown, setShown] = useState<{ model: RegionalModel; result: ScenarioResult | null } | null>(null);
  useEffect(() => { if (model) setShown({ model, result }); }, [model, result]);
  const loading = !model && !error;
  const viewModel = model ?? shown?.model;
  const viewResult = model ? result : shown?.result ?? null;

  const addScenario = () => {
    setScenarios((prev) => (prev.length >= 4 ? prev : [...prev, {
      id: `s_${Date.now().toString(36)}`,
      name: analysis.name.trim() || `${analysis.state}, ${PROPERTY_TYPES[analysis.propertyType].label.toLowerCase()}`,
      analysis: structuredClone(analysis),
    }]));
    setTab('compare');
  };

  let body;
  if (error) body = <p className="empty error">The app cannot load the model data: {error}</p>;
  else if (!viewModel) body = <p className="empty">Wait. The app loads the input-output tables for {analysis.state}.</p>;
  else if (tab === 'method') body = <MethodView model={viewModel} />;
  else if (tab === 'compare') {
    body = <CompareView scenarios={scenarios} onAdd={addScenario}
      onRemove={(id) => setScenarios((p) => p.filter((s) => s.id !== id))}
      onLoad={(a) => { setAnalysis(structuredClone(a)); setTab('results'); }} />;
  } else if (!viewResult) body = <p className="empty">To see the economic impact, enter annual revenue.</p>;
  else if (tab === 'sensitivity') body = <SensitivityView analysis={viewResult.analysis} model={viewModel} result={viewResult} />;
  else body = <ResultsView r={viewResult} model={viewModel} />;

  return (
    <div className="app">
      <header className="masthead">
        <p className="eyebrow">{BRAND.publisher} · Economic analysis</p>
        <h1>{PRODUCT_NAME_VERSIONED}: {BRAND.productFullName}</h1>
        <p className="lede">
          This calculator gives the direct, supplier and induced effects of casino and online gaming operations in each U.S. state. Your
          browser makes a regional input-output model from EPA StateIO tables and BLS employment data.
        </p>
      </header>

      <div className="toolbar">
        <ShareBar analysis={analysis} onLoad={(a) => { setAnalysis(a); setTab('results'); }} onCompare={addScenario} />
      </div>

      {fromForecaster && (
        <p className="banner" role="status">
          {/* One span, so the flex gap does not separate the link from the text. */}
          <span>
            The revenue values come from the <a href="https://gamblingpolicy.com/tools/revenue-forecaster/">Casino Revenue Forecaster</a>. Examine the inputs before you use the results.
          </span>
          <button type="button" className="link" onClick={() => setFromForecaster(false)}>Close</button>
        </p>
      )}

      <main className="layout">
        <aside className="inputs-col" aria-label="Inputs">
          <InputsPanel analysis={analysis} update={update} result={result} />
        </aside>
        <div className="main-col" ref={mainRef}>
          <nav className="tabs" role="tablist" aria-label="Views">
            {TABS.map((t, i) => (
              <button key={t.key} id={`tab-${t.key}`} ref={(el) => { tabRefs.current[t.key] = el; }}
                type="button" role="tab" aria-selected={tab === t.key} aria-controls="view-panel"
                tabIndex={tab === t.key ? 0 : -1}
                className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)} onKeyDown={(e) => onTabKey(e, i)}>
                {t.label}{t.key === 'compare' && scenarios.length ? ` (${scenarios.length})` : ''}
              </button>
            ))}
          </nav>
          {loading && viewModel && (
            <p className="loading-note" role="status">The app loads the input-output tables for {analysis.state}.</p>
          )}
          <div role="tabpanel" id="view-panel" aria-labelledby={`tab-${tab}`} aria-busy={loading}
            className={loading && viewModel ? 'stale' : undefined}>
            {body}
          </div>
        </div>
      </main>

      <MobileSummary result={result} target={mainRef} onShow={() => setTab('results')} />

      <footer className="footer">
        <p>
          {PRODUCT_NAME_VERSIONED} · <a href={BRAND.repository}>Source code and data</a> ·{' '}
          <a href={`${BRAND.repository}/blob/main/docs/methodology.md`}>Methodology</a> ·{' '}
          <a href={`${BRAND.repository}/issues/new`}>Report an issue</a> · {BRAND.publisher}
        </p>
        <p className="citation">Suggested citation: {suggestedCitation()}</p>
        <p className="citation">
          Build{' '}
          {BUILD.dirty || BUILD.commit === 'unknown'
            ? buildLabel()
            : <a href={`${BRAND.repository}/commit/${BUILD.commit}`}>{buildLabel()}</a>}
        </p>
      </footer>
    </div>
  );
}
