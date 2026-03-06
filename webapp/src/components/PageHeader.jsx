import React from 'react';

/**
 * Page header component matching the GP Consulting archetype wizard style
 */
function PageHeader() {
  return (
    <div className="page-header">
      <h1>Casino Economic Impact Model</h1>
      <p>
        Estimate the direct, indirect, and induced economic impact of casino gaming
        operations across all 50 U.S. states. Built on EPA Input-Output tables, BLS
        employment data, and property-type-specific multipliers.
      </p>
    </div>
  );
}

export default PageHeader;
