import React from 'react';
import { BRAND, PRODUCT_NAME_VERSIONED } from '../brand';

/**
 * Report-grade masthead: a small publisher eyebrow, a serif wordmark, and a
 * concise descriptor — set on a white surface with a hairline rule.
 */
function PageHeader({ children }) {
  return (
    <div className="page-header no-print">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent mb-1.5">
              {BRAND.publisher} · Economic Analysis
            </p>
            <h1>{PRODUCT_NAME_VERSIONED}: {BRAND.productFullName}</h1>
            <p>
              The {BRAND.descriptor.toLowerCase()} — estimate the direct, indirect, and
              induced economic impact of casino gaming operations across all 50 U.S.
              states, built on EPA Input-Output tables, BLS employment data, and
              property-type-specific multipliers.
            </p>
          </div>
          {children && <div className="flex-shrink-0">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export default PageHeader;
