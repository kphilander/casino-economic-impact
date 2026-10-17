import React from 'react';
import { formatJobs } from '../../utils/calculations';

/**
 * Shows the 90% predictive range for direct jobs from the 50-state
 * comparison with the 2022 Economic Census. Renders nothing when no range
 * applies (bars with slots, tribal or online properties, user-entered jobs).
 */
export default function EmploymentRangeNote({ results }) {
  const e = results?.totals?.employment;
  const d = e?.detail;
  if (!d) return null;
  return (
    <div className="mt-4 rounded-lg border border-hairline bg-gray-50 p-4 text-xs text-gray-600 space-y-1.5">
      <p className="text-sm font-medium text-gray-800">
        Direct jobs: {formatJobs(e.direct)}{' '}
        <span className="font-normal text-gray-500">
          (90% range {formatJobs(d.range.direct[0])}–{formatJobs(d.range.direct[1])};
          total jobs {formatJobs(d.range.total[0])}–{formatJobs(d.range.total[1])})
        </span>
      </p>
      <p className="text-gray-500">
        Compared state by state with the 2022 Economic Census, the gambling coefficient's jobs per dollar
        of revenue show no bias at casinos, but individual states vary widely; the range reflects that
        variation. Only direct jobs have an observed benchmark, so supplier and induced jobs are shown as
        modeled. Enter known jobs for a specific property when available.
      </p>
    </div>
  );
}
