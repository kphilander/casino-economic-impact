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
 * Employment coefficients use 2023 QCEW jobs divided by 2023 StateIO
 * output/value added. We deflate current-year GDP to 2023 dollars before
 * applying them. The 2019 StateIO year applies only to the interindustry
 * structure and does not set the employment coefficient price year.
 */
const CPI_BASE_YEAR = 2023;
const CPI_ANNUAL_AVG = {
  2019: 255.657,
  2020: 258.811,
  2021: 270.970,
  2022: 292.655,
  2023: 304.702,
  2024: 313.689,
  2025: 321.943
};
const LATEST_CPI_YEAR = Math.max(...Object.keys(CPI_ANNUAL_AVG).map(Number));

/**
 * Get deflator to convert current-year dollars to 2023 dollars.
 */
export function getDeflator(year) {
  const baseValue = CPI_ANNUAL_AVG[CPI_BASE_YEAR];
  // Use the latest complete annual average when the analysis year is newer.
  const currentValue = CPI_ANNUAL_AVG[year] || CPI_ANNUAL_AVG[LATEST_CPI_YEAR];
  return baseValue / currentValue;
}

/** Years with a complete CPI-U annual average, for the dollar-year selector. */
export const CPI_YEARS = Object.keys(CPI_ANNUAL_AVG).map(Number).sort((a, b) => a - b);

/**
 * Default dollar year of revenue inputs: the latest complete CPI-U year. The
 * analysis year is an explicit input rather than the browser clock, so a 2024
 * revenue figure entered in 2026 is deflated from 2024 dollars.
 */
export const DEFAULT_ANALYSIS_YEAR = LATEST_CPI_YEAR;

/**
 * Share of employee compensation represented by wages and salaries.
 *
 * BEA NIPA table 1.12 reports 2019 wages and salaries of $9,323.5B and
 * employee compensation of $11,447.7B. The model uses this national ratio as
 * an explicit approximation until industry-by-state wage shares are added.
 * Keeping cash wages separate prevents payroll and household tax rates from
 * being applied to benefits and employer contributions contained in V001.
 */
export const WAGE_SHARE_OF_COMPENSATION = 9323.5 / 11447.7;

/**
 * Calculate economic impact for a single revenue stream
 */
