import React from 'react';
import { formatNumber } from '../../utils/calculations';

export default function CustomTooltip({ active, payload, label, formatter, unit = '$M' }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-100 p-3.5 min-w-[180px]">
      <p className="font-semibold text-gray-900 text-sm mb-2 pb-1.5 border-b border-gray-100">{label}</p>
      <div className="space-y-1.5">
        {payload.map((p, i) => (
          <div key={i} className="flex justify-between items-center gap-4">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <span className="text-xs text-gray-600">{p.name}</span>
            </span>
            <span className="text-xs font-semibold text-gray-900">
              {formatter ? formatter(p.value) : `${unit === 'jobs' ? '' : '$'}${formatNumber(p.value, 1)}${unit === 'jobs' ? ' jobs' : 'M'}`}
            </span>
          </div>
        ))}
      </div>
      {payload.length > 1 && (
        <div className="flex justify-between items-center gap-4 mt-1.5 pt-1.5 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-500">Total</span>
          <span className="text-xs font-bold text-gray-900">
            {formatter
              ? formatter(payload.reduce((s, p) => s + (p.value || 0), 0))
              : `${unit === 'jobs' ? '' : '$'}${formatNumber(payload.reduce((s, p) => s + (p.value || 0), 0), 1)}${unit === 'jobs' ? ' jobs' : 'M'}`}
          </span>
        </div>
      )}
    </div>
  );
}
