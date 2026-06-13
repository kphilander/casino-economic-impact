import React from 'react';

export default function SectionHeader({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-3 mb-4 ${className}`}>
      <div className="section-rule" />
      <h3 className="font-display text-lg font-semibold text-ink leading-snug">{children}</h3>
    </div>
  );
}
