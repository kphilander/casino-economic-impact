import React from 'react';
import { formatNumber, formatCurrency } from '../../utils/calculations';
import { EFFECT as COLORS } from '../../theme';

function ImpactBar({ label, direct, indirect, induced, total, multiplier, formatter }) {
  const max = total;
  const pDirect = max > 0 ? (direct / max) * 100 : 0;
  const pIndirect = max > 0 ? (indirect / max) * 100 : 0;
  const pInduced = max > 0 ? (induced / max) * 100 : 0;

  return (
    <div className="group">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold text-gray-900 tabular-nums">{formatter(total)}</span>
          {multiplier && (
            <span className="text-xs font-semibold text-highlight tabular-nums">{formatNumber(multiplier, 2)}x</span>
          )}
        </div>
      </div>
      {/* Stacked bar */}
      <div className="flex h-5 rounded-full overflow-hidden bg-gray-100">
        <div
          className="transition-all duration-500 ease-out"
          style={{ width: `${pDirect}%`, background: COLORS.direct }}
          title={`Direct: ${formatter(direct)}`}
        />
        <div
          className="transition-all duration-500 ease-out"
          style={{ width: `${pIndirect}%`, background: COLORS.indirect }}
          title={`Indirect: ${formatter(indirect)}`}
        />
        <div
          className="transition-all duration-500 ease-out"
          style={{ width: `${pInduced}%`, background: COLORS.induced }}
          title={`Induced: ${formatter(induced)}`}
        />
      </div>
      {/* Hover detail */}
      <div className="flex justify-between mt-1 text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
        <span>Direct: {formatter(direct)}</span>
        <span>Indirect: {formatter(indirect)}</span>
        <span>Induced: {formatter(induced)}</span>
      </div>
    </div>
  );
}

export default function ImpactCompositionChart({ results }) {
  const metrics = [
    { label: 'Output', key: 'output', multiplier: results.multipliers.output },
    { label: 'GDP', key: 'gdp', multiplier: results.multipliers.gdp },
    { label: 'Wages', key: 'wages', multiplier: results.multipliers.wages },
    { label: 'Tax Revenue', key: 'tax', multiplier: results.totals.tax.direct > 0 ? results.totals.tax.total / results.totals.tax.direct : null },
  ];

  return (
    <div className="space-y-5">
      {metrics.map(({ label, key, multiplier }) => (
        <ImpactBar
          key={key}
          label={label}
          direct={results.totals[key].direct}
          indirect={results.totals[key].indirect}
          induced={results.totals[key].induced}
          total={results.totals[key].total}
          multiplier={multiplier}
          formatter={formatCurrency}
        />
      ))}
      {/* Legend */}
      <div className="flex justify-center gap-5 pt-2 border-t border-gray-100">
        {[
          { label: 'Direct', color: COLORS.direct },
          { label: 'Indirect', color: COLORS.indirect },
          { label: 'Induced', color: COLORS.induced }
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
