import { ACTIVITIES } from '../engine/activities';
import type { RegionalModel } from '../engine/io';
import type { Effects } from '../engine/impact';
import type { Fiscal } from '../engine/fiscal';
import { NON_GAMING_TOPI_SHARE, PROPERTY_TYPES, isOnline, type ScenarioResult } from '../engine/scenario';
import { jobs, money, pct, ratio } from './format';

const EFFECT_HEADS = ['Direct', 'Supplier', 'Induced', 'Total'] as const;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function Headline({ r }: { r: ScenarioResult }) {
  const t = r.totals;
  const range = t.jobsRange;
  return (
    <div className="headline">
      <Stat label="Jobs supported" value={jobs(t.jobs.total)}
        sub={range ? `90% range ${jobs(range.total[0])} to ${jobs(range.total[1])}` : `${jobs(t.jobs.direct)} direct`} />
      <Stat label="GDP (value added)" value={money(t.gdp.total)} sub={`${money(t.gdp.direct)} direct`} />
      <Stat label="Labor income" value={money(t.compensation.total)} sub="employee compensation" />
      <Stat label="Output" value={money(t.output.total)} sub={`multiplier ${ratio(t.output.total / t.output.direct)}`} />
      <Stat label="Tax revenue" value={money(r.fiscal.totals.all.total)}
        sub={`${money(r.fiscal.totals.stateLocal.total)} state and local`} />
    </div>
  );
}

function Notes({ r }: { r: ScenarioResult }) {
  const a = r.analysis;
  const notes: string[] = [];
  const online = isOnline(a.propertyType);
  const tribal = a.ownership === 'tribal' && !online;
  if (r.payrollAdjustment) {
    const p = r.payrollAdjustment;
    notes.push(`Direct labor income of gaming is ${pct(1 - p.factor)} below the unadjusted coefficient (${money(p.directChange)}) for the ${pct(p.rate)} gaming tax carried in revenue. The adjustment is estimated from the model's payroll share of casino revenue against the 2022 Economic Census; direct jobs and GDP are unchanged.`);
  }
  if (r.totals.jobsRange) {
    const d = r.totals.jobsRange.direct;
    const partial = r.streams.some((s) => !s.impact.jobsRange && s.impact.sources.jobs === 'model');
    notes.push(`Direct jobs: ${jobs(r.totals.jobs.direct)}, 90% predictive range ${jobs(d[0])} to ${jobs(d[1])}, from the state-by-state comparison of the coefficient with 2022 Economic Census jobs per revenue dollar.${partial ? ' The range covers gaming jobs; other departments enter at their point estimates.' : ''} Supplier and induced jobs are model estimates with no observed benchmark.`);
  }
  if (tribal) {
    notes.push('Tribal ownership: the compact revenue share, if any, replaces the gaming tax, and the gaming enterprise’s direct taxes on production are excluded (trust land). No jobs range is given: the Economic Census excludes most tribal casinos.');
  }
  if (online) {
    notes.push('Online operator coefficients are scenario ratios estimated from operator filings. Enter observed in-state jobs and wages where they are available.');
  }
  if (a.inputMode === 'total' && !online) {
    notes.push('Total revenue is modeled as gambling industry output, and no gaming tax is computed on it. Enter revenue by department to model lodging, food and other revenue with their own industries.');
  }
  const user = r.streams.filter((s) => s.impact.sources.jobs === 'user' || s.impact.sources.compensation === 'user');
  if (user.length) notes.push(`Observed jobs or wages replace modeled direct values for: ${user.map((s) => s.label.toLowerCase()).join(', ')}.`);
  if (!notes.length) return null;
  return <ul className="notes">{notes.map((n) => <li key={n}>{n}</li>)}</ul>;
}

function EffectCells({ e, fmt }: { e: Effects; fmt: (n: number) => string }) {
  return (
    <>
      <td>{fmt(e.direct)}</td>
      <td>{fmt(e.indirect)}</td>
      <td>{fmt(e.induced)}</td>
      <td className="total">{fmt(e.total)}</td>
    </>
  );
}