export function calculateSingleImpact(revenue, stateData, knownEmployment = null, knownWages = null, options = {}) {
  if (!revenue || revenue <= 0 || !stateData) {
    return null;
  }
  const DEFLATOR = options.deflator ?? getDeflator(DEFAULT_ANALYSIS_YEAR);
  // 90% predictive range for direct jobs { p05, p95 } relative to the
  // coefficient (jobsRange.json), or null where no benchmark exists.
  const jobsRange = options.jobsRange || null;
  // Share of compensation that is QCEW-comparable (taxable, payroll-reported)
  // wages: the stream's own sector for direct effects, all-private for ripple.
  const cashShare = options.cashWageShare || { direct: WAGE_SHARE_OF_COMPENSATION, ripple: WAGE_SHARE_OF_COMPENSATION };

  const {
    Direct_VA_Coef: vaCoef,
    Direct_Wage_Coef: wageCoef,
    Direct_Tax_Coef: taxCoef,
    Emp_Coef: empCoef,
    Direct_Jobs_Per_1M_Output: directJobsPerOutput,
    Indirect_Emp_Coef: indirectEmpCoef,
    Induced_Emp_Coef: inducedEmpCoef,
    FTE_Per_Job: ftePerJob,
    Direct_FTE_Per_1M_Output: directFtePerOutput,
    Indirect_FTE_Coef: indirectFteCoef,
    Induced_FTE_Coef: inducedFteCoef,
    Type_I_Output: type1Output,
    Type_II_Output: type2Output,
    Type_I_VA: type1VA,
    Type_II_VA: type2VA,
    Type_I_Wage: type1Wage,
    Type_II_Wage: type2Wage,
    Type_I_Tax: type1Tax,
    Type_II_Tax: type2Tax
  } = stateData;

  // Direct and indirect output impacts do not change when observed labor data
  // replace the modeled values. Induced impacts are adjusted below when the
  // user supplies cash wages because household spending is labor-income driven.
  const outputDirect = revenue;
  const outputIndirect = revenue * (type1Output - 1);
  const modeledOutputInduced = revenue * (type2Output - type1Output);

  // GDP impacts
  const gdpDirect = revenue * vaCoef;
  const gdpType1Total = revenue * type1VA;
  const gdpType2Total = revenue * type2VA;
  const gdpIndirect = gdpType1Total - gdpDirect;
  const modeledGdpInduced = gdpType2Total - gdpType1Total;

  // Employee compensation impacts. The stored "Wage" coefficients are V001
  // employee compensation (cash wages + employer-paid supplements), not cash
  // wages. A user-provided knownWages value is treated as cash wages and
  // grossed up to compensation using the documented national wage share.
  const modeledCompDirect = revenue * wageCoef;
  let wageDirect, wageSource;
  if (knownWages && knownWages > 0) {
    wageDirect = knownWages / cashShare.direct;
    wageSource = 'user';
  } else {
    wageDirect = modeledCompDirect;
    wageSource = 'calculated';
  }
  const wageIndirect = revenue * type1Wage - modeledCompDirect;

  // Type II effects are generated by the compensation supported in the direct
  // and supplier (Type I) rounds. When observed direct cash wages are supplied,
  // scale only the induced component by the change in Type I compensation.
  const modeledType1Comp = modeledCompDirect + wageIndirect;
  const adjustedType1Comp = wageDirect + wageIndirect;
  const inducedScale = wageSource === 'user' && modeledType1Comp > 0
    ? adjustedType1Comp / modeledType1Comp
    : 1;

  const outputInduced = modeledOutputInduced * inducedScale;
  const outputTotal = outputDirect + outputIndirect + outputInduced;
  const gdpInduced = modeledGdpInduced * inducedScale;
  const gdpTotal = gdpDirect + gdpIndirect + gdpInduced;
  const wageInduced = revenue * (type2Wage - type1Wage) * inducedScale;
  const wageTotal = wageDirect + wageIndirect + wageInduced;

  // Cash-wage estimates are used only as tax bases. Results continue to expose
  // the legacy `wages` key for API compatibility, but that key now has accurate
  // employee-compensation labels throughout the interface and reports.
  const cashWages = {
    direct: wageSource === 'user' ? knownWages : wageDirect * cashShare.direct,
    indirect: wageIndirect * cashShare.ripple,
    induced: wageInduced * cashShare.ripple
  };
  cashWages.total = cashWages.direct + cashWages.indirect + cashWages.induced;

  // Employment impacts
  // Each effect type uses its own industry-weighted employment coefficient:
  // - Direct: directJobsPerOutput (jobs per $1M of direct output); empCoef is
  //   retained as the consistent-2023 jobs/value-added fallback/diagnostic
  // - Indirect: indirectEmpCoef (jobs per $1M of indirect GDP, weighted for supplier industries)
  // - Induced: inducedEmpCoef (jobs per $1M of induced GDP, weighted for household spending industries)
  //
  // Employment coefficients are calibrated to 2023 dollars. The model keeps
  // 2019 interindustry relationships but does not mix 2023 jobs with 2019
  // dollar denominators.
  let empDirect, empSource;
  if (knownEmployment && knownEmployment > 0) {
    empDirect = knownEmployment;
    empSource = 'user';
  } else {
    // Deflate direct output to 2023 dollars before applying the coefficient.
    empDirect = directJobsPerOutput != null
      ? (revenue * DEFLATOR) * directJobsPerOutput
      : (gdpDirect * DEFLATOR) * empCoef;
    empSource = 'calculated';
  }

  // Use industry-weighted employment coefficients for indirect/induced
  // These coefficients were computed in the R scripts using the Leontief inverse
  // and represent the weighted average labor intensity of supplier/household-spending industries
  // The same conversion applies to supplier and household-spending GDP.
  const empIndirect = (gdpIndirect * DEFLATOR) * indirectEmpCoef;
  const empInduced = (gdpInduced * DEFLATOR) * inducedEmpCoef;
  const empTotal = empDirect + empIndirect + empInduced;

  // 90% predictive interval for direct jobs from the 50-state comparison of
  // the coefficient with Economic Census jobs per revenue dollar. Supplier and
  // induced jobs have no observed benchmark and enter the interval unchanged.
  const ripple = empIndirect + empInduced;
  const employmentDetail = jobsRange && empSource === 'calculated' ? {
    range: {
      direct: [empDirect * jobsRange.p05, empDirect * jobsRange.p95],
      total: [empDirect * jobsRange.p05 + ripple, empDirect * jobsRange.p95 + ripple],
    },
  } : null;

  // Estimated FTE impacts use a separate BEA industry satellite. Direct FTEs
  // use the direct industry's ratio; supplier and induced FTE coefficients
  // were propagated in R using the industries where those effects occur.
  // A known employment input is a filled-job count and is converted with the
  // direct industry's documented ratio rather than silently treated as FTEs.
  const fteDirect = empSource === 'user'
    ? empDirect * ftePerJob
    : (revenue * DEFLATOR) * directFtePerOutput;
  const fteIndirect = (gdpIndirect * DEFLATOR) * indirectFteCoef;
  const fteInduced = (gdpInduced * DEFLATOR) * inducedFteCoef;
  const fteTotal = fteDirect + fteIndirect + fteInduced;

  // TOPI (Taxes on Production & Imports) impacts
  // These flow through the Leontief inverse like wages
  const hasTaxData = taxCoef != null && type1Tax != null && type2Tax != null;
  let topiDirect = 0, topiIndirect = 0, topiInduced = 0, topiTotal = 0;
  if (hasTaxData) {
    topiDirect = revenue * taxCoef;
    topiIndirect = revenue * type1Tax - topiDirect;
    topiInduced = revenue * (type2Tax - type1Tax) * inducedScale;
    topiTotal = topiDirect + topiIndirect + topiInduced;
  }

  return {
    output: { direct: outputDirect, indirect: outputIndirect, induced: outputInduced, total: outputTotal },
    gdp: { direct: gdpDirect, indirect: gdpIndirect, induced: gdpInduced, total: gdpTotal },
    employment: { direct: empDirect, indirect: empIndirect, induced: empInduced, total: empTotal, source: empSource, detail: employmentDetail },
    fte: { direct: fteDirect, indirect: fteIndirect, induced: fteInduced, total: fteTotal, source: 'estimated' },
    wages: { direct: wageDirect, indirect: wageIndirect, induced: wageInduced, total: wageTotal, source: wageSource },
    cashWages,
    tax: { direct: topiDirect, indirect: topiIndirect, induced: topiInduced, total: topiTotal },
    adjustments: { inducedScale },
    multipliers: {
      output: outputTotal / outputDirect,
      gdp: gdpTotal / gdpDirect,
      employment: empTotal / empDirect,
      fte: fteTotal / fteDirect,
      wages: wageTotal / wageDirect
    }
  };
}

