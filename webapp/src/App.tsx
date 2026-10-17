import { useCallback, useEffect, useMemo, useState } from 'react';
import { BRAND, PRODUCT_NAME_VERSIONED, suggestedCitation } from './brand';
import { computeScenario, defaultAnalysis, PROPERTY_TYPES, type Analysis } from './engine/scenario';
import { analysisFromForecaster, analysisFromUrl, clearImportParams } from './engine/share';
import { InputsPanel } from './ui/InputsPanel';
import { ResultsView } from './ui/ResultsView';
import { CompareView, type SavedScenario } from './ui/CompareView';
import { SensitivityView } from './ui/SensitivityView';
import { MethodView } from './ui/MethodView';
import { ShareBar } from './ui/ShareBar';
import { useModels } from './ui/useModels';

type Tab = 'results' | 'compare' | 'sensitivity' | 'method';

const TABS: { key: Tab; label: string }[] = [
  { key: 'results', label: 'Results' },
  { key: 'compare', label: 'Compare' },
  { key: 'sensitivity', label: 'Sensitivity' },
  { key: 'method', label: 'Method' },
];

export function App() {
  const [fromForecaster, setFromForecaster] = useState(() => analysisFromForecaster() != null);
  const [analysis, setAnalysis] = useState<Analysis>(() => analysisFromUrl() ?? analysisFromForecaster() ?? defaultAnalysis());
  const [tab, setTab] = useState<Tab>('results');
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const { models, error } = useModels([analysis.state]);
  const model = models[analysis.state];
  const result = useMemo(() => (model ? computeScenario(analysis, model) : null), [analysis, model]);
  const update = useCallback((f: (a: Analysis) => Analysis) => setAnalysis(f), []);

  // A shared or imported analysis loads once; the address bar then returns to the plain URL.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has('a') || p.get('from') === 'forecaster') clearImportParams();
  }, []);

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
  else if (!model) body = <p className="empty">Wait. The app loads the input-output tables for {analysis.state}.</p>;
  else if (tab === 'method') body = <MethodView model={model} />;
  else if (tab === 'compare') {
    body = <CompareView scenarios={scenarios} onAdd={addScenario}
      onRemove={(id) => setScenarios((p) => p.filter((s) => s.id !== id))}
      onLoad={(a) => { setAnalysis(structuredClone(a)); setTab('results'); }} />;
  } else if (!result) body = <p className="empty">To see the economic impact, enter annual revenue.</p>;
  else if (tab === 'sensitivity') body = <SensitivityView analysis={analysis} model={model} result={result} />;
  else body = <ResultsView r={result} model={model} />;

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
          The revenue values come from the <a href="https://gamblingpolicy.com/tools/revenue-forecaster/">Casino Revenue Forecaster</a>. Examine the inputs before you use the results.
          <button type="button" className="link" onClick={() => setFromForecaster(false)}>Close</button>
        </p>
      )}

      <main className="layout">
        <aside className="inputs-col" aria-label="Inputs">
          <InputsPanel analysis={analysis} update={update} result={result} />
        </aside>
        <div className="main-col">
          <nav className="tabs" role="tablist" aria-label="Views">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
                {t.label}{t.key === 'compare' && scenarios.length ? ` (${scenarios.length})` : ''}
              </button>
            ))}
          </nav>
          <div role="tabpanel">{body}</div>
        </div>
      </main>

      <footer className="footer">
        <p>
          {PRODUCT_NAME_VERSIONED} · <a href={BRAND.repository}>Source code and data</a> ·{' '}
          <a href={`${BRAND.repository}/blob/main/docs/methodology.md`}>Methodology</a> ·{' '}
          <a href={`${BRAND.repository}/issues/new`}>Report an issue</a> · {BRAND.publisher}
        </p>
        <p className="citation">Suggested citation: {suggestedCitation()}</p>
      </footer>
    </div>
  );
}
