/**
 * "How this is computed" panels. Each panel reads the basis the engine
 * recorded for the result on screen (coefficients, deflator, wage ratios,
 * tax steps), so the explanation and the result cannot disagree.
 */
import { useState, type ReactNode } from 'react';
import { ACTIVITIES } from '../engine/activities';
import { NATIONAL } from '../engine/data';
import { EFFECTS, type Effect, type Metric, type RegionalModel } from '../engine/io';
import { CPI, CPI_BASE_YEAR } from '../engine/prices';
import { JOBS_RANGES, PAYROLL_ADJUSTMENT, type ScenarioResult, type Stream } from '../engine/scenario';
import type { Fiscal } from '../engine/fiscal';
import type { TaxStep } from '../engine/tax';
import { coef, jobs, money, pct, usd } from './format';

export function Explain({ title = 'How this is computed', children }: { title?: string; children: ReactNode }) {
  return (
    <details className="explain">
      <summary>{title}</summary>
      <div className="explain-body">{children}</div>
    </details>
  );
}

const EFFECT_LABEL: Record<Effect, string> = { direct: 'Direct', indirect: 'Supplier', induced: 'Induced' };

// ------------------------------------------------------------ headline

export function DefinitionsExplain() {
  return (
    <Explain title="What these figures measure">
      <dl className="defs">
        <dt>Direct, supplier, induced</dt>
        <dd>Direct effects are the property&apos;s own activity. Supplier (indirect) effects are the in-state production its purchases require, through every round of the supply chain. Induced effects are the in-state production that households buy with the labor income of the direct and supplier rounds. Totals add the three.</dd>
        <dt>Jobs supported</dt>
        <dd>Annual average filled jobs, full and part time, on the QCEW basis. A person with two jobs counts twice. Full-time equivalents are estimated separately with BEA FTE/job ratios.</dd>
        <dt>GDP (value added)</dt>
        <dd>Labor income plus taxes on production and imports plus gross operating surplus. It excludes purchased inputs, so it does not double count across rounds.</dd>
        <dt>Labor income</dt>
        <dd>BEA employee compensation: wages and salaries, including BEA&apos;s estimate of unreported tips, plus benefits and employer social insurance contributions. Taxes use cash wages, a lower figure (see Tax revenue).</dd>
        <dt>Output</dt>
        <dd>The value of production of every industry affected. It includes intermediate purchases, so it counts the same inputs at each round and exceeds GDP.</dd>
        <dt>Tax revenue</dt>
        <dd>The sum of the tax lines below. The statutory gaming tax replaces the gaming share of the model&apos;s taxes on production, so nothing is counted twice.</dd>
      </dl>
    </Explain>
  );
}

// ------------------------------------------------------------ economic impact

const ROWS: { m: Metric; label: string; digits: number }[] = [
  { m: 'output', label: 'Output ($ per $ of revenue)', digits: 3 },
  { m: 'va', label: 'GDP ($ per $ of revenue)', digits: 3 },
  { m: 'compensation', label: 'Labor income ($ per $ of revenue)', digits: 3 },
  { m: 'jobs', label: 'Jobs per $1M (2023 dollars)', digits: 2 },
  { m: 'fte', label: 'FTEs per $1M (2023 dollars)', digits: 2 },
];

function profileSentence(s: Stream): string | null {
  const g = NATIONAL.gambling;
  const o = NATIONAL.online;
  const gamb = `the state's amusement, gambling and recreation (713) response with national USEEIO 713200 ratios: direct GDP ×${coef(g.direct.va)}, labor income ×${coef(g.direct.compensation)}, taxes on production ×${coef(g.direct.topi)}, jobs ×${coef(g.direct.jobs)}; supplier and induced output ×${coef(g.increment.output)}, GDP, jobs and FTEs ×${coef(g.increment.va)}, labor income ×${coef(g.increment.compensation)}`;
  if (s.activity === 'gambling') return `Gambling (7132) coefficients are ${gamb}.`;
  if (s.activity === 'online') {
    return `Online coefficients are the gambling coefficients (${gamb}) with operator ratios: direct GDP ×${coef(o.direct.va, 2)}, labor income ×${coef(o.direct.compensation, 2)}, jobs ×${coef(o.direct.jobsPerVa * o.direct.va, 3)}; supplier and induced output and GDP ×${coef(o.increment.va, 2)}, labor income ×${coef(o.increment.compensation, 2)}. Direct FTEs use the computer systems design (5415) FTE/job ratio.`;
  }
  return null;
}

