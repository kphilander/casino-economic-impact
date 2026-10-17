import React from 'react';
import { InputField, SelectField, SegmentedToggle } from '../ui/Field';
import { CPI_YEARS, DEFAULT_ANALYSIS_YEAR } from '../../utils/calculations';

/**
 * Inputs-drawer section for analysis settings and optional modules:
 *   - dollar year of the revenue inputs (CPI-U deflation of the 2023-dollar
 *     employment coefficients)
 *   - ownership (commercial or tribal)
 *   - net new impact (visitor share, recapture of out-of-state play)
 *   - one-time construction phase
 */
export default function AnalysisOptions({
  analysisYear, setAnalysisYear,
  netImpact, setNetImpact,
  construction, setConstruction,
  ownership, setOwnership, stateHasTribal,
  isOnline,
}) {
  const yearOptions = [...CPI_YEARS].reverse().map(y => ({ value: String(y), label: `${y} dollars` }));
  const set = (setter, obj, key) => (v) => setter({ ...obj, [key]: v });

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-ink">Analysis settings</h3>

      <SelectField
        label="Dollar year of revenue figures"
        value={String(analysisYear ?? DEFAULT_ANALYSIS_YEAR)}
        onChange={(v) => setAnalysisYear(Number(v))}
        options={yearOptions}
        helpText="Revenue is deflated to 2023 dollars (BLS CPI-U) before the 2023 jobs coefficients are applied. Choose the year your revenue figures are from."
        id="analysis-year"
      />

      {!isOnline && (
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-text-secondary">Ownership</span>
          <SegmentedToggle
            options={[
              { value: 'commercial', label: 'Commercial' },
              { value: 'tribal', label: 'Tribal' },
            ]}
            value={ownership}
            onChange={setOwnership}
          />
          <p className="text-xs text-text-muted leading-relaxed">
            Tribal: no state gaming tax (enter the compact revenue share as a custom gaming tax rate), no
            state and local production taxes on the gaming operation, and no jobs range (tribal casinos are
            not in the Economic Census benchmark).
            {stateHasTribal ? '' : ' This state has no tribal gaming on record.'}
          </p>
        </div>
      )}

      <div className="space-y-3 border-t border-hairline pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <input type="checkbox" checked={!!netImpact.enabled}
                 onChange={(e) => setNetImpact({ ...netImpact, enabled: e.target.checked })} />
          Estimate net new impact
        </label>
        {netImpact.enabled && (
          <>
            <InputField label="Revenue from non-residents" value={netImpact.nonResidentShare}
                        onChange={set(setNetImpact, netImpact, 'nonResidentShare')} suffix="%"
                        placeholder="e.g. 40" id="net-nonresident"
                        helpText="Share of revenue from out-of-state visitors (e.g. from a player-database ZIP code analysis)." />
            <InputField label="Resident play recaptured" value={netImpact.recaptureShare}
                        onChange={set(setNetImpact, netImpact, 'recaptureShare')} suffix="%"
                        placeholder="e.g. 20" id="net-recapture"
                        helpText="Share of residents' gaming spending that would otherwise have gone to out-of-state casinos. The rest is treated as displaced local spending." />
          </>
        )}
      </div>

      <div className="space-y-3 border-t border-hairline pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <input type="checkbox" checked={!!construction.enabled}
                 onChange={(e) => setConstruction({ ...construction, enabled: e.target.checked })} />
          Add construction phase (one-time)
        </label>
        {construction.enabled && (
          <>
            <InputField label="Construction cost" value={construction.cost}
                        onChange={set(setConstruction, construction, 'cost')} prefix="$" suffix="M"
                        placeholder="e.g. 250" id="construction-cost" />
            <InputField label="Spent in state" value={construction.localShare}
                        onChange={set(setConstruction, construction, 'localShare')} suffix="%"
                        placeholder="60" id="construction-local"
                        helpText="Exclude land, gaming equipment and materials bought from out-of-state suppliers." />
            <InputField label="Build period" value={construction.years}
                        onChange={set(setConstruction, construction, 'years')} suffix="yrs"
                        placeholder="2" id="construction-years" />
          </>
        )}
      </div>
    </div>
  );
}
