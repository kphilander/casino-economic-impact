import { ACTIVITIES, activityResponse, type ActivityKey } from '../engine/activities';
import { NATIONAL } from '../engine/data';
import { multipliers, type RegionalModel } from '../engine/io';
import { NON_GAMING_TOPI_SHARE, PAYROLL_ADJUSTMENT, WAGE_BASIS } from '../engine/scenario';
import { coef, ratio, pct } from './format';
import { Explain } from './Explain';
import { buildLabel } from '../brand';

const KEY_SECTORS = ['713', '721', '722', '711AS', '23'];

function CoefficientRows({ model, codes }: { model: RegionalModel; codes: string[] }) {
  const c = model.coefficients;
  const n = model.n;
  return (
    <>
      {codes.map((code) => {
        const j = model.index[code];
        let purchases = 0;
        for (let i = 0; i < n; i++) purchases += model.A.data[i * n + j];
        const m = multipliers(model.respond(code));
        return (
          <tr key={code}>
            <th scope="row">{model.industries[j].name} <span className="muted">({code})</span></th>
            <td>{coef(purchases)}</td>
            <td>{coef(c.va[j])}</td>
            <td>{coef(c.compensation[j])}</td>
            <td>{coef(c.topi[j])}</td>
            <td>{coef(c.jobs[j], 2)}</td>
            <td>{coef(c.ftePerJob[j])}</td>
            <td>{coef(m.Type_I_Output)}</td>
            <td>{coef(m.Type_II_Output)}</td>
          </tr>
        );
      })}
    </>
  );
}

