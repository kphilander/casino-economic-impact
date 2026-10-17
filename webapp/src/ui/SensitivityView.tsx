import { useMemo, useState } from 'react';
import type { RegionalModel } from '../engine/io';
import { baseGgr, project, sweepGgr, sweepTaxRate, type SweepPoint } from '../engine/sensitivity';
import type { Analysis, Headline, ScenarioResult } from '../engine/scenario';
import { LineChart } from './LineChart';
import { NumberField, Segmented, SelectField } from './fields';
import { jobs, money, pct } from './format';

const METRICS: { key: keyof Headline; label: string; fmt: (n: number) => string }[] = [
  { key: 'jobs', label: 'Jobs supported', fmt: jobs },
  { key: 'gdp', label: 'GDP (value added)', fmt: money },
  { key: 'compensation', label: 'Labor income', fmt: money },
  { key: 'output', label: 'Output', fmt: money },
  { key: 'gamingTax', label: 'Gaming tax', fmt: money },
  { key: 'totalTax', label: 'All taxes', fmt: money },
];

export function SensitivityView({ analysis, model, result }: { analysis: Analysis; model: RegionalModel; result: ScenarioResult }) {
  const [driver, setDriver] = useState<'ggr' | 'tax'>('ggr');
  const [metric, setMetric] = useState<keyof Headline>('jobs');
  const [years, setYears] = useState<number | null>(5);
  const [growth, setGrowth] = useState<number | null>(0.03);
  const m = METRICS.find((x) => x.key === metric)!;
  const ggr = baseGgr(analysis);
  const series: SweepPoint[] = useMemo(
    () => (driver === 'ggr' ? sweepGgr(analysis, model) : sweepTaxRate(analysis, model)),
    [analysis, model, driver],
  );
  const proj = useMemo(
    () => project(analysis, model, Math.min(30, Math.max(1, Math.round(years ?? 5))), growth ?? 0),
    [analysis, model, years, growth],
  );
  const taxSweepUnavailable = driver === 'tax' && !result.gamingTax && analysis.inputMode === 'total';
  const currentRate = result.gamingTax?.effectiveRate;

  return (
    <div className="sensitivity">
      <div className="view-head">
        <div>
          <h2>Sensitivity</h2>
          <p>Each point recomputes the full analysis, so tiered tax schedules, wage caps and the payroll adjustment respond.</p>
        </div>
      </div>
      <section className="card">
        <div className="controls">
          <Segmented label="Vary" value={driver} onChange={setDriver}
            options={[{ value: 'ggr', label: 'Gaming revenue ±40%' }, { value: 'tax', label: 'Gaming tax rate 0–40%' }]} />
          <SelectField label="Show" value={metric} onChange={setMetric} options={METRICS.map((x) => ({ value: x.key, label: x.label }))} />
        </div>
        {!(ggr > 0) ? (
          <p className="empty">Enter gaming revenue to run a sweep.</p>
        ) : taxSweepUnavailable ? (
          <p className="empty">A tax-rate sweep needs gaming revenue (GGR). Enter revenue by department.</p>
        ) : (
          <>
            <LineChart
              title={`${m.label} by ${driver === 'ggr' ? 'gaming revenue' : 'gaming tax rate'}`}
              points={series.map((p) => ({ x: p.x, y: p[metric] }))}
              xLabel={(x) => (driver === 'ggr' ? money(x, 0) : pct(x, 0))}
              yLabel={m.fmt}
              markX={driver === 'ggr' ? ggr : currentRate}
            />
            <div className="table-wrap">
              <table>
                <thead><tr><th scope="col">{driver === 'ggr' ? 'Gaming revenue' : 'Tax rate'}</th>{METRICS.map((x) => <th scope="col" key={x.key}>{x.label}</th>)}</tr></thead>
                <tbody>
                  {series.map((p) => (
                    <tr key={p.x}>
                      <th scope="row">{driver === 'ggr' ? `${money(p.x)} (${p.label})` : p.label}</th>
                      {METRICS.map((x) => <td key={x.key}>{x.fmt(p[x.key])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h3>Multi-year projection</h3>
        <p className="card-sub">Gaming revenue grows at a constant annual rate; other revenue is held at the current level. Values stay in {result.dollarYear} dollars.</p>
        <div className="controls">
          <NumberField label="Years" value={years} onChange={setYears} min={1} max={30} step={1} />
          <NumberField label="Real growth of gaming revenue" value={growth} onChange={setGrowth} unit="% per year" percent />
        </div>
        {ggr > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Year</th><th scope="col">Gaming revenue</th>{METRICS.map((x) => <th scope="col" key={x.key}>{x.label}</th>)}</tr></thead>
              <tbody>
                {proj.series.map((p) => (
                  <tr key={p.year}>
                    <th scope="row">{p.year}</th>
                    <td>{money(p.ggr)}</td>
                    {METRICS.map((x) => <td key={x.key}>{x.fmt(p[x.key])}</td>)}
                  </tr>
                ))}
                <tr className="grand">
                  <th scope="row">Cumulative</th>
                  <td />
                  {METRICS.map((x) => <td key={x.key}>{x.key === 'jobs' ? '–' : money(proj.cumulative[x.key as Exclude<keyof Headline, 'jobs'>])}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
