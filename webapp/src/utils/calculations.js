/**
 * Economic Impact Calculation Engine
 *
 * Implements the Industry Technology Assumption (ITA) methodology
 * for calculating Direct, Indirect, and Induced economic effects.
 */

/**
 * CPI-U Annual Averages (All Urban Consumers, All Items)
 * Source: BLS Series CUUR0000SA0
 * https://data.bls.gov/timeseries/CUUR0000SA0
 *
 * The IO tables use 2019 as base year, so employment coefficients
 * are calibrated to 2019 dollars. We deflate current-year GDP to
 * 2019 dollars before applying employment coefficients.
 */
const CPI_BASE_YEAR = 2019;
const CPI_ANNUAL_AVG = {
  2019: 254.412,
  2020: 257.557,
  2021: 266.236,
  2022: 288.347,
  2023: 302.408,
  2024: 312.145,
  2025: 320.229
};

/**
 * Get deflator to convert current-year dollars to 2019 dollars
 * Deflator < 1 means current dollars buy less than 2019 dollars
 */
function getDeflator(year) {
  const baseValue = CPI_ANNUAL_AVG[CPI_BASE_YEAR];
  // Use 2025 as fallback for any year not in the table
  const currentValue = CPI_ANNUAL_AVG[year] || CPI_ANNUAL_AVG[2025];
  return baseValue / currentValue;
}

// Current year deflator (calculated once at module load)
const CURRENT_YEAR = new Date().getFullYear();
const DEFLATOR = getDeflator(CURRENT_YEAR);

/**
 * Calculate economic impact for a single revenue stream
 */
export function calculateSingleImpact(revenue, stateData, knownEmployment = null, knownWages = null) {
  if (!revenue || revenue <= 0 || !stateData) {
    return null;
  }

  const {
    Direct_VA_Coef: vaCoef,
    Direct_Wage_Coef: wageCoef,
    Emp_Coef: empCoef,
    Indirect_Emp_Coef: indirectEmpCoef,
    Induced_Emp_Coef: inducedEmpCoef,
    Type_I_Output: type1Output,
    Type_II_Output: type2Output,
    Type_I_VA: type1VA,
    Type_II_VA: type2VA,
    Type_I_Wage: type1Wage,
    Type_II_Wage: type2Wage
  } = stateData;

  // Output impacts
  const outputDirect = revenue;
  const outputIndirect = revenue * (type1Output - 1);
  const outputInduced = revenue * (type2Output - type1Output);
  const outputTotal = revenue * type2Output;

  // GDP impacts
  const gdpDirect = revenue * vaCoef;
  const gdpType1Total = revenue * type1VA;
  const gdpType2Total = revenue * type2VA;
  const gdpIndirect = gdpType1Total - gdpDirect;
  const gdpInduced = gdpType2Total - gdpType1Total;
  const gdpTotal = gdpType2Total;

  // Wage impacts
  let wageDirect, wageSource;
  if (knownWages && knownWages > 0) {
    wageDirect = knownWages;
    wageSource = 'user';
  } else {
    wageDirect = revenue * wageCoef;
    wageSource = 'calculated';
  }
  const wageIndirect = revenue * type1Wage - revenue * wageCoef;
  const wageInduced = revenue * (type2Wage - type1Wage);
  const wageTotal = wageDirect + wageIndirect + wageInduced;

  // Employment impacts
  // Each effect type uses its own industry-weighted employment coefficient:
  // - Direct: empCoef (jobs per $1M of direct GDP)
  // - Indirect: indirectEmpCoef (jobs per $1M of indirect GDP, weighted for supplier industries)
  // - Induced: inducedEmpCoef (jobs per $1M of induced GDP, weighted for household spending industries)
  //
  // IMPORTANT: Employment coefficients are calibrated to 2019 dollars (from StateIO tables).
  // We must deflate current-year GDP to 2019 dollars before applying coefficients.
  // Without this, $100M in 2026 would be treated as equivalent to $100M in 2019,
  // overstating employment by ~29% (cumulative inflation 2019-2026).
  let empDirect, empSource;
  if (knownEmployment && knownEmployment > 0) {
    empDirect = knownEmployment;
    empSource = 'user';
  } else {
    // Deflate GDP to 2019 dollars before applying coefficient
    empDirect = (gdpDirect * DEFLATOR) * empCoef;
    empSource = 'calculated';
  }

  // Use industry-weighted employment coefficients for indirect/induced
  // These coefficients were computed in the R scripts using the Leontief inverse
  // and represent the weighted average labor intensity of supplier/household-spending industries
  // Same deflation applies to convert current dollars to 2019 base
  const empIndirect = (gdpIndirect * DEFLATOR) * indirectEmpCoef;
  const empInduced = (gdpInduced * DEFLATOR) * inducedEmpCoef;
  const empTotal = empDirect + empIndirect + empInduced;

  return {
    output: { direct: outputDirect, indirect: outputIndirect, induced: outputInduced, total: outputTotal },
    gdp: { direct: gdpDirect, indirect: gdpIndirect, induced: gdpInduced, total: gdpTotal },
    employment: { direct: empDirect, indirect: empIndirect, induced: empInduced, total: empTotal, source: empSource },
    wages: { direct: wageDirect, indirect: wageIndirect, induced: wageInduced, total: wageTotal, source: wageSource },
    multipliers: {
      output: type2Output,
      gdp: gdpTotal / gdpDirect,
      employment: empTotal / empDirect,
      wages: wageTotal / wageDirect
    }
  };
}

