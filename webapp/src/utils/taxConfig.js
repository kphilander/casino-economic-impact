import { isOnlinePropertyType } from './calculations';

/**
 * Build a tax-config object for calculateGamingTax from a state's tax-rate
 * data. Extracted from App so the dashboard, scenario comparison, and
 * sensitivity analysis all derive gaming tax identically.
 *
 * For online property types, uses the iGaming or sportsBetting sub-config.
 */
export function buildTaxConfig(taxInfo, customRate, slotRevenuePct, propertyType = null) {
  if (!taxInfo) return {};

  let effectiveTaxInfo = taxInfo;
  if (isOnlinePropertyType(propertyType)) {
    const isIGaming = propertyType === 'ONLINE_CASINO';
    const onlineConfig = isIGaming ? taxInfo.iGaming : taxInfo.sportsBetting;
    if (onlineConfig) {
      effectiveTaxInfo = onlineConfig;
    } else {
      return {};
    }
  }

  const config = {};
  if (customRate != null && customRate !== '') {
    config.customRate = parseFloat(customRate);
  } else if (effectiveTaxInfo.rateStructure === 'split_tiered' && effectiveTaxInfo.slotTiers && effectiveTaxInfo.tableTiers) {
    config.slotTiers = effectiveTaxInfo.slotTiers;
    config.tableTiers = effectiveTaxInfo.tableTiers;
    config.slotRevenuePct = (slotRevenuePct || 70) / 100;
  } else if (effectiveTaxInfo.rateStructure === 'tiered' && effectiveTaxInfo.tiers) {
    config.tiers = effectiveTaxInfo.tiers;
  } else if (effectiveTaxInfo.rateStructure === 'split_game_type' && effectiveTaxInfo.slotsRate != null && effectiveTaxInfo.tableRate != null) {
    config.slotsRate = effectiveTaxInfo.slotsRate;
    config.tableRate = effectiveTaxInfo.tableRate;
    config.slotRevenuePct = (slotRevenuePct || 70) / 100;
  } else if (effectiveTaxInfo.slotTableSplit && effectiveTaxInfo.slotsRate != null && effectiveTaxInfo.tableRate != null) {
    config.slotsRate = effectiveTaxInfo.slotsRate;
    config.tableRate = effectiveTaxInfo.tableRate;
    config.slotRevenuePct = (slotRevenuePct || 70) / 100;
  } else if (effectiveTaxInfo.rateStructure === 'flat' && effectiveTaxInfo.flatRate != null) {
    config.flatRate = effectiveTaxInfo.flatRate;
  } else if (effectiveTaxInfo.flatRate != null) {
    config.flatRate = effectiveTaxInfo.flatRate;
  } else if (effectiveTaxInfo.effectiveRate != null) {
    config.flatRate = effectiveTaxInfo.effectiveRate;
  }
  return config;
}
