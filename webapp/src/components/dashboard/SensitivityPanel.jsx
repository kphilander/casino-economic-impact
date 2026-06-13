import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { runSensitivity, runProjection, baseGGR, METRIC_META } from '../../utils/sensitivity';
import { formatCurrency, formatJobs, formatNumber } from '../../utils/calculations';
import { NAVY, ACCENT, GRID_STROKE, AXIS_TICK, HIGHLIGHT } from '../../theme';
import { SegmentedToggle } from '../ui/Field';

function fmtMetric(key, v) {
  return key === 'employment' ? formatJobs(v) : formatCurrency(v);
}

/**
 * Two analyst views over the current inputs:
 *  - Sensitivity: how a headline metric responds as revenue or the tax rate
 *    moves across a range.
 *  - Projection: a multi-year ramp at a chosen growth rate, with cumulative
 *    totals.
 * Both recompute the full model at each point (computeScenario) so tiered
 * taxes and employment caps are handled correctly.
 */
export default function SensitivityPanel({ analysis }) {
  const [tab, setTab] = useState('sensitivity');
  const [driver, setDriver] = useState('ggr');
  const [metric, setMetric] = useState('output');
  const [years, setYears] = useState(5);
  const [cagrPct, setCagrPct] = useState(8);

  const sens = useMemo(
    () => runSensitivity(analysis, { driver, steps: 9 }),
    [analysis, driver],
  );
  const proj = useMemo(
    () => runProjection(analysis, { years, cagr: cagrPct / 100 }),
    [analysis, years, cagrPct],
  );

  const base = baseGGR(analysis);
  const metricMeta = METRIC_META.find((m) => m.key === metric);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <SegmentedToggle
          value={tab}
          onChange={setTab}
          options={[{ value: 'sensitivity', label: 'Sensitivity' }, { value: 'projection', label: 'Projection' }]}
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          {METRIC_META.map((m) => (
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
      </div>

      {tab === 'sensitivity' ? (
        <>
          <div className="flex items-center gap-3 no-print">
            <span className="text-xs text-text-muted">Vary:</span>
            <SegmentedToggle
              value={driver}
              onChange={setDriver}
              options={[{ value: 'ggr', label: 'Revenue ±40%' }, { value: 'taxRate', label: 'Gaming tax 0–40%' }]}
            />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={sens.series} margin={{ top: 10, right: 20, left: 6, bottom: 4 }}>
              <defs>
                <linearGradient id="sensFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={NAVY} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis
                dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false}
                label={{ value: driver === 'ggr' ? 'Revenue (% of current)' : 'Gaming tax rate', position: 'insideBottom', offset: -2, fill: '#9aa4b1', fontSize: 10 }}
              />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false}
                tickFormatter={(v) => metric === 'employment' ? formatJobs(v) : `$${formatNumber(v, 0)}`} width={56} />
              <Tooltip
                formatter={(v) => [fmtMetric(metric, v), metricMeta.label]}
                labelFormatter={(l) => driver === 'ggr' ? `Revenue: ${l} of current` : `Tax rate: ${l}`}
                contentStyle={{ borderRadius: 10, border: '1px solid #e5e8ed', fontSize: 12 }}
              />
              {driver === 'ggr' && (
                <ReferenceLine x="100%" stroke={HIGHLIGHT} strokeDasharray="4 3"
                  label={{ value: 'Current', position: 'top', fill: HIGHLIGHT, fontSize: 10, fontWeight: 600 }} />
              )}
              <Area type="monotone" dataKey={metric} stroke={NAVY} strokeWidth={2} fill="url(#sensFill)"
                dot={{ r: 3, fill: NAVY, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-xs text-text-faint">
            {driver === 'ggr'
              ? `Each point recomputes the full model at that revenue level (current GGR ≈ $${formatNumber(base, 1)}M).`
              : 'Tax-rate sweep affects gaming tax and total tax; output, GDP, and employment are unaffected by the rate.'}
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-5 flex-wrap no-print">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Horizon:</span>
              <SegmentedToggle value={years} onChange={setYears}
                options={[{ value: 3, label: '3 yr' }, { value: 5, label: '5 yr' }, { value: 10, label: '10 yr' }]} />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <span className="text-xs text-text-muted whitespace-nowrap">Annual growth: <span className="font-semibold text-ink tabular-nums">{cagrPct}%</span></span>
              <input type="range" min="-10" max="25" value={cagrPct}
                onChange={(e) => setCagrPct(parseInt(e.target.value))} className="flex-1 accent-[#1a365d]" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={proj.series} margin={{ top: 10, right: 20, left: 6, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="year" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false}
                tickFormatter={(v) => metric === 'employment' ? formatJobs(v) : `$${formatNumber(v, 0)}`} width={56} />
              <Tooltip
                formatter={(v) => [fmtMetric(metric, v), metricMeta.label]}
                contentStyle={{ borderRadius: 10, border: '1px solid #e5e8ed', fontSize: 12 }}
              />
              <Line type="monotone" dataKey={metric} stroke={ACCENT} strokeWidth={2.5}
                dot={{ r: 3.5, fill: ACCENT, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: `${years}-yr Output`, v: formatCurrency(proj.cumulative.output) },
              { label: `${years}-yr GDP`, v: formatCurrency(proj.cumulative.gdp) },
              { label: `${years}-yr Wages`, v: formatCurrency(proj.cumulative.wages) },
              { label: `${years}-yr Total Tax`, v: formatCurrency(proj.cumulative.totalTax) },
            ].map((c) => (
              <div key={c.label} className="surface-sunken px-3 py-2.5">
                <p className="text-[10px] text-text-faint font-semibold uppercase tracking-[0.06em]">{c.label}</p>
                <p className="font-display text-lg font-semibold text-ink tabular-nums mt-0.5">{c.v}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-faint">
            Cumulative totals sum each year's impact; growth compounds GGR at {cagrPct}% annually from the current ${formatNumber(base, 1)}M.
          </p>
        </>
      )}
    </div>
  );
}