/**
 * Get property type multipliers for a state
 * @param {string} propertyType - NAICS code (721120, 713210, 713290, 722410)
 * @param {string} state - State name
 * @param {object} propertyTypesData - The propertyTypes object from multipliers.json
 * @returns {object|null} State data for the property type, or null if not found
 */
export function getPropertyTypeData(propertyType, state, propertyTypesData) {
  if (!propertyType || !propertyTypesData || !propertyTypesData[propertyType]) {
    return null;
  }
  return propertyTypesData[propertyType].find(d => d.State === state);
}

/**
 * Calculate combined economic impact for multiple revenue streams
 *
 * @param {object} revenues - Revenue by type { gaming, food, lodging, other } OR { total } for total mode
 * @param {array} multiplierData - Array of sector multipliers
 * @param {array} gamblingData - Array of gambling-specific multipliers (legacy, for backward compatibility)
 * @param {string} state - State name
 * @param {boolean} useGamblingSpecific - Whether to use gambling-specific multipliers
 * @param {object|number|null} knownData - Known data by department { gaming: {emp, wages}, food: {...}, ... }
 *                                          OR legacy single employment number for backward compatibility
 * @param {number|null} knownWagesLegacy - Legacy: Known wages in millions (only used if knownData is a number)
 * @param {string|null} propertyType - Property type NAICS code (721120, 713210, 713290, 722410)
 * @param {object|null} propertyTypesData - Property type multipliers from JSON
 * @param {string} inputMode - 'department' (default) or 'total'
 */
