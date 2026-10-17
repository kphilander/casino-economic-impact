import { STATES } from '../engine/data';
import { CPI_YEARS, LATEST_CPI_YEAR } from '../engine/prices';
import {
  DEPARTMENTS, DEPARTMENT_LABELS, GAMING_TAX, PROPERTY_TYPES, isOnline,
  type Analysis, type Department, type PropertyType, type ScenarioResult,
} from '../engine/scenario';
import { hasGamingTax, taxRule, verticalSchedule, type GamingVertical } from '../engine/tax';
import { NumberField, Section, Segmented, SelectField, TextField, Toggle } from './fields';
import { money, pct } from './format';

type Update = (f: (a: Analysis) => Analysis) => void;

const DEPARTMENT_HINTS: Record<Department, string> = {
  gaming: 'Gambling industries (7132); taxed under the state schedule.',
  food: 'Food services and drinking places (722).',
  lodging: 'Accommodation (721).',
  other: 'Performing arts, spectator sports, museums (711AS).',
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

  return (
    <div className="inputs">
      <Section title="Property">
        <SelectField label="State" value={a.state} options={STATES.map((s) => ({ value: s.name, label: s.name }))} onChange={(s) => set('state', s)}
          hint="Selects the state's input-output tables, gaming tax schedule and payroll and income tax rules." />
        <TextField label="Property name (optional)" value={a.name} onChange={(s) => set('name', s)} placeholder="e.g. Riverside Casino" />
        <SelectField
          label="Property type"
          value={a.propertyType}
          options={(Object.keys(PROPERTY_TYPES) as PropertyType[]).map((k) => ({ value: k, label: PROPERTY_TYPES[k].label }))}
          onChange={(pt) => update((x) => ({ ...x, propertyType: pt, inputMode: isOnline(pt) ? 'department' : x.inputMode }))}
          hint={online
            ? 'Online GGR uses the gambling coefficients with operator ratios and the state’s online tax schedule.'
            : 'Gaming revenue of every land-based type uses the gambling (7132) coefficients. The type selects the direct-jobs range.'}
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
          <p className="hint">No state gaming tax and no taxes on production for the gaming enterprise; the compact revenue share is entered below.</p>
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
            hint="All revenue is modeled as gambling industry output. Gaming tax needs GGR: enter revenue by department to compute it." />
        ) : (
          DEPARTMENTS.map((d) => (
            <NumberField key={d} label={DEPARTMENT_LABELS[d]} unit="$M" min={0} value={a.revenue[d]} onChange={(n) => setRevenue(d, n)}
              hint={DEPARTMENT_HINTS[d]} />
          ))
        )}
        <SelectField
          label="Dollar year of revenue"
          value={a.dollarYear ?? LATEST_CPI_YEAR}
          options={CPI_YEARS.map((y) => ({ value: y, label: y === LATEST_CPI_YEAR ? `${y} (latest CPI year)` : String(y) }))}
          onChange={(y) => set('dollarYear', y)}
          hint="Revenue is converted to 2023 dollars (CPI-U) before jobs are estimated."
        />
      </Section>

      <Section title={tribal ? 'Compact revenue sharing' : 'Gaming tax'}>
        {tribal ? (
          <p className="note">Tribal gaming pays no state gaming tax. Enter the compact&apos;s revenue share of GGR, if any.</p>
        ) : hasGamingTax(stateTax, v) && schedule ? (
          <p className="note">{schedule.description ?? 'Statutory schedule.'}</p>
        ) : (
          <p className="note">{a.state} has no {v === 'land' ? 'commercial casino' : v === 'igaming' ? 'iGaming' : 'sports betting'} tax schedule. Enter a rate to model one.</p>
        )}
        {a.inputMode === 'total' && !online && (
          <p className="note">With total revenue only, no {tribal ? 'revenue share' : 'gaming tax'} is computed. A rate entered here still sets the gaming-tax adjustment of direct labor income.</p>
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
            hint="Slots and table games are taxed on separate schedules in this state." />
        )}
        {result?.gamingTax && (
          <p className="computed">{money(result.gamingTax.amount)} a year: {pct(result.gamingTax.effectiveRate)} of {money(result.gamingTax.ggr)} GGR</p>
        )}
      </Section>

      <Section title="Observed operating data" collapsible badge={knownCount ? `${knownCount} entered` : undefined}>
        <p className="note">
          Observed direct jobs and cash wages (W-2 payroll) replace the model&apos;s direct values. Supplier jobs are unchanged; induced effects follow the change in labor income.
          {a.inputMode === 'total' && !online ? ' With total revenue, entries are summed across departments.' : ''}
        </p>
        <p className="hint">Jobs: annual average filled jobs. Cash wages: payroll wages, the QCEW basis; they are divided by the industry&apos;s QCEW-to-BEA wage ratio to give labor income.</p>
        {departments.map((d) => (
          <div className="pair" key={d}>
            <span className="pair-label">{online ? 'Operations' : DEPARTMENT_LABELS[d]}</span>
            <NumberField label="Jobs" min={0} value={a.known[d].jobs} onChange={(n) => setKnown(d, 'jobs', n)} />
            <NumberField label="Cash wages" unit="$M" min={0} value={a.known[d].wages} onChange={(n) => setKnown(d, 'wages', n)} />
          </div>
        ))}
      </Section>

      <Section title="Net new impact" collapsible badge={a.netImpact.enabled ? 'on' : undefined}>
        <Toggle label="Report net new impact" checked={a.netImpact.enabled} onChange={(e) => set('netImpact', { ...a.netImpact, enabled: e })} />
        <p className="note">Net impact counts revenue from visitors and resident play that would otherwise leave the state. The rest displaces in-state spending.</p>
        {a.netImpact.enabled && (
          <>
            <NumberField label="Out-of-state visitors' share of revenue" unit="%" min={0} max={100} value={a.netImpact.nonResidentShare}
              onChange={(n) => set('netImpact', { ...a.netImpact, nonResidentShare: n })} />
            <NumberField label="Resident play recaptured from other states" unit="%" min={0} max={100} value={a.netImpact.recaptureShare}
              onChange={(n) => set('netImpact', { ...a.netImpact, recaptureShare: n ?? 0 })} />
          </>
        )}
      </Section>

      <Section title="Construction phase" collapsible badge={a.construction.enabled ? 'on' : undefined}>
        <Toggle label="Include a one-time construction phase" checked={a.construction.enabled} onChange={(e) => set('construction', { ...a.construction, enabled: e })} />
        {a.construction.enabled && (
          <>
            <NumberField label="Construction cost" unit="$M" min={0} value={a.construction.cost} onChange={(n) => set('construction', { ...a.construction, cost: n })} />
            <NumberField label="Spent with in-state firms" unit="%" min={0} max={100} value={a.construction.localShare}
              onChange={(n) => set('construction', { ...a.construction, localShare: n ?? 0 })}
              hint="Exclude land, gaming equipment and purchases from out-of-state firms. Only this share enters the model." />
            <NumberField label="Build period" unit="years" min={1} step={1} value={a.construction.years}
              onChange={(n) => set('construction', { ...a.construction, years: n ?? 1 })}
              hint="Job-years are divided by the build period to give jobs a year." />
          </>
        )}
      </Section>
    </div>
  );
}
