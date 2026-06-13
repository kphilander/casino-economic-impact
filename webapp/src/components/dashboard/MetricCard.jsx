import React, { useState, useEffect, useRef } from 'react';
import { EFFECT, NAVY, ACCENT, MUTED } from '../../theme';

function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target == null || isNaN(target)) return;
    const from = prevTarget.current;
    prevTarget.current = target;
    let start = null;
    let raf;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

const ACCENT_COLORS = {
  primary: NAVY,
  success: ACCENT,
  purple: '#2c5282',
  amber: EFFECT.indirect,
};

/**
 * Report-grade metric card: hairline border, a thin left navy rule, an
 * uppercase micro-label, and a serif display figure for the headline number.
 */
export default function MetricCard({ icon: Icon, label, rawValue, formatter, subtext, color = 'primary' }) {
  const animatedValue = useCountUp(rawValue);
  const accent = ACCENT_COLORS[color] || NAVY;

  return (
    <div className="relative bg-white rounded-card border border-hairline px-5 py-4 shadow-card transition-all hover:border-[#d4dae3]">
      <div className="absolute top-4 bottom-4 left-0 w-[3px] rounded-r" style={{ background: accent }} />
      <div className="flex items-start gap-3 pl-2">
        {Icon && (
          <div className="mt-0.5 text-text-faint flex-shrink-0" style={{ color: accent }}>
            <Icon size={18} strokeWidth={1.75} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] text-text-faint font-semibold uppercase tracking-[0.08em]">{label}</p>
          <p className="font-display text-[1.6rem] font-semibold text-ink mt-0.5 leading-none tabular-nums">
            {formatter ? formatter(animatedValue) : animatedValue.toFixed(1)}
          </p>
          {subtext && <p className="text-xs text-text-muted mt-1.5">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}