/**
 * Check if a property type is an online operation (iGaming or sportsbook)
 */
export function isOnlinePropertyType(propertyType) {
  return ['ONLINE_CASINO', 'ONLINE_SPORTSBOOK'].includes(propertyType);
}

/**
 * Return the revenue base that can safely be treated as GGR for statutory tax.
 * A legacy land-based total-revenue input may include rooms, food, and other
 * operating revenue, so it is never silently treated as GGR.
 */
export function getTaxableGgr(inputMode, isOnline, revenues = {}) {
  if (inputMode === 'total') return isOnline ? (revenues.total || 0) : 0;
  return revenues.gaming || 0;
}

/**
 * Get property type multipliers for a state
 * @param {string} propertyType - NAICS code (721120, 713210, 713290, 722410) or online type
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
 * @param {object|number|null} knownData - Known jobs and cash wages by department { gaming: {emp, wages}, food: {...}, ... }
 *                                          OR legacy single employment number for backward compatibility
 * @param {number|null} knownWagesLegacy - Legacy: Known cash wages in millions (only used if knownData is a number)
 * @param {string|null} propertyType - Property type NAICS code (721120, 713210, 713290, 722410) or online type
 * @param {object|null} propertyTypesData - Property type multipliers from JSON
 * @param {string} inputMode - 'department' (default) or 'total'
 * @param {array|null} onlineGamingData - Array of online gambling multipliers (from multipliers.json onlineGaming section)
 * @param {object} options - { analysisYear, jobsRanges, wageBasis, ownership }
 *   analysisYear: dollar year of the revenue inputs (CPI-U deflation to 2023$)
 *   jobsRanges: jobsRange.json contents (direct-jobs predictive ranges)
 *   wageBasis: wageBasis.json contents (compensation -> QCEW-comparable wages)
 *   ownership: 'commercial' (default) or 'tribal'
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
  inputMode = 'department',
  onlineGamingData = null,
  options = {}
) {
  const deflator = getDeflator(options.analysisYear ?? DEFAULT_ANALYSIS_YEAR);
  const jobsRangeFor = (stream) => jobsRangeForStream(options.jobsRanges, propertyType, inputMode, stream, options.ownership);
  const wb = options.wageBasis;
  const cashWageShareFor = (stateData) => wb ? {
    direct: isOnlinePropertyType(propertyType) ? wb.private : (wb.sectors[String(stateData.Sector)] ?? wb.private),
    ripple: wb.private,
  } : undefined;
  const impactOptions = (stream, stateData) => ({
    deflator, jobsRange: jobsRangeFor(stream), cashWageShare: cashWageShareFor(stateData),
  });
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
    const isOnline = isOnlinePropertyType(propertyType);
    knownDataNormalized = isOnline
      ? {
          gaming: { emp: null, wages: null },
          marketing: { emp: null, wages: null },
          tech: { emp: null, wages: null },
          other: { emp: null, wages: null }
        }
      : {
          gaming: { emp: null, wages: null },
          food: { emp: null, wages: null },
          lodging: { emp: null, wages: null },
          other: { emp: null, wages: null }
        };
  }
  const results = [];

  const isOnline = isOnlinePropertyType(propertyType);

  // TOTAL MODE: Apply property type multipliers to entire revenue
  if (inputMode === 'total' && revenues.total && revenues.total > 0) {
    let stateData;

    if (isOnline) {
      // Online types: use property type data first, then onlineGaming, then gambling fallback
      if (propertyType && propertyTypesData) {
        stateData = getPropertyTypeData(propertyType, state, propertyTypesData);
      }
      if (!stateData && onlineGamingData) {
        stateData = onlineGamingData.find(d => d.State === state);
      }
      if (!stateData && gamblingData) {
        stateData = gamblingData.find(d => d.State === state);
      }
    } else {
      // Land-based property type is descriptive. Use the single canonical
      // gambling production function for total-revenue estimates; department
      // mode is available when lodging/food/other composition is known.
      if (gamblingData) {
        stateData = gamblingData.find(d => d.State === state);
      }
      if (!stateData && propertyType && propertyTypesData) {
        stateData = getPropertyTypeData(propertyType, state, propertyTypesData);
      }
      if (!stateData) {
        stateData = multiplierData.find(d => d.State === state && d.Sector === '713');
      }
    }

    if (!stateData) return null;

    // In total mode, sum all department known data for overall totals
    const totalKnownEmp = Object.values(knownDataNormalized).reduce((sum, d) => sum + (d?.emp || 0), 0) || null;
    const totalKnownWages = Object.values(knownDataNormalized).reduce((sum, d) => sum + (d?.wages || 0), 0) || null;

    const impact = calculateSingleImpact(
      revenues.total,
      stateData,
      totalKnownEmp,
      totalKnownWages,
      impactOptions('total', stateData)
    );

    if (impact) {
      // Get property type label
      const propertyLabels = {
        '721120': 'Casino Hotel',
        '713210': 'Stand-alone Casino',
        '713290': 'Slot Parlor',
        '722410': 'Bar/Restaurant Gaming',
        'ONLINE_CASINO': 'Online Casino / iGaming',
        'ONLINE_SPORTSBOOK': 'Online Sportsbook'
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
    // Online operators have a single revenue stream (GGR); marketing/tech/other are
    // expense lines funded by GGR, not independent revenue — including them would double-count.
    const revenueTypes = isOnline
      ? [
          { key: 'gaming', sector: '713', label: propertyType === 'ONLINE_SPORTSBOOK' ? 'Sports Betting GGR' : 'Online GGR' }
        ]
      : [
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
        if (isOnline) {
          // Online gaming: use property type data, then onlineGaming, then gambling fallback
          if (propertyType && propertyTypesData) {
            stateData = getPropertyTypeData(propertyType, state, propertyTypesData);
          }
          if (!stateData && onlineGamingData) {
            stateData = onlineGamingData.find(d => d.State === state);
          }
          if (!stateData && gamblingData) {
            stateData = gamblingData.find(d => d.State === state);
          }
        } else {
          // All land-based GGR uses the canonical gambling calibration. The
          // property's hospitality revenue is modeled by the sector-specific
          // department entries below, not by swapping the gaming production
          // function for an accommodation or restaurant proxy.
          if (gamblingData) {
            stateData = gamblingData.find(d => d.State === state);
          }
          if (!stateData && propertyType && propertyTypesData) {
            stateData = getPropertyTypeData(propertyType, state, propertyTypesData);
          }
          if (!stateData) {
            stateData = multiplierData.find(d => d.State === state && d.Sector === sector);
          }
        }
      } else {
        stateData = multiplierData.find(d => d.State === state && d.Sector === sector);
      }

      if (!stateData) continue;

      // Apply department-specific known jobs/cash wages
      const deptKnownData = knownDataNormalized[key] || {};
      const impact = calculateSingleImpact(
        revenue,
        stateData,
        deptKnownData.emp || null,
        deptKnownData.wages || null,
        impactOptions(key, stateData)
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
    fte: { direct: 0, indirect: 0, induced: 0, total: 0 },
    wages: { direct: 0, indirect: 0, induced: 0, total: 0 },
    cashWages: { direct: 0, indirect: 0, induced: 0, total: 0 },
    tax: { direct: 0, indirect: 0, induced: 0, total: 0 }
  };

  for (const r of results) {
    for (const metric of ['output', 'gdp', 'employment', 'fte', 'wages', 'cashWages', 'tax']) {
      for (const effect of ['direct', 'indirect', 'induced', 'total']) {
        totals[metric][effect] += r[metric][effect];
      }
    }
  }

  // Direct-jobs predictive interval summed across streams (streams without a
  // range contribute their point estimate).
  const anyDetail = results.some(r => r.employment.detail);
  totals.employment.detail = anyDetail ? results.reduce((acc, r) => {
    const e = r.employment;
    const range = e.detail?.range || { direct: [e.direct, e.direct], total: [e.total, e.total] };
    acc.range.direct[0] += range.direct[0]; acc.range.direct[1] += range.direct[1];
    acc.range.total[0] += range.total[0]; acc.range.total[1] += range.total[1];
    return acc;
  }, { range: { direct: [0, 0], total: [0, 0] } }) : null;

  // Calculate weighted average multipliers
  const multipliers = {
    output: totals.output.total / totals.output.direct,
    gdp: totals.gdp.total / totals.gdp.direct,
    employment: totals.employment.total / totals.employment.direct,
    fte: totals.fte.total / totals.fte.direct,
    wages: totals.wages.total / totals.wages.direct
  };

  return {
    byRevenue: results,
    totals,
    multipliers,
    analysisYear: options.analysisYear ?? DEFAULT_ANALYSIS_YEAR,
    hasUserData: results.some(r => r.employment.source === 'user' || r.wages.source === 'user')
  };
}

/**
 * Which direct-jobs predictive range applies to a revenue stream.
 *
 * The ranges come from the 50-state comparison of the calculator's direct
 * jobs coefficient with 2022 Economic Census jobs per revenue dollar, by
 * property type (jobsRange.json). In total mode the selected property type's
 * range applies. In department mode only the gaming stream has one, using the
 * stand-alone-casino range as the gaming-floor proxy (the slot-parlor range for
 * slot parlors). No range exists for bars with slots, tribal properties (the
 * Economic Census excludes most tribal casinos) or online operations.
 */
