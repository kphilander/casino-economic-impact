import { computeScenario, PROPERTY_TYPES, type Analysis, type ScenarioResult } from '../engine/scenario';
import { useModels } from './useModels';
import { jobs, money, pct, signedPct } from './format';
import { LATEST_CPI_YEAR } from '../engine/prices';

export interface SavedScenario { id: string; name: string; analysis: Analysis }

const MAX = 4;

/** The inputs that most often differ between scenarios. */
function describe(a: Analysis): string {
  const tax = a.gamingTax.customRate != null ? `${pct(a.gamingTax.customRate)} ${a.ownership === 'tribal' ? 'revenue share' : 'tax'}` : 'statutory tax';
  return [a.ownership === 'tribal' ? 'Tribal' : PROPERTY_TYPES[a.propertyType].label, tax, `${a.dollarYear ?? LATEST_CPI_YEAR} $`].join(' · ');
}

const ROWS: [string, (r: ScenarioResult) => number, (n: number) => string][] = [
  ['Revenue modeled', (r) => r.streams.reduce((s, x) => s + x.revenue, 0), money],
  ['Jobs supported', (r) => r.totals.jobs.total, jobs],
  ['Direct jobs', (r) => r.totals.jobs.direct, jobs],
  ['GDP (value added)', (r) => r.totals.gdp.total, money],
  ['Labor income', (r) => r.totals.compensation.total, money],
  ['Output', (r) => r.totals.output.total, money],
  ['Gaming tax', (r) => r.gamingTax?.amount ?? 0, money],
  ['State and local taxes', (r) => r.fiscal.totals.stateLocal.total, money],
  ['All taxes', (r) => r.fiscal.totals.all.total, money],
];

export function CompareView(props: {
  scenarios: SavedScenario[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onLoad: (a: Analysis) => void;
}) {
  const { scenarios } = props;
  const { models } = useModels(scenarios.map((s) => s.analysis.state));
  const results = scenarios.map((s) => {
    const m = models[s.analysis.state];
    return m ? computeScenario(s.analysis, m) : undefined;
  });
  const base = results[0];

  return (
    <div className="compare">
      <div className="view-head">
        <div>
          <h2>Compare scenarios</h2>
          <p>
            Add up to {MAX} versions of the analysis, for example different states, tax rates or revenue. The first is the baseline. Each scenario is
            recomputed with its own state&apos;s model; the percentage under a value is its change from the baseline.
          </p>
        </div>
        <button type="button" className="btn primary" onClick={props.onAdd} disabled={scenarios.length >= MAX}>Add current analysis</button>
      </div>
      {scenarios.length === 0 ? (
        <p className="empty">No scenarios yet. Set up an analysis and add it here.</p>
      ) : (
        <div className="table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {scenarios.map((s, i) => (
                  <th scope="col" key={s.id}>
                    <span className="scn-name">{i === 0 ? 'Baseline: ' : ''}{s.name}</span>
                    <span className="scn-meta">{describe(s.analysis)}</span>
                    <span className="scn-actions">
                      <button type="button" className="link" onClick={() => props.onLoad(s.analysis)}>Load</button>
                      <button type="button" className="link" onClick={() => props.onRemove(s.id)}>Remove</button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, get, fmt]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {results.map((r, i) => {
                    if (r === undefined) return <td key={i} className="muted">loading</td>;
                    if (r === null) return <td key={i} className="muted">no revenue</td>;
                    const v = get(r);
                    const b = base ? get(base) : 0;
                    return (
                      <td key={i}>
                        {fmt(v)}
                        {i > 0 && base && b !== 0 && <span className="delta">{signedPct(v / b - 1)}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
