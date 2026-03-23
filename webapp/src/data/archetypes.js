/**
 * Casino operating archetypes from the Nevada Gaming Control Board, 2024 Gaming Abstract.
 * Each archetype defines empirical employment density and revenue mix benchmarks
 * for a specific property type/market position.
 *
 * empPerMillionGGR: Total property FTEs per $1M of gaming revenue (all departments)
 * nonGamingMult:    Total revenue / gaming revenue ratio
 * revMix:           Percentage breakdown of total revenue by department
 */

export const ARCHETYPES = {
  mega_resort: {
    key: "mega_resort",
    name: "Mega Resort (LV Strip $72M+)",
    empPerMillionGGR: 16.1,
    nonGamingMult: 3.88,
    revMix: { gaming: 25.8, rooms: 34.2, food: 18.8, bev: 7.5, other: 13.7 },
  },
  mid_strip: {
    key: "mid_strip",
    name: "Mid-Scale Strip ($1M-$72M)",
    empPerMillionGGR: 23.2,
    nonGamingMult: 3.11,
    revMix: { gaming: 32.2, rooms: 31.1, food: 13.5, bev: 6.8, other: 16.4 },
  },
  downtown_urban: {
    key: "downtown_urban",
    name: "Downtown Urban Casino ($12M+)",
    empPerMillionGGR: 12.9,
    nonGamingMult: 2.05,
    revMix: { gaming: 48.9, rooms: 20.6, food: 11.2, bev: 11.5, other: 7.9 },
  },
  laughlin_river: {
    key: "laughlin_river",
    name: "River/Border Destination (Laughlin)",
    empPerMillionGGR: 12.0,
    nonGamingMult: 1.82,
    revMix: { gaming: 54.9, rooms: 17.6, food: 9.7, bev: 10.7, other: 7.1 },
  },
  locals_boulder: {
    key: "locals_boulder",
    name: "Locals Casino (Boulder Strip)",
    empPerMillionGGR: 6.3,
    nonGamingMult: 1.47,
    revMix: { gaming: 68.0, rooms: 9.8, food: 10.7, bev: 6.9, other: 4.7 },
  },
  suburban_locals: {
    key: "suburban_locals",
    name: "Suburban Locals Casino",
    empPerMillionGGR: 6.7,
    nonGamingMult: 1.54,
    revMix: { gaming: 64.7, rooms: 10.1, food: 11.5, bev: 5.9, other: 7.8 },
  },
  border_town: {
    key: "border_town",
    name: "Border Town (Wendover)",
    empPerMillionGGR: 10.6,
    nonGamingMult: 1.56,
    revMix: { gaming: 64.1, rooms: 12.5, food: 10.0, bev: 8.8, other: 4.5 },
  },
  reno_large: {
    key: "reno_large",
    name: "Large Regional Resort (Reno $36M+)",
    empPerMillionGGR: 18.5,
    nonGamingMult: 2.60,
    revMix: { gaming: 38.4, rooms: 25.9, food: 18.2, bev: 9.8, other: 7.6 },
  },
  reno_mid: {
    key: "reno_mid",
    name: "Mid-Size Regional ($12M-$36M)",
    empPerMillionGGR: 10.4,
    nonGamingMult: 1.46,
    revMix: { gaming: 68.3, rooms: 5.4, food: 12.1, bev: 8.5, other: 5.6 },
  },
  reno_small: {
    key: "reno_small",
    name: "Small Regional ($1M-$12M)",
    empPerMillionGGR: 7.5,
    nonGamingMult: 1.11,
    revMix: { gaming: 90.2, rooms: 0.0, food: 1.0, bev: 6.8, other: 2.1 },
  },
  lake_tahoe: {
    key: "lake_tahoe",
    name: "Lake Tahoe Resort",
    empPerMillionGGR: 13.4,
    nonGamingMult: 2.25,
    revMix: { gaming: 44.4, rooms: 22.4, food: 11.5, bev: 10.5, other: 11.2 },
  },
  rural: {
    key: "rural",
    name: "Rural / Small Town",
    empPerMillionGGR: 11.7,
    nonGamingMult: 1.47,
    revMix: { gaming: 68.2, rooms: 7.3, food: 10.9, bev: 6.0, other: 7.6 },
  },
  casino_only: {
    key: "casino_only",
    name: "Casino Only (Gaming Revenue Only)",
    empPerMillionGGR: 6.3,
    nonGamingMult: 1.0,
    revMix: { gaming: 100.0, rooms: 0.0, food: 0.0, bev: 0.0, other: 0.0 },
  },
};

export const ARCHETYPE_LIST = Object.values(ARCHETYPES);

/**
 * Calculate archetype-based employment estimate from gaming revenue.
 * Returns total property FTEs based on empirical Nevada Gaming Abstract ratios.
 *
 * @param {number} gamingRevM - Gaming revenue in $M (current year dollars)
 * @param {string} archetypeKey - Archetype key from ARCHETYPES
 * @returns {number} Estimated total FTEs, or 0 if archetype not found
 */
export function calculateArchetypeEmployment(gamingRevM, archetypeKey) {
  const arch = ARCHETYPES[archetypeKey];
  if (!arch || !gamingRevM || gamingRevM <= 0) return 0;
  return Math.round(gamingRevM * arch.empPerMillionGGR);
}
