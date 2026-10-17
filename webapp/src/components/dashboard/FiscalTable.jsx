import React from 'react';
import { formatCurrency } from '../../utils/calculations';

/**
 * Fiscal impact table built from computeScenario's `fiscal` bundle: one row per
 * tax line, then subtotals by level of government and a grand total. The
 * statutory gaming tax replaces the gaming share of direct TOPI, so every row
 * is additive.
 */
const LEVEL_LABEL = { federal: 'Federal', state_local: 'State & local' };

function Row({ label, sub, values, bold = false, shade = false }) {
  const cell = `py-3 px-4 text-sm text-right ${bold ? 'font-bold' : ''}`;
  return (
    <tr className={`${shade ? 'bg-gray-50 border-t border-gray-200' : 'border-b border-gray-100 hover:bg-gray-50'}`}>
      <th scope="row" className={`py-3 px-4 text-sm text-left ${bold ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
        {label}
        {sub && <span className="block text-xs font-normal text-gray-500">{sub}</span>}
      </th>
      <td className={`${cell} text-primary`}>{values.direct ? formatCurrency(values.direct) : '-'}</td>
      <td className={`${cell} text-accent`}>{values.indirect ? formatCurrency(values.indirect) : '-'}</td>
      <td className={`${cell} text-effect-induced`}>{values.induced ? formatCurrency(values.induced) : '-'}</td>
      <td className={`${cell} font-bold text-gray-900`}>{formatCurrency(values.total)}</td>
    </tr>
  );
}

export default function FiscalTable({ fiscal, gamingTaxLabel = null, localTaxNotes }) {
  if (!fiscal) return null;
  const { lines, totals } = fiscal;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tax</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-primary">Direct</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-accent">Indirect</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-effect-induced">Induced</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <Row key={l.key}
                   label={l.key === 'gaming' && gamingTaxLabel ? gamingTaxLabel : l.label}
                   sub={[LEVEL_LABEL[l.level], l.note].filter(Boolean).join(' · ')}
                   values={l} />
            ))}
            <Row label="Federal" values={totals.federal} shade />
            <Row label="State & local" values={totals.stateLocal} shade />
            <Row label="Total tax revenue" values={totals.all} bold shade />
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Where a statutory gaming tax applies, it replaces the gaming share of direct taxes on production
        and imports (TOPI), so every line above is additive; for a tribal property the compact revenue
        share replaces the gaming stream's direct TOPI entirely. Supplier and induced TOPI come from the
        I-O model. Payroll and household income taxes are estimated on QCEW-comparable wages (BEA
        compensation converted by industry) and filled jobs. At casinos the model's payroll share of revenue
        is likely too high, especially in high-gaming-tax states, so these lines may be overstated; enter known
        wages where available.{' '}
        {fiscal.incomeTaxMethod === 'per_worker'
          ? 'Household income taxes apply 2025 federal and state schedules to the average wage per job, for a single filer with no dependents.'
          : 'Household taxes use the BEA ratio of personal current taxes to wages (no state schedule available).'}
        {localTaxNotes && <span className="block mt-1 italic">Note: {localTaxNotes}</span>}
      </p>
    </>
  );
}
