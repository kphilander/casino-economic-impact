import React from 'react';
import { formatCurrency, formatJobs, formatNumber } from '../../utils/calculations';

/**
 * Headline-result band — the dashboard's hero. A dark navy panel with a brass
 * signature edge that leads with the project, a plain-language summary, and the
 * four headline figures rendered large in serif. This is the "what does it all
 * mean" moment that the prior card-row lacked.
 */
export default function HeroSummary({ results, state, casinoName, propertyTypeLabel, isOnline }) {
  const t = results.totals;
  const name = casinoName?.trim() || (isOnline ? 'This operation' : 'This property');
  const subject = isOnline ? 'operation' : 'property';

  const metrics = [
    { label: 'Total Output', value: formatCurrency(t.output.total), mult: results.multipliers.output },
    { label: 'Gross State Product', value: formatCurrency(t.gdp.total), mult: results.multipliers.gdp },
    { label: 'Jobs Supported', value: formatJobs(t.employment.total), mult: results.multipliers.employment, unit: 'FTE' },
    { label: 'Employee Wages', value: formatCurrency(t.wages.total), mult: results.multipliers.wages },
  ];

  return (
    <section className="hero px-7 py-7 sm:px-9 sm:py-8 mb-7 animate-fade-in-up" aria-label="Headline economic impact">
      <div className="flex flex-col gap-6">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-light mb-2">
            {state} · {propertyTypeLabel || 'Gaming operation'}
          </p>
          <h2 className="font-display text-2xl sm:text-[2rem] font-semibold leading-tight text-white">
            {name}
          </h2>
          <p className="text-sm sm:text-[0.95rem] text-white/70 mt-3 leading-relaxed">
            The {subject} generates an estimated{' '}
            <span className="text-white font-medium">{formatCurrency(t.output.total)}</span> in total economic
            output across {state} — contributing{' '}
            <span className="text-white font-medium">{formatCurrency(t.gdp.total)}</span> to gross state product
            and supporting <span className="text-white font-medium">{formatJobs(t.employment.total)}</span> jobs
            and <span className="text-white font-medium">{formatCurrency(t.wages.total)}</span> in wages,
            counting direct, indirect, and induced effects.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 rounded-xl overflow-hidden">
          {metrics.map((m) => (
            <div key={m.label} className="px-5 py-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/55">{m.label}</p>
              <p className="hero-figure text-3xl sm:text-[2.1rem] text-white mt-1.5">{m.value}</p>
              <p className="text-xs text-brass-light mt-1.5 font-medium tabular-nums">
                {formatNumber(m.mult, 2)}× multiplier{m.unit ? ` · ${m.unit}` : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
