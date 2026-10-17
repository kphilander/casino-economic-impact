import { ACTIVITIES, activityResponse, type ActivityKey } from '../engine/activities';
import { NATIONAL } from '../engine/data';
import { multipliers, type RegionalModel } from '../engine/io';
import { NON_GAMING_TOPI_SHARE, PAYROLL_ADJUSTMENT, WAGE_BASIS } from '../engine/scenario';
import { ratio, pct } from './format';

const REPO = 'https://github.com/kphilander/casino-economic-impact';
const ORDER: ActivityKey[] = ['gambling', 'lodging', 'food', 'other', 'construction', 'online'];

export function MethodView({ model }: { model: RegionalModel }) {
  const meta = NATIONAL.metadata;
  return (
    <div className="method">
      <div className="view-head">
        <div>
          <h2>Method and data</h2>
          <p>
            The calculator builds a regional input-output model for {model.state} in the browser from the state&apos;s StateIO tables and applies
            it to the revenue entered. Full documentation: <a href={`${REPO}/blob/main/docs/methodology.md`}>methodology</a> and{' '}
            <a href={`${REPO}/blob/main/docs/data-provenance.md`}>data provenance</a>.
          </p>
        </div>
      </div>

      <section className="card">
        <h3>Multipliers for {model.state}</h3>
        <p className="card-sub">Per dollar of revenue (jobs per $1M of 2023 dollars). Type II includes household spending of labor income.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Industry</th><th scope="col">Output</th><th scope="col">GDP</th><th scope="col">Labor income</th>
                <th scope="col">Direct jobs</th><th scope="col">Total jobs</th>
              </tr>
            </thead>
            <tbody>
              {ORDER.map((k) => {
                const m = multipliers(activityResponse(model, k));
                return (
                  <tr key={k}>
                    <th scope="row">{ACTIVITIES[k].label} <span className="muted">({ACTIVITIES[k].sector})</span></th>
                    <td>{ratio(m.Type_II_Output, 3)}</td>
                    <td>{ratio(m.Type_II_VA, 3)}</td>
                    <td>{ratio(m.Type_II_Wage, 3)}</td>
                    <td>{ratio(m.Direct_Jobs_Per_1M_Output, 2)}</td>
                    <td>{ratio(m.Type_II_Jobs_Per_1M_Output, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card prose">
        <h3>Model</h3>
        <ul>
          <li>
            <strong>Structure.</strong> EPA StateIO {meta.ioYear} two-region summary tables (stateior {meta.stateior}), in-state block, {NATIONAL.industries.length} industries.
            Direct requirements use the industry technology assumption, A = (V q̂⁻¹)(U ĝ⁻¹); Type I effects use (I − A)⁻¹.
            Type II effects close the model with households: employee compensation per dollar of output, and in-state personal consumption per dollar of compensation.
          </li>
          <li>
            <strong>Employment.</strong> {meta.employmentYear} QCEW private filled jobs per dollar of {meta.employmentYear} StateIO output, by industry; estimated FTEs apply BEA national FTE/job ratios.
            Revenue is deflated to 2023 dollars with CPI-U before jobs are computed.
          </li>
          <li>
            <strong>Gambling.</strong> The StateIO 713 response adapted with national USEEIO 713200/US ratios: direct value added ×{ratio(NATIONAL.gambling.direct.va, 3)},
            compensation ×{ratio(NATIONAL.gambling.direct.compensation, 3)}, jobs ×{ratio(NATIONAL.gambling.direct.jobs, 3)}; supplier and induced value added ×{ratio(NATIONAL.gambling.increment.va, 3)}.
            All land-based property types use it for gaming revenue.
          </li>
          <li>
            <strong>Labor income and the gaming tax.</strong> StateIO gives every state the national value-added mix, but casino revenue includes the state gaming tax.
            Direct gaming compensation is multiplied by exp(−{PAYROLL_ADJUSTMENT.slope} × rate), estimated against the 2022 Economic Census (n = {PAYROLL_ADJUSTMENT.n};
            leave-one-out error {PAYROLL_ADJUSTMENT.leaveOneOutMAE.before} → {PAYROLL_ADJUSTMENT.leaveOneOutMAE.after} log points).
          </li>
          <li>
            <strong>Direct jobs range.</strong> The coefficient shows no bias against 2022 Economic Census jobs per revenue dollar; the 90% range is the cross-state spread of that comparison.
          </li>
          <li>
            <strong>Taxes.</strong> The statutory gaming tax replaces the gaming share of direct taxes on production; {pct(NON_GAMING_TOPI_SHARE)} (other taxes on production) is kept.
            Cash wages are compensation × the QCEW/BEA wage ratio ({pct(WAGE_BASIS.sectors['7132'], 1)} for gambling, {pct(WAGE_BASIS.private, 1)} all private).
            Payroll taxes use 2026 federal parameters and 2024 average state unemployment insurance rates; income taxes use 2025 schedules per worker.
          </li>
          <li>
            <strong>Online.</strong> Scenario ratios from operator SEC filings (2024), applied to the gambling profile: direct value added ×{ratio(NATIONAL.online.direct.va, 2)},
            compensation ×{ratio(NATIONAL.online.direct.compensation, 2)}, jobs per dollar of value added ×{ratio(NATIONAL.online.direct.jobsPerVa, 2)}; supplier and induced value added ×{ratio(NATIONAL.online.increment.va, 2)}.
          </li>
        </ul>
      </section>

      <section className="card prose">
        <h3>Data files</h3>
        <ul className="sources">
          {meta.sources.map((s) => <li key={s.file}><code>{s.file}</code> <span className="muted">md5 {s.md5}</span></li>)}
          <li>{meta.employmentSatellite}</li>
          <li>{meta.ftePerJob}</li>
          <li>{NATIONAL.gambling.source}</li>
        </ul>
      </section>
    </div>
  );
}
