import React, { useState, useEffect, useRef } from 'react';

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
  primary: '#1a365d',
  success: '#3182ce',
  purple: '#2c5282',
  amber: '#4299e1'
};

const ICON_BG = {
  primary: 'bg-[#1a365d]/10 text-[#1a365d]',
  success: 'bg-[#3182ce]/10 text-[#3182ce]',
  purple: 'bg-[#2c5282]/10 text-[#2c5282]',
  amber: 'bg-[#4299e1]/10 text-[#4299e1]'
};

export default function MetricCard({ icon: Icon, label, rawValue, formatter, subtext, color = 'primary' }) {
  const animatedValue = useCountUp(rawValue);
  const accent = ACCENT_COLORS[color];

  return (
    <div
      className="relative bg-white rounded-2xl border border-gray-200 p-5 transition-all hover:-translate-y-0.5"
      style={{
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)',
      }}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-3 right-3 h-[3px] rounded-b-full"
        style={{ background: accent, opacity: 0.6 }}
      />
      <div className="flex items-start gap-3 mt-1">
        <div className={`p-2 rounded-xl ${ICON_BG[color]} flex-shrink-0`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5 leading-tight tabular-nums">
            {formatter ? formatter(animatedValue) : animatedValue.toFixed(1)}
          </p>
          {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}
