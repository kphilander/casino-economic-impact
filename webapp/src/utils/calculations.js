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
    Direct_Tax_Coef: taxCoef,
    Emp_Coef: empCoef,
    Indirect_Emp_Coef: indirectEmpCoef,
    Induced_Emp_Coef: inducedEmpCoef,
    Type_I_Output: type1Output,
    Type_II_Output: type2Output,
    Type_I_VA: type1VA,
    Type_II_VA: type2VA,
    Type_I_Wage: type1Wage,
    Type_II_Wage: type2Wage,
    Type_I_Tax: type1Tax,
    Type_II_Tax: type2Tax
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

  // TOPI (Taxes on Production & Imports) impacts
  // These flow through the Leontief inverse like wages
  const hasTaxData = taxCoef != null && type1Tax != null && type2Tax != null;
  let topiDirect = 0, topiIndirect = 0, topiInduced = 0, topiTotal = 0;
  if (hasTaxData) {
    topiDirect = revenue * taxCoef;
    topiIndirect = revenue * type1Tax - topiDirect;
    topiInduced = revenue * (type2Tax - type1Tax);
    topiTotal = revenue * type2Tax;
  }

  return {
    output: { direct: outputDirect, indirect: outputIndirect, induced: outputInduced, total: outputTotal },
    gdp: { direct: gdpDirect, indirect: gdpIndirect, induced: gdpInduced, total: gdpTotal },
    employment: { direct: empDirect, indirect: empIndirect, induced: empInduced, total: empTotal, source: empSource },
    wages: { direct: wageDirect, indirect: wageIndirect, induced: wageInduced, total: wageTotal, source: wageSource },
    tax: { direct: topiDirect, indirect: topiIndirect, induced: topiInduced, total: topiTotal },
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
    wages: { direct: 0, indirect: 0, induced: 0, total: 0 },
    tax: { direct: 0, indirect: 0, induced: 0, total: 0 }
  };

  for (const r of results) {
    for (const metric of ['output', 'gdp', 'employment', 'wages', 'tax']) {
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
 * Calculate gaming tax for a given GGR amount using tiered rates
 * @param {number} ggr - Gross gaming revenue in millions
 * @param {object} taxConfig - Tax configuration { tiers: [{threshold, rate}], flatRate, ... }
 * @returns {number} Gaming tax in millions
 */
export function calculateGamingTax(ggr, taxConfig) {
  if (!ggr || ggr <= 0 || !taxConfig) return 0;

  // If user provided a custom rate override, use that
  if (taxConfig.customRate != null) {
    return ggr * taxConfig.customRate;
  }

  // Flat rate
  if (taxConfig.flatRate != null) {
    return ggr * taxConfig.flatRate;
  }

  // Split-tiered: separate graduated schedules for slots and tables (e.g., Illinois)
  // Requires slotRevenuePct to split GGR between game types
  if (taxConfig.slotTiers && taxConfig.tableTiers) {
    const slotPct = taxConfig.slotRevenuePct != null ? taxConfig.slotRevenuePct : 0.7;
    const slotGgr = ggr * slotPct;
    const tableGgr = ggr * (1 - slotPct);
    return applyTieredTax(slotGgr, taxConfig.slotTiers) + applyTieredTax(tableGgr, taxConfig.tableTiers);
  }

  // Tiered (graduated) rates
  // tiers: [{ threshold: 0, rate: 0.15 }, { threshold: 25, rate: 0.25 }, ...]
  // Each tier applies to revenue between this threshold and the next
  if (taxConfig.tiers && taxConfig.tiers.length > 0) {
    return applyTieredTax(ggr, taxConfig.tiers);
  }

  // Split by game type: different flat rates for slots vs tables
  if (taxConfig.slotsRate != null && taxConfig.tableRate != null) {
    const slotPct = taxConfig.slotRevenuePct != null ? taxConfig.slotRevenuePct : 0.7;
    return ggr * slotPct * taxConfig.slotsRate + ggr * (1 - slotPct) * taxConfig.tableRate;
  }

  return 0;
}

/**
 * Apply graduated/tiered tax rates to a revenue amount
 */
function applyTieredTax(amount, tiers) {
  if (!amount || amount <= 0 || !tiers || tiers.length === 0) return 0;
  let tax = 0;
  const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);
  for (let i = 0; i < sortedTiers.length; i++) {
    const tierStart = sortedTiers[i].threshold;
    const tierEnd = i < sortedTiers.length - 1 ? sortedTiers[i + 1].threshold : Infinity;
    const rate = sortedTiers[i].rate;
    if (amount <= tierStart) break;
    const taxableInTier = Math.min(amount, tierEnd) - tierStart;
    tax += taxableInTier * rate;
  }
  return tax;
}

/**
 * Calculate payroll taxes for a given wages amount and employment count.
 *
 * Components (all employer-side):
 *   FICA: Social Security (6.2% on first $176,100/employee) + Medicare (1.45% uncapped)
 *   FUTA: 0.6% on first $7,000/employee
 *   SUTA: state avg rate on state wage base per employee
 *   SDI:  state employer rate on wages (where applicable)
 *   PFML: state employer rate on wages (where applicable)
 *
 * @param {number} wages - Total wages in $M
 * @param {number} ftes - Number of FTE jobs
 * @param {object} stateRates - State entry from employmentTaxRates.json
 * @param {object} federal - Federal constants from employmentTaxRates.json
 * @returns {number} Total payroll taxes in $M
 */
export function calculatePayrollTax(wages, ftes, stateRates, federal) {
  if (!wages || wages <= 0 || !ftes || ftes <= 0 || !stateRates || !federal) return 0;

  const wagesDollars = wages * 1e6;
  const avgWage = wagesDollars / ftes;

  // FICA Social Security: 6.2% on min(avgWage, cap) per employee
  const ssTaxable = Math.min(avgWage, federal.fica_ss_wage_cap);
  const ficaSS = ssTaxable * federal.fica_ss_rate * ftes;

  // FICA Medicare: 1.45% on all wages (uncapped)
  const ficaMedicare = wagesDollars * federal.fica_medicare_rate;

  // FUTA: 0.6% on first $7,000 per employee
  const futaTaxable = Math.min(avgWage, federal.futa_wage_base);
  const futa = futaTaxable * federal.futa_rate * ftes;

  // SUTA: state avg rate on min(avgWage, state wage base) per employee
  let suta = 0;
  if (stateRates.suta_avg_rate && stateRates.suta_wage_base) {
    const sutaTaxable = Math.min(avgWage, stateRates.suta_wage_base);
    suta = sutaTaxable * stateRates.suta_avg_rate * ftes;
  }

  // SDI employer contribution (where applicable)
  let sdi = 0;
  if (stateRates.sdi_employer_rate && stateRates.sdi_employer_rate > 0) {
    sdi = wagesDollars * stateRates.sdi_employer_rate;
  }

  // PFML employer contribution (where applicable)
  let pfml = 0;
  if (stateRates.pfml_employer_rate && stateRates.pfml_employer_rate > 0) {
    pfml = wagesDollars * stateRates.pfml_employer_rate;
  }

  return (ficaSS + ficaMedicare + futa + suta + sdi + pfml) / 1e6;
}

/**
 * Calculate household taxes using BEA personal current tax ratio.
 * Applies the state-specific ratio of (personal current taxes / wages) to wages.
 *
 * Includes: federal + state + local income taxes, motor vehicle licenses,
 * personal property taxes. Does NOT include real estate taxes, sales taxes
 * (those are TOPI), or FICA (separate payroll category).
 *
 * @param {number} wages - Wages in $M
 * @param {object} stateRates - State entry from employmentTaxRates.json
 * @returns {number} Household taxes in $M
 */
export function calculateHouseholdTax(wages, stateRates) {
  if (!wages || wages <= 0 || !stateRates || !stateRates.household_tax_ratio) return 0;
  return wages * stateRates.household_tax_ratio;
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