export function calculateCombinedImpact(
  revenues,
  multiplierData,
  gamblingData,
  state,
  useGamblingSpecific = true,
  knownData = null,
  knownWagesLegacy = null,
  propertyType = null,
  propertyTypesData = null,
  inputMode = 'department'
) {
  // Handle legacy single-value parameters (backward compatibility)
  // If knownData is a number, treat it as legacy knownEmployment
  let knownDataNormalized = {};
  if (typeof knownData === 'number') {
    // Legacy mode: single employment/wages values apply to gaming only
    knownDataNormalized = {
      gaming: { emp: knownData, wages: knownWagesLegacy },
      food: { emp: null, wages: null },
      lodging: { emp: null, wages: null },
      other: { emp: null, wages: null }
    };
  } else if (knownData && typeof knownData === 'object') {
    // New mode: department-level known data
    knownDataNormalized = knownData;
  } else {
    // No known data
    knownDataNormalized = {
      gaming: { emp: null, wages: null },
      food: { emp: null, wages: null },
      lodging: { emp: null, wages: null },
      other: { emp: null, wages: null }
    };
  }
  const results = [];

  // TOTAL MODE: Apply property type multipliers to entire revenue
  if (inputMode === 'total' && revenues.total && revenues.total > 0) {
    let stateData;

    // Get property type multipliers
    if (propertyType && propertyTypesData) {
      stateData = getPropertyTypeData(propertyType, state, propertyTypesData);
    }

    // Fallback to gambling-specific if no property type data
    if (!stateData && useGamblingSpecific && gamblingData) {
      stateData = gamblingData.find(d => d.State === state);
    }

    // Fallback to blended 713 sector
    if (!stateData) {
      stateData = multiplierData.find(d => d.State === state && d.Sector === '713');
    }

    if (!stateData) return null;

    // In total mode, sum all department known data for overall totals
    const totalKnownEmp = Object.values(knownDataNormalized).reduce((sum, d) => sum + (d?.emp || 0), 0) || null;
    const totalKnownWages = Object.values(knownDataNormalized).reduce((sum, d) => sum + (d?.wages || 0), 0) || null;

    const impact = calculateSingleImpact(
      revenues.total,
      stateData,
      totalKnownEmp,
      totalKnownWages
    );

    if (impact) {
      // Get property type label
      const propertyLabels = {
        '721120': 'Casino Hotel',
        '713210': 'Stand-alone Casino',
        '713290': 'Slot Parlor',
        '722410': 'Bar/Restaurant Gaming'
      };

      results.push({
        type: 'total',
        label: propertyLabels[propertyType] || 'Total Revenue',
        sector: stateData.Property_Type || stateData.Sector || propertyType,
        revenue: revenues.total,
        propertyType,
        ...impact
      });
    }
  } else {
    // DEPARTMENT MODE: Apply sector-specific multipliers to each revenue stream
    const revenueTypes = [
      { key: 'gaming', sector: '713', label: 'Gaming (GGR)' },
      { key: 'food', sector: '722', label: 'Food & Beverage' },
      { key: 'lodging', sector: '721', label: 'Lodging' },
      { key: 'other', sector: '711AS', label: 'Other' }
    ];

    for (const { key, sector, label } of revenueTypes) {
      const revenue = revenues[key];
      if (!revenue || revenue <= 0) continue;

      // Get state data for this sector
      let stateData;
      if (key === 'gaming') {
        // In department mode, GGR uses gambling multipliers (not property type 721120 which equals lodging)
        // For non-casino-hotel property types, use their specific multipliers
        if (propertyType && propertyType !== '721120' && propertyTypesData) {
          stateData = getPropertyTypeData(propertyType, state, propertyTypesData);
        }
        // For casino hotels or as fallback, use legacy gambling (7132) multipliers
        if (!stateData && useGamblingSpecific && gamblingData) {
          stateData = gamblingData.find(d => d.State === state);
        }
        if (!stateData) {
          stateData = multiplierData.find(d => d.State === state && d.Sector === sector);
        }
      } else {
        stateData = multiplierData.find(d => d.State === state && d.Sector === sector);
      }

      if (!stateData) continue;

      // Apply department-specific known employment/wages
      const deptKnownData = knownDataNormalized[key] || {};
      const impact = calculateSingleImpact(
        revenue,
        stateData,
        deptKnownData.emp || null,
        deptKnownData.wages || null
      );

      if (impact) {
        results.push({
          type: key,
          label,
          sector: stateData.Property_Type || stateData.Sector || sector,
          revenue,
          propertyType: key === 'gaming' ? propertyType : null,
          ...impact
        });
      }
    }
  }

  if (results.length === 0) return null;

  // Aggregate totals
  const totals = {
    output: { direct: 0, indirect: 0, induced: 0, total: 0 },
    gdp: { direct: 0, indirect: 0, induced: 0, total: 0 },
    employment: { direct: 0, indirect: 0, induced: 0, total: 0 },
    wages: { direct: 0, indirect: 0, induced: 0, total: 0 }
  };

  for (const r of results) {
    for (const metric of ['output', 'gdp', 'employment', 'wages']) {
      for (const effect of ['direct', 'indirect', 'induced', 'total']) {
        totals[metric][effect] += r[metric][effect];
      }
    }
  }

  // Calculate weighted average multipliers
  const multipliers = {
    output: totals.output.total / totals.output.direct,
    gdp: totals.gdp.total / totals.gdp.direct,
    employment: totals.employment.total / totals.employment.direct,
    wages: totals.wages.total / totals.wages.direct
  };

  return {
    byRevenue: results,
    totals,
    multipliers,
    hasUserData: results.some(r => r.employment.source === 'user' || r.wages.source === 'user')
  };
}

/**
 * Format number with commas and decimal places
 */
export function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format currency (millions)
 */
export function formatCurrency(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return '$' + formatNumber(value, decimals) + 'M';
}

/**
 * Format jobs count
 */
export function formatJobs(value) {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return Math.round(value).toLocaleString('en-US');
}
