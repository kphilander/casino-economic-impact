import { useState } from 'react';
import { STATES } from '../engine/data';
import { CPI_YEARS, LATEST_CPI_YEAR } from '../engine/prices';
import {
  DEPARTMENTS, DEPARTMENT_LABELS, GAMING_TAX, PROPERTY_TYPES, defaultAnalysis, isOnline,
  type Analysis, type Department, type PropertyType, type ScenarioResult,
} from '../engine/scenario';
import { hasGamingTax, taxRule, verticalSchedule, type GamingVertical } from '../engine/tax';
import { NumberField, Section, Segmented, SelectField, TextField, Toggle } from './fields';
import { money, pct } from './format';

type Update = (f: (a: Analysis) => Analysis) => void;

const DEPARTMENT_HINTS: Record<Department, string> = {
  gaming: 'Gambling industries (7132). The state gaming tax is on this revenue.',
  food: 'Food services and drinking places (722).',
  lodging: 'Accommodation (721).',
  other: 'Performing arts, spectator sports and museums (711AS).',
};

const vertical = (pt: PropertyType): GamingVertical =>
  pt === 'ONLINE_CASINO' ? 'igaming' : pt === 'ONLINE_SPORTSBOOK' ? 'sports' : 'land';

export function InputsPanel({ analysis: a, update, result }: { analysis: Analysis; update: Update; result: ScenarioResult | null }) {
  const online = isOnline(a.propertyType);
  const tribal = a.ownership === 'tribal' && !online;
  const v = vertical(a.propertyType);
  const stateTax = GAMING_TAX.rates[a.state];
  const schedule = verticalSchedule(stateTax, v);
  const statutory = taxRule(schedule, null, a.gamingTax.slotSharePct);
  const split = !tribal && a.gamingTax.customRate == null && (statutory.kind === 'splitTiered' || statutory.kind === 'splitFlat');
  const set = <K extends keyof Analysis>(k: K, val: Analysis[K]) => update((x) => ({ ...x, [k]: val }));
  const setRevenue = (k: Department | 'total', val: number | null) => update((x) => ({ ...x, revenue: { ...x.revenue, [k]: val } }));
  const setKnown = (d: Department, k: 'jobs' | 'wages', val: number | null) =>
    update((x) => ({ ...x, known: { ...x.known, [d]: { ...x.known[d], [k]: val } } }));
  const knownCount = DEPARTMENTS.filter((d) => a.known[d].jobs != null || a.known[d].wages != null).length;
  const departments: readonly Department[] = online ? ['gaming'] : DEPARTMENTS;
  const revenueTotal = DEPARTMENTS.reduce((s, d) => s + (a.revenue[d] ?? 0), 0);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="inputs">
      <Section title="Property">
        <SelectField label="State" value={a.state} options={STATES.map((s) => ({ value: s.name, label: s.name }))} onChange={(s) => set('state', s)}
          hint="The model uses the input-output tables, gaming tax schedule and tax rules of this state." />
        <TextField label="Property name" value={a.name} onChange={(s) => set('name', s)} placeholder="For example, Riverside Casino" />
        <SelectField
          label="Property type"
          value={a.propertyType}
          options={(Object.keys(PROPERTY_TYPES) as PropertyType[]).map((k) => ({ value: k, label: PROPERTY_TYPES[k].label }))}
          onChange={(pt) => update((x) => ({ ...x, propertyType: pt, inputMode: isOnline(pt) ? 'department' : x.inputMode }))}
          hint={online
            ? 'For online GGR, the model uses the gambling coefficients with operator ratios. It also uses the online tax schedule of the state.'
            : 'All land-based types use the gambling (7132) coefficients for gaming revenue. The property type controls the range for direct jobs.'}
        />
        {!online && (
          <Segmented
            label="Ownership"
            value={a.ownership}
            options={[{ value: 'commercial', label: 'Commercial' }, { value: 'tribal', label: 'Tribal' }]}
            onChange={(o) => set('ownership', o)}
          />
        )}
        {tribal && (
          <p className="hint">Tribal gaming pays no state gaming tax. The model includes no taxes on production for the gaming enterprise. Enter the compact revenue share below.</p>
        )}
      </Section>

      <Section title="Annual revenue">
        {!online && (
          <Segmented
            label="Revenue detail"
            value={a.inputMode}
            options={[{ value: 'department', label: 'By department' }, { value: 'total', label: 'Total only' }]}
            onChange={(m) => set('inputMode', m)}
          />
        )}
        {online ? (
          <NumberField label={a.propertyType === 'ONLINE_SPORTSBOOK' ? 'Sports betting GGR' : 'Online casino GGR'} unit="$M" min={0}
            value={a.inputMode === 'total' ? a.revenue.total : a.revenue.gaming}
            onChange={(n) => setRevenue(a.inputMode === 'total' ? 'total' : 'gaming', n)} />
        ) : a.inputMode === 'total' ? (
          <NumberField label="Total operating revenue" unit="$M" min={0} value={a.revenue.total} onChange={(n) => setRevenue('total', n)}
            hint="The model uses the gambling coefficients for all of this revenue and calculates no gaming tax. To get the gaming tax, enter revenue by department." pinHint />
        ) : (
          <>
            {DEPARTMENTS.map((d) => (
              <NumberField key={d} label={DEPARTMENT_LABELS[d]} unit="$M" min={0} value={a.revenue[d]} onChange={(n) => setRevenue(d, n)}
                hint={DEPARTMENT_HINTS[d]} />
            ))}
            {revenueTotal > 0 && <p className="computed">Total revenue: {money(revenueTotal)}</p>}
          </>
        )}
        <SelectField
          label="Dollar year of revenue"
          value={a.dollarYear ?? LATEST_CPI_YEAR}
          options={CPI_YEARS.map((y) => ({ value: y, label: y === LATEST_CPI_YEAR ? `${y} (latest CPI year)` : String(y) }))}
          onChange={(y) => set('dollarYear', y)}
          hint="The model changes revenue to 2023 dollars (CPI-U) before it calculates jobs."
        />
      </Section>

      <Section title={tribal ? 'Compact revenue share' : 'Gaming tax'}>
        {tribal ? (
          <p className="note">Tribal gaming pays no state gaming tax. If the compact has a revenue share, enter it as a percentage of GGR.</p>
        ) : hasGamingTax(stateTax, v) && schedule ? (
          <p className="note">{schedule.description ?? 'Statutory schedule.'}</p>
        ) : (
          <p className="note">{a.state} has no {v === 'land' ? 'commercial casino' : v === 'igaming' ? 'iGaming' : 'sports betting'} tax schedule. To calculate a tax, enter a rate.</p>
        )}
        {a.inputMode === 'total' && !online && (
          <p className="note">With total revenue only, the model calculates no {tribal ? 'revenue share' : 'gaming tax'}. A rate that you enter here changes only the gaming-tax adjustment of direct labor income.</p>
        )}
        <NumberField
          label={tribal ? 'Revenue share' : 'Custom rate (replaces the schedule)'}
          unit="% of GGR" percent min={0} max={100}
          value={a.gamingTax.customRate}
          onChange={(r) => set('gamingTax', { ...a.gamingTax, customRate: r })}
          placeholder={tribal ? 'none' : 'statutory'}
        />
        {split && (
          <NumberField label="Slot share of GGR" unit="%" min={0} max={100} value={a.gamingTax.slotSharePct}
            onChange={(n) => set('gamingTax', { ...a.gamingTax, slotSharePct: n ?? 70 })}
            hint="This state has separate tax schedules for slots and table games." />
        )}
        {result?.gamingTax && (
          <p className="computed">{money(result.gamingTax.amount)} each year: {pct(result.gamingTax.effectiveRate)} of {money(result.gamingTax.ggr)} GGR</p>
        )}
      </Section>

      <Section title="Observed jobs and wages" collapsible badge={knownCount ? `${knownCount} entered` : undefined}>
        <p className="note">
          Observed direct jobs and cash wages (W-2 payroll) replace the direct values of the model. Supplier jobs do not change. Induced effects change with labor income.
          {a.inputMode === 'total' && !online ? ' With total revenue, the model adds the values for all departments.' : ''}
        </p>
        <p className="hint">Jobs: annual average filled jobs. Cash wages: payroll wages, as in QCEW. The model divides cash wages by the QCEW-to-BEA wage ratio of the industry to get labor income.</p>
        {departments.map((d) => (
          <fieldset className="pair" key={d}>
            <legend className="pair-label">{online ? 'Operations' : DEPARTMENT_LABELS[d]}</legend>
            <NumberField label="Jobs" min={0} value={a.known[d].jobs} onChange={(n) => setKnown(d, 'jobs', n)} />
            <NumberField label="Cash wages" unit="$M" min={0} value={a.known[d].wages} onChange={(n) => setKnown(d, 'wages', n)} />
          </fieldset>
        ))}
      </Section>

      <Section title="Net new impact" collapsible badge={a.netImpact.enabled ? 'on' : undefined}>
        <Toggle label="Show net new impact" checked={a.netImpact.enabled} onChange={(e) => set('netImpact', { ...a.netImpact, enabled: e })} />
        <p className="note">
          Net impact counts only revenue that is new to the state. New revenue is revenue from visitors, plus resident play that moves back from casinos in other states.
          All other resident revenue moves from businesses in the state.
        </p>
        {a.netImpact.enabled && (
          <>
            <NumberField label="Visitors' share of revenue" unit="%" min={0} max={100} value={a.netImpact.nonResidentShare}
              onChange={(n) => set('netImpact', { ...a.netImpact, nonResidentShare: n })} />
            <NumberField label="Resident play that moves back from other states" unit="%" min={0} max={100} value={a.netImpact.recaptureShare}
              onChange={(n) => set('netImpact', { ...a.netImpact, recaptureShare: n ?? 0 })} />
          </>
        )}
      </Section>

      <Section title="Construction phase" collapsible badge={a.construction.enabled ? 'on' : undefined}>
        <Toggle label="Include a construction phase (one time)" checked={a.construction.enabled} onChange={(e) => set('construction', { ...a.construction, enabled: e })} />
        {a.construction.enabled && (
          <>
            <NumberField label="Construction cost" unit="$M" min={0} value={a.construction.cost} onChange={(n) => set('construction', { ...a.construction, cost: n })} />
            <NumberField label="Spent with in-state firms" unit="%" min={0} max={100} value={a.construction.localShare}
              onChange={(n) => set('construction', { ...a.construction, localShare: n ?? 0 })}
              hint="Do not include land, gaming equipment or purchases from firms in other states. The model uses only this share." />
            <NumberField label="Build period" unit="years" min={1} step={1} value={a.construction.years}
              onChange={(n) => set('construction', { ...a.construction, years: n ?? 1 })}
              hint="The model divides job-years by the build period to get jobs for each year." />
          </>
        )}
      </Section>

      <div className="reset">
        {confirmReset ? (
          <>
            <span>All inputs go back to the example values.</span>
            <button type="button" className="link danger" onClick={() => { update(() => defaultAnalysis()); setConfirmReset(false); }}>Confirm reset</button>
            <button type="button" className="link" onClick={() => setConfirmReset(false)}>Cancel</button>
          </>
        ) : (
          <button type="button" className="link" onClick={() => setConfirmReset(true)}>Reset all inputs</button>
        )}
      </div>
    </div>
  );
}