function CoefficientTable({ model, codes }: { model: RegionalModel; codes: string[] }) {
  return (
    <div className="table-wrap">
      <table className="coef-table">
        <thead>
          <tr>
            <th scope="col">Industry</th><th scope="col">In-state inputs per $</th><th scope="col">GDP per $</th><th scope="col">Labor income per $</th>
            <th scope="col">TOPI per $</th><th scope="col">Jobs per $1M</th><th scope="col">FTE per job</th>
            <th scope="col">Type I output</th><th scope="col">Type II output</th>
          </tr>
        </thead>
        <tbody><CoefficientRows model={model} codes={codes} /></tbody>
      </table>
    </div>
  );
}

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
            The calculator makes a regional input-output model for {model.state} in your browser, from the StateIO tables of the state. It uses this model
            for the revenue that you enter. For full documentation, see the <a href={`${REPO}/blob/main/docs/methodology.md`}>methodology</a> and the{' '}
            <a href={`${REPO}/blob/main/docs/data-provenance.md`}>data provenance</a>.
          </p>
        </div>
      </div>

      <section className="card">
        <h3>Multipliers for {model.state}</h3>
        <p className="card-sub">For each dollar of revenue. Jobs are for each $1M in 2023 dollars. Type II includes household purchases from labor income.</p>
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

      <section className="card">
        <h3>Coefficients of the multipliers</h3>
        <p className="card-sub">
          The table gives values for each dollar of output of each industry in {model.state}. In-state inputs are the column total of A. Value added, labor
          income and taxes on production come from StateIO 2019. Jobs are 2023 jobs for each $1M of 2023 output. FTE per job is the BEA ratio.
        </p>
        <p className="card-sub">
          StateIO gives all states the same national ratios for value added, labor income and taxes. As a result, the differences between states come from
          in-state inputs and jobs. The household column of the Type II model has {coef(model.householdColumn.reduce((s, x) => s + x, 0))} of in-state
          purchases for each $1 of labor income. This value is all in-state personal consumption divided by total labor income, as in the R pipeline.
        </p>
        <CoefficientTable model={model} codes={KEY_SECTORS} />
        <Explain title={`All ${model.n} industries`}>
          <CoefficientTable model={model} codes={model.industries.map((x) => x.code)} />
        </Explain>
      </section>

      <section className="card prose">
        <h3>How the model calculates a result</h3>
        <ol className="steps">
          <li>
            <strong>Tables.</strong> The model uses four tables of the state from StateIO {meta.ioYear}. These are the Make table V (industries × commodities), the
            domestic Use table U (in-state commodities × industries), industry output g and commodity output q.
          </li>
          <li>
            <strong>Direct requirements.</strong> D = V q̂⁻¹ gives the share of each commodity that each industry makes. B = U ĝ⁻¹ gives the in-state inputs
            for each dollar of output. A = D B (industry technology assumption).
          </li>
          <li>
            <strong>Type I.</strong> L = (I − A)⁻¹. Column j gives the in-state output of each industry that $1 of final demand for industry j causes, through
            all rounds of purchases.
          </li>
          <li>
            <strong>Type II.</strong> The model adds households as an industry. The household row is labor income for each dollar of output (V001 ÷ g). The
            household column is in-state personal consumption for each dollar of total labor income, changed to industries with D. L̄ = (I − Ā)⁻¹.
          </li>
          <li>
            <strong>Satellites.</strong> For each industry, the model calculates GDP, labor income and taxes on production for each dollar of output
            (V001–V003 ÷ g). Jobs for each $1M of output = {meta.employmentYear} QCEW jobs ÷ {meta.employmentYear} StateIO output. FTEs = jobs × BEA FTE/job.
          </li>
          <li>
            <strong>Effects.</strong> For revenue R to industry j: direct = R × coefficient of j; supplier = R × Σᵢ coefficientᵢ × (Lᵢⱼ − δᵢⱼ); induced = R × Σᵢ
            coefficientᵢ × (L̄ᵢⱼ − Lᵢⱼ). For jobs and FTEs, the model first changes R to 2023 dollars with CPI-U.
          </li>
          <li>
            <strong>Gaming and online.</strong> Gaming revenue uses the 713 response with national USEEIO 713200 ratios. Online revenue uses the gambling
            response with operator ratios (see Model, below).
          </li>
          <li>
            <strong>Labor adjustments.</strong> Direct gaming labor income × exp(−{PAYROLL_ADJUSTMENT.slope} × gaming tax rate). Observed jobs or wages replace
            the direct values. Induced effects change with direct and supplier labor income.
          </li>
          <li>
            <strong>Taxes.</strong> Cash wages = labor income × QCEW/BEA wage ratio. The statutory gaming tax replaces the gaming part of direct taxes on
            production. The model calculates payroll and income taxes for each job at the average wage.
          </li>
          <li>
            <strong>Ranges and modules.</strong> The range for direct jobs multiplies direct jobs by factors from the Economic Census. Net impact multiplies
            each value by the net share. Construction is final demand for industry 23.
          </li>
        </ol>
        <p className="footnote">
          On the Results tab, each table has a &ldquo;How the model calculates this&rdquo; panel. The panel shows these steps with the numbers of the current analysis.
        </p>
      </section>

      <section className="card prose">
        <h3>Model</h3>
        <ul>
          <li>
            <strong>Structure.</strong> EPA StateIO {meta.ioYear} two-region summary tables (stateior {meta.stateior}), in-state part, {NATIONAL.industries.length} industries.
            Direct requirements use the industry technology assumption, A = (V q̂⁻¹)(U ĝ⁻¹). Type I effects use (I − A)⁻¹. Type II effects add households to the
            model: compensation for each dollar of output, and in-state personal consumption for each dollar of compensation.
          </li>
          <li>
            <strong>Employment.</strong> {meta.employmentYear} QCEW private filled jobs for each dollar of {meta.employmentYear} StateIO output, by industry. The model
            calculates FTEs with BEA national FTE/job ratios. Before it calculates jobs, the model changes revenue to 2023 dollars with CPI-U.
          </li>
          <li>
            <strong>Gambling.</strong> The StateIO 713 response, with national USEEIO 713200/US ratios: direct value added ×{ratio(NATIONAL.gambling.direct.va, 3)},
            compensation ×{ratio(NATIONAL.gambling.direct.compensation, 3)}, jobs ×{ratio(NATIONAL.gambling.direct.jobs, 3)}; supplier and induced value added
            ×{ratio(NATIONAL.gambling.increment.va, 3)}. All land-based property types use these coefficients for gaming revenue.
          </li>
          <li>
            <strong>Labor income and the gaming tax.</strong> StateIO gives all states the national value-added mix. But casino revenue includes the state gaming
            tax. For this reason, the model multiplies direct gaming compensation by exp(−{PAYROLL_ADJUSTMENT.slope} × rate). The slope comes from the 2022 Economic
            Census (n = {PAYROLL_ADJUSTMENT.n}). The leave-one-out error decreases from {PAYROLL_ADJUSTMENT.leaveOneOutMAE.before} to {PAYROLL_ADJUSTMENT.leaveOneOutMAE.after} log points.
          </li>
          <li>
            <strong>Range for direct jobs.</strong> The coefficient shows no bias against 2022 Economic Census jobs per revenue dollar. The 90% range is the
            spread of that comparison across states.
          </li>
          <li>
            <strong>Taxes.</strong> The statutory gaming tax replaces the gaming part of direct taxes on production. The model keeps {pct(NON_GAMING_TOPI_SHARE)} (other
            taxes on production). Cash wages = compensation × the QCEW/BEA wage ratio: {pct(WAGE_BASIS.sectors['7132'], 1)} for gambling and {pct(WAGE_BASIS.private, 1)} for
            all private industries. Payroll taxes use 2026 federal values and 2024 average state unemployment insurance rates. Income taxes use 2025 schedules
            for each worker.
          </li>
          <li>
            <strong>Online.</strong> The model uses approximate ratios from operator SEC filings (2024) on the gambling profile. Direct effects: value added
            ×{ratio(NATIONAL.online.direct.va, 2)}, compensation ×{ratio(NATIONAL.online.direct.compensation, 2)}, jobs for each dollar of value added
            ×{ratio(NATIONAL.online.direct.jobsPerVa, 2)}. Supplier and induced effects: value added ×{ratio(NATIONAL.online.increment.va, 2)}.
          </li>
        </ul>
      </section>

      <section className="card prose">
        <h3>Data files</h3>
        <ul className="sources">
          <li>Calculator build: commit <code>{buildLabel()}</code>.</li>
          {meta.sources.map((s) => <li key={s.file}><code>{s.file}</code> <span className="muted">md5 {s.md5}</span></li>)}
          <li><code>employment_all_sectors_2023.csv</code>, from 08a_process_all_qcew_employment.R: 2023 QCEW private filled jobs (annual average) by StateIO industry. HS, GFE and GSLE have zero jobs.</li>
          <li><code>fte_ratios_2023.csv</code>, from 08b_generate_bea_fte_ratios.R: BEA NIPA tables 6.4D and 6.5D, 2023.</li>
          <li><code>national_naics_ratios.csv</code>, from 13_extract_national_naics_ratios.R: USEEIOv2.0.1-411 713200/US compared with the output-weighted 713 parent.</li>
        </ul>
      </section>
    </div>
  );
}
