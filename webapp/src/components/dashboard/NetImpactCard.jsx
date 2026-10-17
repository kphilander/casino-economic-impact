import React from 'react';
import { formatCurrency, formatJobs, formatNumber } from '../../utils/calculations';

/**
 * Net new impact alongside the gross contribution. The net share is the
 * revenue that is new to the state: visitor spending plus resident spending
 * that would otherwise have left the state.
 */
export default function NetImpactCard({ results, net, netImpact }) {
  if (!results || !net) return null;
  const g = results.totals;
  const n = net.totals;
  const rows = [
    { label: 'Output', gross: g.output.total, net: n.output.total, fmt: formatCurrency },
    { label: 'GDP (value added)', gross: g.gdp.total, net: n.gdp.total, fmt: formatCurrency },
    { label: 'Employment (jobs)', gross: g.employment.total, net: n.employment.total, fmt: formatJobs },
    { label: 'Employee compensation', gross: g.wages.total, net: n.wages.total, fmt: formatCurrency },
  ];
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total impact</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Gross contribution</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900">Net new</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className="border-b border-gray-100">
                <th scope="row" className="py-3 px-4 text-sm font-medium text-gray-700 text-left">{r.label}</th>
                <td className="py-3 px-4 text-sm text-right text-gray-600">{r.fmt(r.gross)}</td>
                <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">{r.fmt(r.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Net new share = {formatNumber(netImpact.nonResidentShare ?? 0, 0)}% non-resident revenue
        {' + '}{formatNumber(100 - (netImpact.nonResidentShare ?? 0), 0)}% resident revenue
        × {formatNumber(netImpact.recaptureShare ?? 0, 0)}% recaptured from out-of-state
        {' = '}<strong>{formatNumber(net.share * 100, 1)}%</strong> of gross. The remainder is treated as
        spending displaced from other local businesses. The gross figures measure the operation's
        economic contribution; the net figures approximate what the state would lose if the activity
        did not exist. Neither accounts for social costs. Tax estimates above are gross.
      </p>
    </>
  );
}
