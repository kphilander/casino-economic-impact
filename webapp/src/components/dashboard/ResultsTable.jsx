import React from 'react';
import { formatNumber, formatJobs } from '../../utils/calculations';

function DefTooltip({ text, children }) {
  return (
    <span className="relative group cursor-help">
      <span className="underline decoration-dotted decoration-gray-400 underline-offset-2">{children}</span>
      {text && (
        <span className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute z-50 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 w-64 -top-2 left-full ml-2 shadow-lg pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}

export default function ResultsTable({ results, termDefs }) {
  const rows = [
    { label: 'Output ($M)', key: 'output', format: (v) => formatNumber(v, 1) },
    { label: 'GDP ($M)', key: 'gdp', format: (v) => formatNumber(v, 1) },
    { label: 'Employment (FTEs)', key: 'employment', format: (v) => formatJobs(v) },
    { label: 'Wages ($M)', key: 'wages', format: (v) => formatNumber(v, 1) },
    { label: 'Tax Revenue ($M)', key: 'tax', format: (v) => formatNumber(v, 1) }
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-hairline">
            <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-text-faint uppercase tracking-[0.06em]">Metric</th>
            <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-effect-direct uppercase tracking-[0.06em]">
              <DefTooltip text={termDefs?.direct}>Direct</DefTooltip>
            </th>
            <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-effect-indirect uppercase tracking-[0.06em]">
              <DefTooltip text={termDefs?.indirect}>Indirect</DefTooltip>
            </th>
            <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-effect-induced uppercase tracking-[0.06em]">
              <DefTooltip text={termDefs?.induced}>Induced</DefTooltip>
            </th>
            <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-ink uppercase tracking-[0.06em]">Total</th>
            <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-highlight uppercase tracking-[0.06em]">
              <DefTooltip text={termDefs?.multiplier}>Mult.</DefTooltip>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, key, format }) => {
            const mult = key === 'tax'
              ? (results.totals[key].direct > 0 ? results.totals[key].total / results.totals[key].direct : '-')
              : results.multipliers[key];
            return (
              <tr key={key} className="border-b border-hairline/60 hover:bg-paper transition-colors">
                <th scope="row" className="py-2.5 px-4 text-sm font-medium text-text-secondary text-left">
                  <DefTooltip text={termDefs?.[key]}>{label}</DefTooltip>
                </th>
                <td className="py-2.5 px-4 text-sm text-right text-effect-direct font-medium tabular-nums">{format(results.totals[key].direct)}</td>
                <td className="py-2.5 px-4 text-sm text-right text-effect-indirect tabular-nums">{format(results.totals[key].indirect)}</td>
                <td className="py-2.5 px-4 text-sm text-right text-effect-induced tabular-nums">{format(results.totals[key].induced)}</td>
                <td className="py-2.5 px-4 text-sm text-right font-bold text-ink tabular-nums">{format(results.totals[key].total)}</td>
                <td className="py-2.5 px-4 text-sm text-right font-semibold text-highlight tabular-nums">
                  {typeof mult === 'number' ? `${formatNumber(mult, 2)}x` : mult}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
