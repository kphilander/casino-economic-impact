import React from 'react';

/**
 * Section title with a thin navy tab rule (replaces the old gradient pill).
 */
export function SectionTitle({ children, sub, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-4 ${className}`}>
      <div className="flex items-start gap-3 min-w-0">
        <div className="section-rule mt-1 flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-ink leading-snug">{children}</h3>
          {sub && <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{sub}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0 no-print">{action}</div>}
    </div>
  );
}

/**
 * Report-grade surface card. Pass `title`/`sub`/`action` to render a header,
 * or compose freely via children.
 */
export default function Card({ title, sub, action, children, className = '', bodyClassName = '', ...props }) {
  return (
    <div className={`dash-card p-6 ${className}`} {...props}>
      {title && <SectionTitle sub={sub} action={action}>{title}</SectionTitle>}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
