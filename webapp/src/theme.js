/**
 * Design tokens — single source of truth for the "Refined consulting" system.
 *
 * The visual language: a report-grade light surface, navy as ink, blue as a
 * sparingly-used accent, and a muted, data-ink-forward chart palette. Import
 * from here rather than hard-coding hex values so the palette stays coherent
 * and can be tuned in one place.
 */

// Brand ink + accent
export const INK = '#13243b';        // near-black navy, for display headings
export const NAVY = '#1a365d';       // primary brand navy
export const NAVY_DARK = '#11233f';  // pressed/active navy
export const ACCENT = '#2b6cb0';     // blue accent — links, active states, key data
export const ACCENT_SOFT = '#ebf1f8';

// Neutral scale (warm-cool slate)
export const PAPER = '#f7f8fa';      // page canvas
export const SURFACE = '#ffffff';    // cards
export const HAIRLINE = '#e5e8ed';   // 1px borders / rules
export const MUTED = '#6b7785';      // secondary text
export const FAINT = '#9aa4b1';      // tertiary text / captions

/**
 * Effect colors — a muted navy ramp for Direct / Indirect / Induced.
 * Desaturated on purpose so dense tables and charts read as analytical,
 * not decorative.
 */
export const EFFECT = {
  direct: '#1a365d',   // navy
  indirect: '#5278a0', // muted steel
  induced: '#9bb0c8',  // muted light steel
};

// A restrained signal color for multipliers / highlights (muted ochre).
export const HIGHLIGHT = '#b07a2b';
export const POSITIVE = '#2f7a55';   // muted green for positive deltas
export const NEGATIVE = '#b04a3f';   // muted red for negative deltas

/**
 * Ordered categorical palette for revenue streams / multi-series charts.
 * Stays within the navy/steel family with two muted supporting tones so
 * scenario and breakdown charts remain cohesive.
 */
export const SERIES = ['#1a365d', '#5278a0', '#9bb0c8', '#3f6049', '#b07a2b', '#7a6a8a'];

// Effect color keyed by revenue-stream type (used by impact-by-stream views).
export const STREAM_COLORS = {
  gaming: '#1a365d',
  food: '#5278a0',
  lodging: '#7e9cbb',
  other: '#9bb0c8',
  marketing: '#3f6049',
  tech: '#b07a2b',
};

// Recharts shared styling
export const GRID_STROKE = '#eef1f4';
export const AXIS_TICK = { fill: MUTED, fontSize: 11 };

// Ordered list for legends / iteration
export const EFFECT_ORDER = [
  { key: 'direct', label: 'Direct', color: EFFECT.direct },
  { key: 'indirect', label: 'Indirect', color: EFFECT.indirect },
  { key: 'induced', label: 'Induced', color: EFFECT.induced },
];