export function jobsRangeForStream(ranges, propertyType, inputMode, stream, ownership = 'commercial') {
  if (!ranges?.propertyTypes || ownership === 'tribal' || isOnlinePropertyType(propertyType)) return null;
  const types = ranges.propertyTypes;
  if (inputMode === 'total' && stream === 'total') return types[propertyType] || null;
  if (stream === 'gaming') {
    return types[propertyType === '713290' ? '713290' : (ranges.gamingDepartmentProxy || '713210')] || null;
  }
  return null;
}

/**
 * Calculate gaming tax for a given GGR amount using tiered rates
 * @param {number} ggr - Gross gaming revenue in millions
 * @param {object} taxConfig - Tax configuration { tiers: [{threshold, rate}], flatRate, ... }
 * @returns {number} Gaming tax in millions
 */
export function calculateGamingTax(ggr, taxConfig) {
  if (!ggr || ggr <= 0 || !taxConfig) return 0;
  const addOn = taxConfig.customRate == null && taxConfig.additionalRate ? ggr * taxConfig.additionalRate : 0;
  return baseGamingTax(ggr, taxConfig) + addOn;
}

function baseGamingTax(ggr, taxConfig) {

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
 * @param {number} wages - Cash wages and salaries in $M
 * @param {number} jobs - Number of full- and part-time jobs
 * @param {object} stateRates - State entry from employmentTaxRates.json
 * @param {object} federal - Federal constants from employmentTaxRates.json
 * @returns {number} Total payroll taxes in $M
 */
export function calculatePayrollTax(wages, jobs, stateRates, federal) {
  return calculatePayrollTaxDetail(wages, jobs, stateRates, federal).total;
}

/**
 * Employer payroll taxes split by level of government, in $M:
 *   federal: FICA Social Security + Medicare, FUTA
 *   state:   SUTA, plus employer SDI and PFML contributions where they exist
 */
export function calculatePayrollTaxDetail(wages, jobs, stateRates, federal) {
  const zero = { federal: 0, state: 0, total: 0 };
  if (!wages || wages <= 0 || !jobs || jobs <= 0 || !stateRates || !federal) return zero;

  const wagesDollars = wages * 1e6;
  const avgWage = wagesDollars / jobs;

  // FICA Social Security: 6.2% on min(avgWage, cap) per employee
  const ssTaxable = Math.min(avgWage, federal.fica_ss_wage_cap);
  const ficaSS = ssTaxable * federal.fica_ss_rate * jobs;

  // FICA Medicare: 1.45% on all wages (uncapped)
  const ficaMedicare = wagesDollars * federal.fica_medicare_rate;

  // FUTA: 0.6% on first $7,000 per employee
  const futaTaxable = Math.min(avgWage, federal.futa_wage_base);
  const futa = futaTaxable * federal.futa_rate * jobs;

  // SUTA: state avg rate on min(avgWage, state wage base) per employee
  let suta = 0;
  if (stateRates.suta_avg_rate && stateRates.suta_wage_base) {
    const sutaTaxable = Math.min(avgWage, stateRates.suta_wage_base);
    suta = sutaTaxable * stateRates.suta_avg_rate * jobs;
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

  const fed = (ficaSS + ficaMedicare + futa) / 1e6;
  const st = (suta + sdi + pfml) / 1e6;
  return { federal: fed, state: st, total: fed + st };
}

/**
 * Value of a tax table at wage w: linear interpolation on an evenly spaced
 * wage grid, extrapolating the last segment's marginal rate above the grid.
 */
export function taxAtWage(table, grid, w) {
  if (!table || !grid || !(w > 0)) return 0;
  const { min, max, step } = grid;
  const last = table.length - 1;
  if (w >= max) return table[last] + (table[last] - table[last - 1]) * (w - max) / step;
  const x = (Math.max(w, min) - min) / step;
  const i = Math.floor(x);
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

/**
 * Household income taxes, per worker, split by level of government ($M).
 *
 * Each job's average cash wage is taxed as the income of a single filer with
 * no dependents, using 2025 federal and state tax tables by wage level
 * (incomeTaxRates.json, generated by scripts/build_income_tax_tables.py from
 * verified 2025 schedules, including state phase-outs, recaptures and
 * federal-tax deductions) plus a typical local wage-tax rate where local
 * income taxes are common. This replaces an average ratio of all personal
 * taxes to wages, which overstates taxes at casino wage levels because it
 * carries capital-income taxes and progressivity from higher-income households.
 *
 * Limitations: ignores household composition, refundable credits (EITC),
 * itemized deductions and the 2025-2028 federal deductions for qualified tips
 * and overtime; treats each job as one worker.
 *
 * Falls back to the BEA personal-current-tax ratio (method 'bea_ratio') when
 * no table is available for the state.
 */
export function calculateIncomeTaxDetail(wages, jobs, incomeTax, stateName, fallbackRates = null) {
  const zero = { federal: 0, state: 0, local: 0, stateLocal: 0, total: 0, method: 'none' };
  if (!wages || wages <= 0) return zero;

  const st = incomeTax?.states?.[stateName];
  if (!st || !incomeTax?.federal?.tax || !jobs || jobs <= 0) {
    const ratio = fallbackRates?.household_tax_ratio;
    if (!ratio) return zero;
    const total = wages * ratio;
    return { federal: 0, state: 0, local: 0, stateLocal: 0, total, method: 'bea_ratio' };
  }

  const grid = incomeTax.wageGrid;
  const w = (wages * 1e6) / jobs;   // average cash wage per job ($)
  const toM = (perJob) => (perJob * jobs) / 1e6;
  const federal = toM(taxAtWage(incomeTax.federal.tax, grid, w));
  const state = toM(taxAtWage(st.state, grid, w));
  const local = toM(taxAtWage(st.local, grid, w));
  return { federal, state, local, stateLocal: state + local, total: federal + state + local, method: 'per_worker' };
}

/**
 * Calculate household taxes using BEA personal current tax ratio.
 * Applies the state-specific ratio of (personal current taxes / wages) to wages.
 *
 * Includes: federal + state + local income taxes, motor vehicle licenses,
 * personal property taxes. Does NOT include real estate taxes, sales taxes
 * (those are TOPI), or FICA (separate payroll category).
 *
 * @param {number} wages - Cash wages and salaries in $M
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
 * Format currency (millions, with auto-scale to billions for large values)
 */
export function formatCurrency(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '-';
  if (Math.abs(value) >= 1000) {
    return '$' + formatNumber(value / 1000, decimals) + 'B';
  }
  return '$' + formatNumber(value, decimals) + 'M';
}

/**
 * Format jobs count
 */
export function formatJobs(value) {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return Math.round(value).toLocaleString('en-US');
}
