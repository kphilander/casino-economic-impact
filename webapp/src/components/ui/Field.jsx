import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Refined input/select fields sharing the design-system `.field-input` styling
 * (hairline border, soft accent focus ring). These mirror the original
 * InputField / SelectField API so they can be swapped in throughout the app.
 */

export function InputField({ label, value, onChange, placeholder, helpText, type = 'number', prefix, suffix, id }) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const helpId = helpText ? `${inputId}-help` : undefined;

  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-text-secondary">{label}</label>}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">{prefix}</span>
        )}
        <input
          id={inputId}
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(type === 'number' ? (e.target.value ? parseFloat(e.target.value) : null) : e.target.value)}
          placeholder={placeholder}
          aria-describedby={helpId}
          className={`field-input px-3.5 py-2.5 text-text ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm" aria-hidden="true">{suffix}</span>
        )}
      </div>
      {helpText && <p id={helpId} className="text-xs text-text-muted leading-relaxed">{helpText}</p>}
    </div>
  );
}

export function SelectField({ label, value, onChange, options, helpText, id }) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const helpId = helpText ? `${selectId}-help` : undefined;

  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={selectId} className="block text-sm font-medium text-text-secondary">{label}</label>}
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={helpId}
          className="field-input px-3.5 py-2.5 text-text appearance-none bg-white pr-10"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={18} aria-hidden="true" />
      </div>
      {helpText && <p id={helpId} className="text-xs text-text-muted leading-relaxed">{helpText}</p>}
    </div>
  );
}

/**
 * Segmented toggle — replaces the paired bordered buttons used through the
 * wizard, with a flat, hairline-bordered track.
 */
export function SegmentedToggle({ options, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex p-1 bg-paper border border-hairline rounded-xl ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              active ? 'bg-white text-primary shadow-card border border-hairline' : 'text-text-muted hover:text-ink'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
