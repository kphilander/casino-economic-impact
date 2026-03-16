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
          <tr className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Metric</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-[#1a365d] uppercase tracking-wider">
              <DefTooltip text={termDefs?.direct}>Direct</DefTooltip>
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-[#3182ce] uppercase tracking-wider">
              <DefTooltip text={termDefs?.indirect}>Indirect</DefTooltip>
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-[#4299e1] uppercase tracking-wider">
              <DefTooltip text={termDefs?.induced}>Induced</DefTooltip>
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-900 uppercase tracking-wider">Total</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-[#f59e0b] uppercase tracking-wider">
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
              <tr key={key} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <th scope="row" className="py-3 px-4 text-sm font-medium text-gray-700 text-left">
                  <DefTooltip text={termDefs?.[key]}>{label}</DefTooltip>
                </th>
                <td className="py-3 px-4 text-sm text-right text-[#1a365d] font-medium tabular-nums">{format(results.totals[key].direct)}</td>
                <td className="py-3 px-4 text-sm text-right text-[#3182ce] tabular-nums">{format(results.totals[key].indirect)}</td>
                <td className="py-3 px-4 text-sm text-right text-[#4299e1] tabular-nums">{format(results.totals[key].induced)}</td>
                <td className="py-3 px-4 text-sm text-right font-bold text-gray-900 tabular-nums">{format(results.totals[key].total)}</td>
                <td className="py-3 px-4 text-sm text-right font-semibold text-[#f59e0b] tabular-nums">
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
