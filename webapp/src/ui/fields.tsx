import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

/**
 * Field help behind a small "i" button, so the inputs column stays short.
 * Screen readers always get the text through aria-describedby. A pinned hint
 * (a warning that changes how the input is used) is always visible.
 */
function useHint(hint: string | undefined, pinned: boolean | undefined) {
  const hintId = useId();
  const [open, setOpen] = useState(false);
  if (!hint) return { toggle: null, text: null, describedBy: undefined };
  const shown = !!pinned || open;
  const toggle = pinned ? null : (
    <button type="button" className="info" aria-expanded={open} aria-controls={hintId}
      aria-label={open ? 'Hide the note' : 'Show the note'} title={open ? 'Hide the note' : 'Show the note'}
      onClick={() => setOpen((o) => !o)}>i</button>
  );
  const text = <p className="hint" id={hintId} hidden={!shown}>{hint}</p>;
  return { toggle, text, describedBy: hintId };
}

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
  /** Keep the hint visible instead of behind the "i" button. */
  pinHint?: boolean;
}) {
  const id = useId();
  const help = useHint(props.hint, props.pinHint);
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
      <div className="label-row"><label htmlFor={id}>{props.label}</label>{help.toggle}</div>
      <div className="input-wrap">
        <input
          id={id}
          aria-describedby={help.describedBy}
          type="number"
          inputMode="decimal"
          value={text}
          min={props.min}
          max={props.max}
          step={props.step ?? 'any'}
          placeholder={props.placeholder}
          // Select the value so a new number replaces it, and stop the mouse
          // wheel from changing a focused field while the page scrolls.
          onFocus={(e) => e.currentTarget.select()}
          onWheel={(e) => e.currentTarget.blur()}
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
      {help.text}
    </div>
  );
}

export function SelectField<T extends string | number>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
  pinHint?: boolean;
}) {
  const id = useId();
  const help = useHint(props.hint, props.pinHint);
  return (
    <div className="field">
      <div className="label-row"><label htmlFor={id}>{props.label}</label>{help.toggle}</div>
      <select
        id={id}
        aria-describedby={help.describedBy}
        value={String(props.value)}
        onChange={(e) => {
          const o = props.options.find((x) => String(x.value) === e.target.value);
          if (o) props.onChange(o.value);
        }}
      >
        {props.options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
      {help.text}
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
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = props.options.length;
  // Radio-group keyboard behavior: one tab stop, arrow keys move the selection.
  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + n) % n;
    props.onChange(props.options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className="field">
      <span className="label" id={id}>{props.label}</span>
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        {props.options.map((o, i) => (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={props.value === o.value}
            tabIndex={props.value === o.value ? 0 : -1}
            className={props.value === o.value ? 'on' : ''}
            onClick={() => props.onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
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