export function ImpactTable({ t }: { t: Pick<ScenarioResult['totals'], 'jobs' | 'fte' | 'compensation' | 'gdp' | 'output'> }) {
  const rows: [string, Effects, (n: number) => string][] = [
    ['Jobs', t.jobs, jobs],
    ['Full-time equivalents', t.fte, jobs],
    ['Labor income', t.compensation, money],
    ['GDP (value added)', t.gdp, money],
    ['Output', t.output, money],
  ];
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th scope="col">Impact</th>{EFFECT_HEADS.map((h) => <th scope="col" key={h}>{h}</th>)}<th scope="col">Multiplier</th></tr>
        </thead>
        <tbody>
          {rows.map(([label, e, fmt]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <EffectCells e={e} fmt={fmt} />
              <td className="muted">{e.direct > 0 ? ratio(e.total / e.direct) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Streams({ r }: { r: ScenarioResult }) {
  if (r.streams.length < 2) return null;
  return (
    <section className="card">
      <h3>By revenue stream</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">Stream</th><th scope="col">Revenue</th><th scope="col" className="left">Industry</th><th scope="col">Jobs</th><th scope="col">GDP</th><th scope="col">Labor income</th></tr></thead>
          <tbody>
            {r.streams.map((s) => (
              <tr key={s.key}>
                <th scope="row">{s.label}</th>
                <td>{money(s.revenue)}</td>
                <td className="muted left">{ACTIVITIES[s.activity].label} ({ACTIVITIES[s.activity].sector})</td>
                <td>{jobs(s.impact.jobs.total)}</td>
                <td>{money(s.impact.gdp.total)}</td>
                <td>{money(s.impact.compensation.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function FiscalTable({ fiscal, showGamingNote }: { fiscal: Fiscal; showGamingNote: boolean }) {
  const subtotal = (label: string, e: Effects, cls: string) => (
    <tr className={cls}><th scope="row">{label}</th><EffectCells e={e} fmt={money} /><td /></tr>
  );
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">Tax</th>{EFFECT_HEADS.map((h) => <th scope="col" key={h}>{h}</th>)}<th scope="col">Level</th></tr></thead>
          <tbody>
            {fiscal.lines.map((l) => (
              <tr key={l.key}>
                <th scope="row">{l.label}{l.note && <span className="row-note">{l.note}</span>}</th>
                <EffectCells e={l} fmt={money} />
                <td className="muted">{l.level === 'federal' ? 'Federal' : 'State and local'}</td>
              </tr>
            ))}
            {subtotal('State and local', fiscal.totals.stateLocal, 'subtotal')}
            {subtotal('Federal', fiscal.totals.federal, 'subtotal')}
            {subtotal('All taxes', fiscal.totals.all, 'grand')}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        {showGamingNote && `The gaming tax replaces the gaming share of the I-O model's direct taxes on production for the gaming stream; the remaining ${pct(NON_GAMING_TOPI_SHARE)} (property taxes and licenses) is kept. `}
        Payroll and income taxes apply to estimated cash wages: BEA compensation converted with QCEW-to-BEA wage ratios.
        {fiscal.incomeTaxMethod === 'per_worker' ? ' Income taxes treat each job as a single filer at the average wage, under 2025 federal, state and typical local schedules.' : ''}
      </p>
    </>
  );
}

function Industries({ r, model }: { r: ScenarioResult; model: RegionalModel }) {
  const v = r.totals.rippleJobsByIndustry;
  const total = v.reduce((s, x) => s + x, 0);
  if (!(total > 0)) return null;
  const top = Array.from(v, (jobsN, i) => ({ jobsN, name: model.industries[i].name, code: model.industries[i].code }))
    .sort((x, y) => y.jobsN - x.jobsN)
    .slice(0, 10);
  const max = top[0].jobsN;
  const profiled = r.streams.some((s) => s.activity === 'gambling' || s.activity === 'online');
  return (
    <section className="card">
      <h3>Supplier and induced jobs by industry</h3>
      <p className="card-sub">Top ten of {model.industries.length} industries in {r.analysis.state}; {jobs(total)} jobs in all.</p>
      <ol className="bars">
        {top.map((x) => (
          <li key={x.code}>
            <span className="bar-label">{x.name}</span>
            <span className="bar-track"><span className="bar" style={{ width: `${(100 * x.jobsN) / max}%` }} /></span>
            <span className="bar-value">{jobs(x.jobsN)}</span>
          </li>
        ))}
      </ol>
      {profiled && <p className="footnote">Gaming supply chains follow the StateIO amusement, gambling and recreation (713) pattern, scaled to the gambling detail industry.</p>}
    </section>
  );
}

function Net({ r }: { r: ScenarioResult }) {
  if (!r.net) return null;
  const t = r.net.totals;
  return (
    <section className="card">
      <h3>Net new impact</h3>
      <p className="card-sub">{pct(r.net.share)} of revenue is new to {r.analysis.state}. Fiscal lines above are gross.</p>
      <div className="mini-stats">
        <Stat label="Net jobs" value={jobs(t.jobs.total)} />
        <Stat label="Net GDP" value={money(t.gdp.total)} />
        <Stat label="Net labor income" value={money(t.compensation.total)} />
        <Stat label="Net output" value={money(t.output.total)} />
      </div>
    </section>
  );
}

function Construction({ r }: { r: ScenarioResult }) {
  const c = r.construction;
  if (!c) return null;
  return (
    <section className="card">
      <h3>Construction phase (one time)</h3>
      <p className="card-sub">{money(c.localSpend)} spent in-state of {money(c.cost)} over {c.years} {c.years === 1 ? 'year' : 'years'}. Jobs are job-years.</p>
      <div className="mini-stats">
        <Stat label="Job-years" value={jobs(c.impact.jobs.total)} sub={`${jobs(c.annualJobs)} per year`} />
        <Stat label="GDP" value={money(c.impact.gdp.total)} />
        <Stat label="Labor income" value={money(c.impact.compensation.total)} />
        <Stat label="Tax revenue" value={money(c.fiscal.totals.all.total)} />
      </div>
    </section>
  );
}

export function ResultsView({ r, model }: { r: ScenarioResult; model: RegionalModel }) {
  const a = r.analysis;
  const title = a.name.trim() || `${PROPERTY_TYPES[a.propertyType].label}, ${a.state}`;
  return (
    <div className="results">
      <div className="results-head">
        <h2>{title}</h2>
        <p>Annual impact in {a.state}, {r.dollarYear} dollars. Supplier effects are purchases from in-state industries; induced effects are household spending of labor income.</p>
      </div>
      <Headline r={r} />
      <Notes r={r} />
      <section className="card">
        <h3>Economic impact</h3>
        <ImpactTable t={r.totals} />
      </section>
      <Streams r={r} />
      <section className="card">
        <h3>Tax revenue</h3>
        <FiscalTable fiscal={r.fiscal} showGamingNote={!!r.gamingTax && !r.gamingTax.tribal} />
      </section>
      <Industries r={r} model={model} />
      <Net r={r} />
      <Construction r={r} />
    </div>
  );
}
