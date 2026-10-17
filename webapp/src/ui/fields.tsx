import { useEffect, useId, useState, type ReactNode } from 'react';

/** Numeric input that keeps the typed text while editing; blank means null. */
export function NumberField(props: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** Display and edit a 0-1 value as a percentage. */
  percent?: boolean;
}) {
  const id = useId();
  const { value, percent } = props;
  const toText = (v: number | null) => (v == null ? '' : String(percent ? +(v * 100).toPrecision(10) : v));
  const [text, setText] = useState(toText(value));
  useEffect(() => {
    const parsed = text.trim() === '' ? null : Number(text);
    const current = parsed == null || !Number.isFinite(parsed) ? null : percent ? parsed / 100 : parsed;
    if (current !== value) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <div className="input-wrap">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          min={props.min}
          max={props.max}
          step={props.step ?? 'any'}
          placeholder={props.placeholder}
          onChange={(e) => {
            setText(e.target.value);
            const t = e.target.value.trim();
            if (t === '') { props.onChange(null); return; }
            const n = Number(t);
            if (Number.isFinite(n)) props.onChange(percent ? n / 100 : n);
          }}
        />
        {props.unit && <span className="unit">{props.unit}</span>}
      </div>
      {props.hint && <p className="hint">{props.hint}</p>}
    </div>
  );
}

export function SelectField<T extends string | number>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <select
        id={id}
        value={String(props.value)}
        onChange={(e) => {
          const o = props.options.find((x) => String(x.value) === e.target.value);
          if (o) props.onChange(o.value);
        }}
      >
        {props.options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
      {props.hint && <p className="hint">{props.hint}</p>}
    </div>
  );
}

export function TextField(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <input id={id} type="text" value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}

export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <span className="label" id={id}>{props.label}</span>
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={props.value === o.value}
            className={props.value === o.value ? 'on' : ''}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="toggle">
      <input id={id} type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <label htmlFor={id}>{props.label}</label>
    </div>
  );
}

export function Section(props: { title: string; children: ReactNode; collapsible?: boolean; defaultOpen?: boolean; badge?: string }) {
  if (!props.collapsible) {
    return (
      <section className="panel">
        <h2 className="panel-title">{props.title}</h2>
        {props.children}
      </section>
    );
  }
  return (
    <details className="panel" open={props.defaultOpen}>
      <summary className="panel-title">
        {props.title}
        {props.badge && <span className="badge">{props.badge}</span>}
      </summary>
      {props.children}
    </details>
  );
}
