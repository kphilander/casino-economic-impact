import React from 'react';
import { BRAND, PRODUCT_NAME_VERSIONED } from '../brand';

/**
 * Page header component matching the GP Consulting archetype wizard style
 */
function PageHeader() {
  return (
    <div className="page-header">
      <h1>{PRODUCT_NAME_VERSIONED}: {BRAND.productFullName}</h1>
      <p>
        The {BRAND.descriptor.toLowerCase()} — estimate the direct, indirect, and
        induced economic impact of casino gaming operations across all 50 U.S.
        states. Built on EPA Input-Output tables, BLS employment data, and
        property-type-specific multipliers.
      </p>
    </div>
  );
}

export default PageHeader;