function StreamTrace({ r, s }: { r: ScenarioResult; s: Stream }) {
  const imp = s.impact;
  const b = imp.basis;
  const pm = b.perMillion;
  const act = ACTIVITIES[s.activity];
  const applied = (m: Metric, e: Effect) => {
    let v = pm[m][e];
    if (m === 'compensation' && e === 'direct' && imp.sources.compensation === 'adjusted') v *= b.compensationFactor;
    if (e === 'induced') v *= imp.inducedScale;
    return v;
  };
  const marked = (m: Metric, e: Effect) =>
    (m === 'compensation' && e === 'direct' && imp.sources.compensation !== 'model')
    || (e === 'induced' && imp.inducedScale !== 1)
    || ((m === 'jobs' || m === 'fte') && e === 'direct' && imp.sources.jobs === 'user');
  const rev2023 = b.revenue * b.deflator;
  const modelTypeI = b.revenue * (pm.compensation.direct + pm.compensation.indirect);
  const typeI = imp.compensation.direct + imp.compensation.indirect;
  const range = b.jobsRangeRatios ? Object.values(JOBS_RANGES.propertyTypes).find((x) => x.p05 === b.jobsRangeRatios!.p05) : undefined;
  const profile = profileSentence(s);

  return (
    <>
      <p className="table-title">{s.label}: {money(s.revenue)} of revenue × coefficients for {act.label.toLowerCase()} ({act.sector}) in {r.analysis.state}</p>
      <div className="table-wrap">
        <table className="coef-table">
          <thead><tr><th scope="col">Coefficient</th>{EFFECTS.map((e) => <th scope="col" key={e}>{EFFECT_LABEL[e]}</th>)}</tr></thead>
          <tbody>
            {ROWS.map(({ m, label, digits }) => (
              <tr key={m}>
                <th scope="row">{label}</th>
                {EFFECTS.map((e) => (
                  <td key={e}>
                    {m === 'compensation' && e === 'direct' && imp.sources.compensation === 'user' ? 'observed'
                      : m === 'jobs' && e === 'direct' && imp.sources.jobs === 'user' ? 'observed'
                        : m === 'fte' && e === 'direct' && imp.sources.jobs === 'user' ? 'from jobs'
                        : coef(applied(m, e), digits)}
                    {marked(m, e) && <sup>*</sup>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="steps">
        <li>
          <strong>Coefficients.</strong> Direct coefficients are the industry&apos;s own ratios to output: StateIO 2019 value added (V001–V003) and
          compensation (V001), and 2023 QCEW jobs per dollar of 2023 output. A supplier coefficient sums each industry&apos;s ratio over the output
          that $1 of this industry&apos;s sales requires from it through the Leontief inverse, (I − A)⁻¹, net of the $1 itself. An induced coefficient
          does the same with the Type II inverse, which adds households, less the Type I result.
          {profile && <> {profile}</>}
        </li>
        <li>
          <strong>Dollar effects.</strong> Output, GDP and labor income are revenue × coefficient: direct GDP = {money(b.revenue)} × {coef(pm.va.direct)} = {money(imp.gdp.direct)};
          supplier GDP = {money(b.revenue)} × {coef(pm.va.indirect)} = {money(imp.gdp.indirect)}.
        </li>
        <li>
          <strong>Jobs.</strong> The jobs coefficients are per dollar of 2023 output, so revenue is converted first: {money(b.revenue)} × {coef(b.deflator, 4)}{' '}
          (CPI-U {CPI[CPI_BASE_YEAR]} for {CPI_BASE_YEAR} ÷ {CPI[r.dollarYear]} for {r.dollarYear}) = {money(rev2023)} in {CPI_BASE_YEAR} dollars.{' '}
          {imp.sources.jobs === 'user'
            ? <>Direct jobs are observed: {jobs(b.knownJobs)}; direct FTEs = {jobs(b.knownJobs)} × {coef(b.directFtePerJob)} FTE per job = {jobs(imp.fte.direct)}.</>
            : <>Direct jobs = {money(rev2023)} × {coef(pm.jobs.direct, 2)} per $1M = {jobs(imp.jobs.direct)}.</>}
          {' '}Supplier jobs = {money(rev2023)} × {coef(pm.jobs.indirect, 2)} = {jobs(imp.jobs.indirect)}.
        </li>
        {imp.sources.compensation === 'adjusted' && r.payrollAdjustment && (
          <li>
            <strong>Gaming-tax adjustment.</strong> Direct labor income = {money(b.revenue)} × {coef(pm.compensation.direct)} × exp(−{PAYROLL_ADJUSTMENT.slope} × {coef(r.payrollAdjustment.rate, 4)})
            = {money(imp.compensationAdjustment!.modelDirect)} × {coef(b.compensationFactor)} = {money(imp.compensation.direct)}. The rate is the
            {r.payrollAdjustment.rateSource === 'computed' ? ' effective gaming tax rate computed below' : r.payrollAdjustment.rateSource === 'custom' ? ' custom rate entered' : ` state's blended effective rate (no GGR was entered)`}.
          </li>
        )}
        {imp.sources.compensation === 'user' && (
          <li>
            <strong>Observed wages.</strong> Direct labor income = observed cash wages {money(b.knownWages)} ÷ {coef(b.cashShare.direct)} (QCEW wages per dollar of BEA
            compensation for this industry) = {money(imp.compensation.direct)}.
          </li>
        )}
        {imp.inducedScale !== 1 && (
          <li>
            <strong>Induced rescaling.</strong> Household spending follows labor income. Direct plus supplier labor income is {money(typeI)} instead of the
            modeled {money(modelTypeI)}, so every induced coefficient is multiplied by {coef(imp.inducedScale, 4)} (marked *).
          </li>
        )}
        <li>
          <strong>Cash wages</strong> (the tax base) = labor income × {coef(b.cashShare.direct)} for direct effects and × {coef(b.cashShare.ripple)} for supplier and
          induced effects: 2023 QCEW private wages ÷ BEA compensation, for this industry and for all private industries. Direct cash wages: {money(imp.cashWages.direct)}.
        </li>
        {imp.jobsRange && b.jobsRangeRatios && (
          <li>
            <strong>Jobs range.</strong> 90% range of direct jobs = {jobs(imp.jobs.direct)} × {coef(b.jobsRangeRatios.p05, 3)} to {jobs(imp.jobs.direct)} × {coef(b.jobsRangeRatios.p95, 3)}
            = {jobs(imp.jobsRange.direct[0])} to {jobs(imp.jobsRange.direct[1])}. The factors are the 5th and 95th percentiles of the ratio of 2022 Economic Census
            to modeled jobs per revenue dollar{range ? ` for ${range.label.toLowerCase()}s across ${range.n} states` : ''}. Supplier and induced jobs are added unchanged.
          </li>
        )}
      </ol>
    </>
  );
}

export function ImpactExplain({ r }: { r: ScenarioResult }) {
  const [k, setK] = useState(0);
  const s = r.streams[Math.min(k, r.streams.length - 1)];
  return (
    <Explain>
      <p>Every figure in the table is revenue × a coefficient for the industry that receives the revenue, summed over revenue streams.</p>
      {r.streams.length > 1 && (
        <div className="segmented small" role="radiogroup" aria-label="Revenue stream">
          {r.streams.map((x, i) => (
            <button key={x.key} type="button" role="radio" aria-checked={x === s} className={x === s ? 'on' : ''} onClick={() => setK(i)}>{x.label}</button>
          ))}
        </div>
      )}
      <StreamTrace r={r} s={s} />
    </Explain>
  );
}

// ------------------------------------------------------------ taxes

function stepLabel(x: TaxStep): string {
  const band = x.to == null ? (x.from === 0 ? 'all' : `above $${x.from}M`) : `$${x.from}M to $${x.to}M`;
  if (x.part === 'addOn') return 'Add-on tax on all GGR';
  if (x.part === 'slots') return `Slots, ${band}`;
  if (x.part === 'tables') return `Table games, ${band}`;
  return band === 'all' ? 'All GGR' : `GGR ${band}`;
}

function GamingTaxSteps({ r }: { r: ScenarioResult }) {
  const g = r.gamingTax;
  if (!g) return null;
  const rule = g.rule;
  return (
    <>
      <h4>{g.tribal ? 'Compact revenue share' : 'Gaming tax'}</h4>
      <div className="table-wrap">
        <table className="coef-table">
          <thead><tr><th scope="col">Component</th><th scope="col">Taxable GGR</th><th scope="col">Rate</th><th scope="col">Tax</th></tr></thead>
          <tbody>
            {g.steps.map((x, i) => (
              <tr key={i}><th scope="row">{stepLabel(x)}</th><td>{money(x.base, 2)}</td><td>{pct(x.rate, 2)}</td><td>{money(x.tax, 2)}</td></tr>
            ))}
            <tr className="grand"><th scope="row">Total</th><td>{money(g.ggr, 2)}</td><td>{pct(g.effectiveRate, 2)}</td><td>{money(g.amount, 2)}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="footnote">
        {rule.kind === 'custom' && 'The custom rate replaces the schedule and any add-on. '}
        {(rule.kind === 'splitTiered' || rule.kind === 'splitFlat') && `Slots are ${pct(rule.slotShare, 0)} of GGR (input). `}
        {rule.kind === 'flat' && rule.source === 'handle' && `The tax is levied on handle: ${pct(rule.handleRate!, 2)} of handle ÷ ${pct(rule.hold!, 1)} hold = ${pct(rule.rate, 2)} of GGR. `}
        {rule.kind === 'flat' && rule.source === 'effective' && 'The state has no detailed schedule in the data; its blended effective rate applies. '}
        {r.stateTax?.lastVerified && `Schedule verified ${r.stateTax.lastVerified}. `}
      </p>
    </>
  );
}

function PayrollAndIncome({ fiscal }: { fiscal: Fiscal }) {
  const b = fiscal.basis;
  const fed = b.federalPayroll;
  const st = b.statePayroll;
  const perWorker = fiscal.incomeTaxMethod === 'per_worker';
  const hasSdi = EFFECTS.some((e) => b.effects[e].payroll.parts.sdi + b.effects[e].payroll.parts.pfml > 0);
  return (
    <>
      <h4>Payroll and income taxes</h4>
      <p className="table-title">Employer payroll taxes</p>
      <div className="table-wrap">
        <table className="coef-table">
          <thead>
            <tr>
              <th scope="col">Effect</th><th scope="col">Cash wages</th><th scope="col">Jobs</th><th scope="col">Average wage</th>
              <th scope="col">Social Security</th><th scope="col">Medicare</th><th scope="col">FUTA</th><th scope="col">State UI</th>
              {hasSdi && <th scope="col">SDI, PFML</th>}
            </tr>
          </thead>
          <tbody>
            {EFFECTS.map((e) => {
              const x = b.effects[e];
              const p = x.payroll.parts;
              return (
                <tr key={e}>
                  <th scope="row">{EFFECT_LABEL[e]}</th>
                  <td>{money(x.cashWages)}</td><td>{jobs(x.jobs)}</td><td>{usd(x.payroll.avgWage)}</td>
                  <td>{money(p.socialSecurity, 2)}</td><td>{money(p.medicare, 2)}</td><td>{money(p.futa, 2)}</td><td>{money(p.suta, 2)}</td>
                  {hasSdi && <td>{money(p.sdi + p.pfml, 2)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {perWorker && (<>
        <p className="table-title">Household income taxes, per worker at the average wage</p>
        <div className="table-wrap">
          <table className="coef-table">
            <thead>
              <tr>
                <th scope="col">Effect</th><th scope="col">Average wage</th><th scope="col">Federal per worker</th><th scope="col">State and local per worker</th>
                <th scope="col">Federal</th><th scope="col">State and local</th>
              </tr>
            </thead>
            <tbody>
              {EFFECTS.map((e) => {
                const x = b.effects[e].income;
                return (
                  <tr key={e}>
                    <th scope="row">{EFFECT_LABEL[e]}</th>
                    <td>{usd(x.avgWage)}</td><td>{usd(x.perWorker.federal)}</td><td>{usd(x.perWorker.state + x.perWorker.local)}</td>
                    <td>{money(x.federal, 2)}</td><td>{money(x.stateLocal, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>)}
      <ul className="steps">
        <li>Average wage = cash wages ÷ jobs; each job is treated as one worker at that wage.</li>
        <li>
          Employer payroll taxes per job: Social Security {pct(fed.fica_ss_rate, 1)} of the wage up to {usd(fed.fica_ss_wage_cap)}; Medicare {pct(fed.fica_medicare_rate, 2)} of
          all wages; FUTA {pct(fed.futa_rate, 1)} of the first {usd(fed.futa_wage_base)}
          {st?.suta_avg_rate && st.suta_wage_base ? `; state unemployment insurance ${pct(st.suta_avg_rate, 2)} (2024 average employer rate) of the first ${usd(st.suta_wage_base)}` : ''}
          {st?.sdi_employer_rate ? `; employer SDI ${pct(st.sdi_employer_rate, 2)} of wages` : ''}
          {st?.pfml_employer_rate ? `; employer paid leave ${pct(st.pfml_employer_rate, 2)} of wages` : ''}. Each is multiplied by the number of jobs.
        </li>
        {perWorker ? (
          <li>Income taxes: the tax a single filer with no dependents owes on the average wage under 2025 federal, state and typical local schedules (standard deduction, no credits), × jobs.</li>
        ) : (
          <li>Income taxes: the state&apos;s BEA ratio of personal current taxes to wages ({pct(st?.household_tax_ratio ?? 0, 1)}) × cash wages, with no federal/state split.</li>
        )}
      </ul>
    </>
  );
}

export function FiscalExplain({ r }: { r: ScenarioResult }) {
  const t = r.fiscal.basis.topi;
  return (
    <Explain>
      <GamingTaxSteps r={r} />
      <h4>Taxes on production and imports</h4>
      <p>
        The I-O model gives taxes on production per dollar of output for each industry (StateIO V002, the national intensity in every state): direct {money(t.modeledDirect, 2)},
        supplier {money(r.totals.topi.indirect, 2)}, induced {money(r.totals.topi.induced, 2)}.{' '}
        {t.replaced && t.tribal && <>The gaming enterprise&apos;s direct share, {money(t.gamingStreamTopi, 2)}, is removed: tribal gaming on trust land pays the compact share instead of state and local taxes.</>}
        {t.replaced && !t.tribal && <>The gaming stream&apos;s direct share is {money(t.gamingStreamTopi, 2)}. Of that, {pct(1 - t.retainedShare)} is the national-average gaming tax that StateIO embeds; it is removed ({money(t.removed, 2)}) because the statutory gaming tax replaces it. The rest, {pct(t.retainedShare)}, is property taxes and licenses and is kept.</>}
        {!t.replaced && <>No gaming tax was computed, so the model value is kept in full.</>}
      </p>
      <PayrollAndIncome fiscal={r.fiscal} />
    </Explain>
  );
}

// ------------------------------------------------------------ industries

export function IndustriesExplain({ r, model, top }: { r: ScenarioResult; model: RegionalModel; top: number[] }) {
  const out = r.totals.rippleOutputByIndustry;
  const jobsBy = r.totals.rippleJobsByIndustry;
  const profiled = r.streams.some((s) => s.activity === 'gambling' || s.activity === 'online');
  return (
    <Explain>
      <p>Jobs in an industry = the output that supplier and household purchases require from it × {coef(r.deflator, 4)} (to 2023 dollars) × its jobs per $1M of output (2023 QCEW jobs ÷ 2023 StateIO output).</p>
      <div className="table-wrap">
        <table className="coef-table">
          <thead><tr><th scope="col">Industry</th><th scope="col">Output required</th><th scope="col">Jobs per $1M</th><th scope="col">Jobs</th></tr></thead>
          <tbody>
            {top.map((i) => (
              <tr key={i}>
                <th scope="row">{model.industries[i].name} <span className="muted">({model.industries[i].code})</span></th>
                <td>{money(out[i], 2)}</td><td>{coef(model.coefficients.jobs[i], 2)}</td><td>{jobs(jobsBy[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {profiled && (
        <p className="footnote">
          For gaming revenue, supplier and induced jobs scale with value added (×{coef(NATIONAL.gambling.increment.va)}) and output with output (×{coef(NATIONAL.gambling.increment.output)}),
          so its jobs differ from output × jobs per $1M by about {pct(NATIONAL.gambling.increment.va / NATIONAL.gambling.increment.output - 1, 0)}.
        </p>
      )}
    </Explain>
  );
}

// ------------------------------------------------------------ modules

export function NetExplain({ r }: { r: ScenarioResult }) {
  const n = r.analysis.netImpact;
  if (!r.net) return null;
  const a = Math.min(100, Math.max(0, n.nonResidentShare ?? 0)) / 100;
  const b = Math.min(100, Math.max(0, n.recaptureShare ?? 0)) / 100;
  return (
    <Explain>
      <p>
        Net share = visitors&apos; share + residents&apos; share × recaptured share = {pct(a)} + {pct(1 - a)} × {pct(b)} = {pct(r.net.share)}.
        Each gross figure is multiplied by the net share; e.g. net jobs = {jobs(r.totals.jobs.total)} × {coef(r.net.share)} = {jobs(r.net.totals.jobs.total)}.
        The rest of residents&apos; spending is assumed to move from other in-state businesses, so it adds nothing net. The I-O model is linear, so scaling is exact.
      </p>
    </Explain>
  );
}

export function ConstructionExplain({ r }: { r: ScenarioResult }) {
  const c = r.construction;
  if (!c) return null;
  const pm = c.impact.basis.perMillion;
  return (
    <Explain>
      <p>
        In-state spending = {money(c.cost)} × {pct(c.localSpend / c.cost, 0)} = {money(c.localSpend)}. It is final demand for the state&apos;s construction industry (23):
        GDP = {money(c.localSpend)} × {coef(pm.va.direct + pm.va.indirect + pm.va.induced)} = {money(c.impact.gdp.total)};
        jobs = {money(c.localSpend)} × {coef(c.impact.basis.deflator, 4)} × {coef(pm.jobs.direct + pm.jobs.indirect + pm.jobs.induced, 2)} per $1M = {jobs(c.impact.jobs.total)} job-years,
        or {jobs(c.annualJobs)} jobs a year over {c.years} {c.years === 1 ? 'year' : 'years'}. Taxes follow the same rules as operations, without a gaming tax.
      </p>
    </Explain>
  );
}
