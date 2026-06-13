import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { X, Plus, ArrowRight } from 'lucide-react';
import { computeScenario, headlineMetrics } from '../../utils/computeScenario';
import { formatCurrency, formatJobs, formatNumber } from '../../utils/calculations';
import { SERIES, GRID_STROKE, AXIS_TICK, MUTED, POSITIVE, NEGATIVE } from '../../theme';
import Button from '../ui/Button';

const METRICS = [
  { key: 'output', label: 'Output', fmt: formatCurrency },
  { key: 'gdp', label: 'GDP', fmt: formatCurrency },
  { key: 'employment', label: 'Employment', fmt: (v) => formatJobs(v) },
  { key: 'wages', label: 'Wages', fmt: formatCurrency },
  { key: 'totalTax', label: 'Total Tax', fmt: formatCurrency },
];

function Delta({ value, base, fmt }) {
  if (base == null || base === 0 || value == null) return <span className="text-text-faint">—</span>;
  const diff = value - base;
  const pct = (diff / base) * 100;
  if (Math.abs(pct) < 0.05) return <span className="text-text-faint text-xs">baseline</span>;
  const color = diff > 0 ? POSITIVE : NEGATIVE;
  return (
    <span className="text-xs font-medium tabular-nums" style={{ color }}>
      {diff > 0 ? '+' : ''}{formatNumber(pct, 1)}%
    </span>
  );
}

/**
 * Side-by-side comparison of saved scenarios. The first scenario is the
 * baseline; others show deltas against it. A metric selector drives a grouped
 * bar chart for a quick visual read.
 */
export default function ScenarioCompare({ scenarios, onRemove, onAddCurrent, canAddCurrent }) {
  const [metric, setMetric] = useState('output');

  const computed = useMemo(
    () => scenarios.map((s) => ({ ...s, m: headlineMetrics(computeScenario(s.analysis)) })),
    [scenarios],
  );

  const activeMetric = METRICS.find((m) => m.key === metric);
  const baseM = computed[0]?.m;

  const chartData = computed.map((s, i) => ({
    name: s.name || `Scenario ${i + 1}`,
    value: s.m?.[metric] || 0,
    color: SERIES[i % SERIES.length],
  }));

  if (scenarios.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-text-muted mb-4">
          Capture the current inputs as a scenario, then change a state, tax rate, or
          revenue level and capture another to compare them side by side.
        </p>
        <Button variant="secondary" size="sm" icon={Plus} onClick={onAddCurrent} disabled={!canAddCurrent}>
          Add current as scenario
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline">
              <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-text-faint uppercase tracking-[0.06em]">Metric</th>
              {computed.map((s, i) => (
                <th key={s.id} className="text-right py-2.5 px-3 min-w-[140px]">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SERIES[i % SERIES.length] }} />
                    <span className="font-semibold text-ink truncate max-w-[120px]" title={s.name}>{s.name || `Scenario ${i + 1}`}</span>
                    {onRemove && (
                      <button onClick={() => onRemove(s.id)} className="text-text-faint hover:text-negative no-print" aria-label="Remove scenario">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <div className="text-[10.5px] font-normal text-text-muted mt-0.5">
                    {s.analysis.state} · {i === 0 ? 'baseline' : 'vs. baseline'}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map(({ key, label, fmt }) => (
              <tr key={key} className="border-b border-hairline/60 hover:bg-paper transition-colors">
                <th scope="row" className="text-left py-2.5 px-3 font-medium text-text-secondary">{label}</th>
                {computed.map((s, i) => (
                  <td key={s.id} className="text-right py-2.5 px-3 tabular-nums">
                    <div className="font-semibold text-ink">{s.m ? fmt(s.m[key]) : '—'}</div>
                    {i > 0 && <Delta value={s.m?.[key]} base={baseM?.[key]} fmt={fmt} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Metric selector + grouped bar chart */}
      <div>
        <div className="flex items-center gap-2 mb-3 flex-wrap no-print">
          <span className="text-xs text-text-muted">Chart metric:</span>
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                metric === m.key ? 'border-accent bg-accent-soft text-primary' : 'border-hairline text-text-muted hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 54)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false}
              tickFormatter={(v) => activeMetric.key === 'employment' ? formatJobs(v) : `$${formatNumber(v, 0)}`} />
            <YAxis type="category" dataKey="name" width={110} tick={{ ...AXIS_TICK, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(19,36,59,0.04)' }}
              formatter={(v) => [activeMetric.fmt(v), activeMetric.label]}
              contentStyle={{ borderRadius: 10, border: '1px solid #e5e8ed', fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={26}
              label={{ position: 'right', fill: MUTED, fontSize: 11, formatter: (v) => activeMetric.fmt(v) }}>
              {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {onAddCurrent && (
        <div className="flex items-center justify-between pt-1 no-print">
          <p className="text-xs text-text-faint flex items-center gap-1.5">
            <ArrowRight size={13} /> Change inputs on the left, then capture another scenario.
          </p>
          <Button variant="secondary" size="sm" icon={Plus} onClick={onAddCurrent} disabled={!canAddCurrent}>
            Add current
          </Button>
        </div>
      )}
    </div>
  );
}
