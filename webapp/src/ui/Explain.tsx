/**
 * "How the model calculates this" panels. Each panel reads the basis the engine
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

export function Explain({ title = 'How the model calculates this', children }: { title?: string; children: ReactNode }) {
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
    <Explain title="What these values measure">
      <dl className="defs">
        <dt>Direct, supplier, induced</dt>
        <dd>
          Direct effects are the activity of the property. Supplier (indirect) effects are the production in the state that its purchases cause, through all rounds
          of the supply chain. Induced effects are the production in the state that households buy with labor income from the direct and supplier rounds. The totals add
          the three effects.
        </dd>
        <dt>Jobs supported</dt>
        <dd>Annual average filled jobs, full time and part time, as in QCEW. A person with two jobs counts two times. The model calculates full-time equivalents separately, with BEA ratios of FTEs to jobs.</dd>
        <dt>GDP (value added)</dt>
        <dd>Labor income, plus taxes on production and imports, plus gross operating surplus. GDP does not include purchased inputs. As a result, it does not count a value two times across rounds.</dd>
        <dt>Labor income</dt>
        <dd>BEA employee compensation: wages and salaries, with the BEA value for tips that are not reported, plus benefits and employer contributions for social insurance. Taxes use cash wages, which are less (see Tax revenue).</dd>
        <dt>Output</dt>
        <dd>The value of the production of all industries in the calculation. Output includes purchased inputs. As a result, it counts the same inputs at each round and is larger than GDP.</dd>
        <dt>Tax revenue</dt>
        <dd>The total of the tax lines below. The statutory gaming tax replaces the gaming part of the taxes on production in the model. As a result, the model does not count a tax two times.</dd>
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
  const gamb = `Gambling (7132) coefficients start from the response of the state industry 713 (amusement, gambling and recreation). The model multiplies this response by national USEEIO 713200 ratios. For direct effects, the ratios are: GDP ×${coef(g.direct.va)}, labor income ×${coef(g.direct.compensation)}, taxes on production ×${coef(g.direct.topi)}, jobs ×${coef(g.direct.jobs)}. For supplier and induced effects, they are: output ×${coef(g.increment.output)}; GDP, jobs and FTEs ×${coef(g.increment.va)}; labor income ×${coef(g.increment.compensation)}.`;
  if (s.activity === 'gambling') return gamb;
  if (s.activity === 'online') {
    return `${gamb} Online coefficients then use operator ratios. Direct effects: GDP ×${coef(o.direct.va, 2)}, labor income ×${coef(o.direct.compensation, 2)}, jobs ×${coef(o.direct.jobsPerVa * o.direct.va, 3)}. Supplier and induced effects: output and GDP ×${coef(o.increment.va, 2)}, labor income ×${coef(o.increment.compensation, 2)}. Direct FTEs use the FTE/job ratio of computer systems design (5415).`;
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
          <strong>Coefficients.</strong> Direct coefficients are the ratios of the industry to its output. They come from StateIO 2019 value added (V001–V003)
          and compensation (V001), and from 2023 QCEW jobs per dollar of 2023 output. A supplier coefficient adds the ratio of each industry, multiplied by the
          output that $1 of sales causes in that industry. The Leontief inverse, (I − A)⁻¹, gives this output, without the first $1. An induced coefficient uses
          the Type II inverse, which includes households, minus the Type I value.
          {profile && <> {profile}</>}
        </li>
        <li>
          <strong>Dollar effects.</strong> Output, GDP and labor income are revenue multiplied by the coefficient. Direct GDP = {money(b.revenue)} × {coef(pm.va.direct)} = {money(imp.gdp.direct)}.
          Supplier GDP = {money(b.revenue)} × {coef(pm.va.indirect)} = {money(imp.gdp.indirect)}.
        </li>
        <li>
          <strong>Jobs.</strong> Because the jobs coefficients are for 2023 output, the model first changes revenue to 2023 dollars. {money(b.revenue)} × {coef(b.deflator, 4)}{' '}
          (CPI-U {CPI[CPI_BASE_YEAR]} for {CPI_BASE_YEAR} ÷ {CPI[r.dollarYear]} for {r.dollarYear}) = {money(rev2023)} in {CPI_BASE_YEAR} dollars.{' '}
          {imp.sources.jobs === 'user'
            ? <>Direct jobs are observed: {jobs(b.knownJobs)}. Direct FTEs = {jobs(b.knownJobs)} × {coef(b.directFtePerJob)} FTE per job = {jobs(imp.fte.direct)}.</>
            : <>Direct jobs = {money(rev2023)} × {coef(pm.jobs.direct, 2)} per $1M = {jobs(imp.jobs.direct)}.</>}
          {' '}Supplier jobs = {money(rev2023)} × {coef(pm.jobs.indirect, 2)} = {jobs(imp.jobs.indirect)}.
        </li>
        {imp.sources.compensation === 'adjusted' && r.payrollAdjustment && (
          <li>
            <strong>Gaming-tax adjustment.</strong> Direct labor income = {money(b.revenue)} × {coef(pm.compensation.direct)} × exp(−{PAYROLL_ADJUSTMENT.slope} × {coef(r.payrollAdjustment.rate, 4)})
            = {money(imp.compensationAdjustment!.modelDirect)} × {coef(b.compensationFactor)} = {money(imp.compensation.direct)}. The rate is
            {r.payrollAdjustment.rateSource === 'computed' ? ' the effective gaming tax rate below' : r.payrollAdjustment.rateSource === 'custom' ? ' the custom rate that you entered' : ' the blended effective rate of the state, because you entered no GGR'}.
          </li>
        )}
        {imp.sources.compensation === 'user' && (
          <li>
            <strong>Observed wages.</strong> Direct labor income = observed cash wages {money(b.knownWages)} ÷ {coef(b.cashShare.direct)} = {money(imp.compensation.direct)}.
            The divisor is the ratio of QCEW wages to BEA compensation for this industry.
          </li>
        )}
        {imp.inducedScale !== 1 && (
          <li>
            <strong>Induced effects.</strong> Household purchases change with labor income. Direct and supplier labor income is {money(typeI)}, not the model value
            of {money(modelTypeI)}. As a result, the model multiplies each induced coefficient by {coef(imp.inducedScale, 4)} (marked *).
          </li>
        )}
        <li>
          <strong>Cash wages</strong> (the tax base) = labor income × {coef(b.cashShare.direct)} for direct effects and × {coef(b.cashShare.ripple)} for supplier and
          induced effects. These are the ratios of 2023 QCEW private wages to BEA compensation, for this industry and for all private industries. Direct cash
          wages: {money(imp.cashWages.direct)}.
        </li>
        {imp.jobsRange && b.jobsRangeRatios && (
          <li>
            <strong>Jobs range.</strong> 90% range of direct jobs = {jobs(imp.jobs.direct)} × {coef(b.jobsRangeRatios.p05, 3)} to {jobs(imp.jobs.direct)} × {coef(b.jobsRangeRatios.p95, 3)}
            = {jobs(imp.jobsRange.direct[0])} to {jobs(imp.jobsRange.direct[1])}. The factors are the 5th and 95th percentiles of the ratio of 2022 Economic Census
            jobs to model jobs per revenue dollar.{range ? ` The comparison uses ${range.n} states for this property type (${range.label.toLowerCase()}).` : ''} The model
            adds supplier and induced jobs without change.
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
      <p>Each value in the table is revenue multiplied by a coefficient for the industry that gets the revenue. The table adds the values for all revenue streams.</p>
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
        {rule.kind === 'custom' && 'The custom rate replaces the schedule and all add-on taxes. '}
        {(rule.kind === 'splitTiered' || rule.kind === 'splitFlat') && `Slots are ${pct(rule.slotShare, 0)} of GGR (your input). `}
        {rule.kind === 'flat' && rule.source === 'handle' && `The tax is on the handle: ${pct(rule.handleRate!, 2)} of handle ÷ ${pct(rule.hold!, 1)} hold = ${pct(rule.rate, 2)} of GGR. `}
        {rule.kind === 'flat' && rule.source === 'effective' && 'The data has no detailed schedule for this state. The model uses the blended effective rate of the state. '}
        {r.stateTax?.lastVerified && `Schedule checked on ${r.stateTax.lastVerified}. `}
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
        <p className="table-title">Household income taxes, for each worker at the average wage</p>
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
        <li>Average wage = cash wages ÷ jobs. The model counts each job as one worker at that wage.</li>
        <li>
          Employer payroll taxes for each job:
          <ul>
            <li>Social Security: {pct(fed.fica_ss_rate, 1)} of the wage, to a maximum of {usd(fed.fica_ss_wage_cap)}.</li>
            <li>Medicare: {pct(fed.fica_medicare_rate, 2)} of all wages.</li>
            <li>FUTA: {pct(fed.futa_rate, 1)} of the first {usd(fed.futa_wage_base)}.</li>
            {st?.suta_avg_rate && st.suta_wage_base ? <li>State unemployment insurance: {pct(st.suta_avg_rate, 2)} of the first {usd(st.suta_wage_base)} (2024 average employer rate).</li> : null}
            {st?.sdi_employer_rate ? <li>Employer SDI: {pct(st.sdi_employer_rate, 2)} of wages.</li> : null}
            {st?.pfml_employer_rate ? <li>Employer paid leave: {pct(st.pfml_employer_rate, 2)} of wages.</li> : null}
          </ul>
          The model multiplies each tax by the number of jobs.
        </li>
        {perWorker ? (
          <li>
            Income taxes: the tax on the average wage for a single filer with no dependents, multiplied by jobs. The model uses 2025 federal, state and typical
            local schedules, with the standard deduction and no credits.
          </li>
        ) : (
          <li>
            Income taxes: the BEA ratio of personal current taxes to wages for the state ({pct(st?.household_tax_ratio ?? 0, 1)}), multiplied by cash wages. This
            method gives no split between federal and state taxes.
          </li>
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
        The I-O model gives taxes on production per dollar of output for each industry. The values come from StateIO V002, which uses the same national ratio in
        each state. Direct: {money(t.modeledDirect, 2)}. Supplier: {money(r.totals.topi.indirect, 2)}. Induced: {money(r.totals.topi.induced, 2)}.{' '}
        {t.replaced && t.tribal && <>The model removes the direct part for the gaming enterprise, {money(t.gamingStreamTopi, 2)}. Tribal gaming on trust land pays the compact share and not state and local taxes.</>}
        {t.replaced && !t.tribal && <>The direct part for the gaming stream is {money(t.gamingStreamTopi, 2)}. Of this, {pct(1 - t.retainedShare)} is the national average gaming tax in StateIO. The model removes this part ({money(t.removed, 2)}), because the statutory gaming tax replaces it. The model keeps the other {pct(t.retainedShare)}: property taxes and licenses.</>}
        {!t.replaced && <>Because the model calculated no gaming tax, it keeps all of this value.</>}
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
      <p>
        Jobs in an industry = output × {coef(r.deflator, 4)} × jobs per $1M of output. The output is the output that supplier and household purchases cause in
        that industry. The factor {coef(r.deflator, 4)} changes this output to 2023 dollars. Jobs per $1M of output = 2023 QCEW jobs ÷ 2023 StateIO output.
      </p>
      <div className="table-wrap">
        <table className="coef-table">
          <thead><tr><th scope="col">Industry</th><th scope="col">Output</th><th scope="col">Jobs per $1M</th><th scope="col">Jobs</th></tr></thead>
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
          For gaming revenue, supplier and induced jobs change with value added (×{coef(NATIONAL.gambling.increment.va)}), and output changes with output
          (×{coef(NATIONAL.gambling.increment.output)}). As a result, these jobs are approximately {pct(NATIONAL.gambling.increment.va / NATIONAL.gambling.increment.output - 1, 0)} different
          from output × jobs per $1M.
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
        Net share = visitors&apos; share + residents&apos; share × share that moves back from other states = {pct(a)} + {pct(1 - a)} × {pct(b)} = {pct(r.net.share)}.
        The model multiplies each gross value by the net share. For example, net jobs = {jobs(r.totals.jobs.total)} × {coef(r.net.share)} = {jobs(r.net.totals.jobs.total)}.
        All other resident purchases move from businesses in the state and give no net effect. Because the I-O model is linear, this calculation is exact.
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
        In-state purchases = {money(c.cost)} × {pct(c.localSpend / c.cost, 0)} = {money(c.localSpend)}. These purchases are final demand for the construction
        industry (23) of the state. GDP = {money(c.localSpend)} × {coef(pm.va.direct + pm.va.indirect + pm.va.induced)} = {money(c.impact.gdp.total)}.
        Jobs = {money(c.localSpend)} × {coef(c.impact.basis.deflator, 4)} × {coef(pm.jobs.direct + pm.jobs.indirect + pm.jobs.induced, 2)} per $1M = {jobs(c.impact.jobs.total)} job-years,
        or {jobs(c.annualJobs)} jobs each year during {c.years} {c.years === 1 ? 'year' : 'years'}. Taxes use the same rules as for operations, but with no gaming tax.
      </p>
    </Explain>
  );
}
