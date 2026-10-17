import React from 'react';
import { formatCurrency, formatJobs } from '../../utils/calculations';

/** One-time construction-phase impact (StateIO construction sector 23). */
export default function ConstructionCard({ construction }) {
  if (!construction) return null;
  const c = construction;
  const rows = [
    { label: 'Output', v: c.output, fmt: formatCurrency },
    { label: 'GDP (value added)', v: c.gdp, fmt: formatCurrency },
    { label: 'Employment (job-years)', v: c.employment, fmt: formatJobs },
    { label: 'Employee compensation', v: c.wages, fmt: formatCurrency },
  ];
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">One-time impact</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-primary">Direct</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-accent">Indirect</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-effect-induced">Induced</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className="border-b border-gray-100">
                <th scope="row" className="py-3 px-4 text-sm font-medium text-gray-700 text-left">{r.label}</th>
                <td className="py-3 px-4 text-sm text-right text-primary">{r.fmt(r.v.direct)}</td>
                <td className="py-3 px-4 text-sm text-right text-accent">{r.fmt(r.v.indirect)}</td>
                <td className="py-3 px-4 text-sm text-right text-effect-induced">{r.fmt(r.v.induced)}</td>
                <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">{r.fmt(r.v.total)}</td>
              </tr>
            ))}
            {c.fiscal && (
              <tr className="bg-gray-50 border-t border-gray-200">
                <th scope="row" className="py-3 px-4 text-sm font-bold text-gray-900 text-left">Tax revenue</th>
                <td className="py-3 px-4 text-sm text-right font-bold text-primary">{formatCurrency(c.fiscal.totals.all.direct)}</td>
                <td className="py-3 px-4 text-sm text-right font-bold text-accent">{formatCurrency(c.fiscal.totals.all.indirect)}</td>
                <td className="py-3 px-4 text-sm text-right font-bold text-effect-induced">{formatCurrency(c.fiscal.totals.all.induced)}</td>
                <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">{formatCurrency(c.fiscal.totals.all.total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        {formatCurrency(c.localSpend)} of in-state construction spending (of {formatCurrency(c.cost)} total)
        over {c.years} year{c.years === 1 ? '' : 's'}, using
        StateIO construction (sector 23) multipliers. Jobs are job-years: about {formatJobs(c.annualJobs)} jobs
        on average in each year of the build. These are temporary and are not added to the operating impact.
        Equipment and land purchased from outside the state should be excluded from the in-state share.
      </p>
    </>
  );
}
