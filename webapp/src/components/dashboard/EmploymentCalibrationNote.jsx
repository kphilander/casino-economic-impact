import React from 'react';
import { formatJobs } from '../../utils/calculations';

/**
 * Explains which direct-jobs basis the results use and shows the 90%
 * predictive interval from the 50-state QCEW validation. Renders nothing when
 * no calibrated stream is present (online, bars, or user-entered jobs).
 */
export default function EmploymentCalibrationNote({ results, onToggleBasis }) {
  const e = results?.totals?.employment;
  const d = e?.detail;
  if (!d) return null;
  const calibrated = e.basis === 'calibrated';
  return (
    <div className="mt-4 rounded-lg border border-hairline bg-gray-50 p-4 text-xs text-gray-600 space-y-1.5">
      <p className="text-sm font-medium text-gray-800">
        Direct jobs: {formatJobs(e.direct)}{' '}
        <span className="font-normal text-gray-500">
          (90% range {formatJobs(d.range.direct[0])}–{formatJobs(d.range.direct[1])})
        </span>
      </p>
      <p>
        {calibrated
          ? <>Calibrated to observed casino labor intensity. The I-O coefficient alone gives {formatJobs(d.model.direct)} direct jobs.</>
          : <>I-O model coefficient. Calibrated to observed casino labor intensity, direct jobs are {formatJobs(d.calibrated.direct)}.</>}
        {' '}Total jobs range {formatJobs(d.range.total[0])}–{formatJobs(d.range.total[1])}.
      </p>
      <p className="text-gray-500">
        A 50-state comparison with BLS QCEW found the gambling coefficient under-predicts jobs per wage
        dollar at casinos; the factor and range come from that comparison (2023 data). Only direct jobs
        have an observed benchmark, so supplier and induced jobs are shown as modeled.
        {onToggleBasis && (
          <>
            {' '}
            <button type="button" onClick={onToggleBasis} className="text-accent font-medium hover:underline no-print">
              {calibrated ? 'Show I-O coefficient instead' : 'Use calibrated estimate'}
            </button>
          </>
        )}
      </p>
    </div>
  );
}
