import React from 'react';
import { formatJobs, formatNumber } from '../../utils/calculations';

const EFFECTS = [
  { key: 'direct', label: 'Direct', color: '#1a365d', description: 'Jobs at the operation itself' },
  { key: 'indirect', label: 'Indirect', color: '#3182ce', description: 'Jobs in the supply chain' },
  { key: 'induced', label: 'Induced', color: '#4299e1', description: 'Jobs from employee spending' },
];

export default function EmploymentChart({ results }) {
  const emp = results.totals.employment;
  const total = emp.total;

  return (
    <div className="space-y-4">
      {/* Big total */}
      <div className="text-center py-3">
        <p className="text-4xl font-bold text-gray-900 tabular-nums">{formatJobs(total)}</p>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">Total Full-Time Equivalent Jobs</p>
      </div>

      {/* Stacked bar */}
      <div className="flex h-8 rounded-full overflow-hidden bg-gray-100 mx-2">
        {EFFECTS.map(({ key, color }) => {
          const pct = total > 0 ? (emp[key] / total) * 100 : 0;
          return (
            <div
              key={key}
              className="transition-all duration-500 ease-out relative group"
              style={{ width: `${pct}%`, background: color }}
            >
              {pct > 12 && (
                <span className="absolute inset-0 flex items-center justify-center text-white text-[11px] font-semibold">
                  {Math.round(pct)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail rows */}
      <div className="space-y-2.5 mt-4">
        {EFFECTS.map(({ key, label, color, description }) => {
          const value = emp[key];
          const pct = total > 0 ? (value / total) * 100 : 0;
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <span className="text-sm font-bold text-gray-900 tabular-nums">{formatJobs(value)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">{description}</span>
                  <span className="text-[11px] text-gray-400 tabular-nums">{formatNumber(pct, 1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
