/**
 * Design tokens — single source of truth.
 *
 * Visual language: a premium "consulting deluxe" system — deep navy ink, a
 * brass/gold signature accent for emphasis and headline data, a richer and
 * contrast-safe Direct/Indirect/Induced ramp, and a dark hero band for the
 * headline result. Import from here rather than hard-coding hex values.
 */

// Brand ink + navy
export const INK = '#0e1d31';        // deep navy-black, display headings
export const NAVY = '#1a365d';       // primary brand navy
export const NAVY_DARK = '#0f2440';  // pressed/active navy
export const HERO_FROM = '#16294370'; // (unused token kept for reference)

// Signature accent — brass/gold. Used sparingly for emphasis + key data.
export const BRASS = '#b7892f';
export const BRASS_LIGHT = '#d9af5e'; // for text on dark navy
export const BRASS_SOFT = '#f4ecd8';

// Interactive accent (links / active states)
export const ACCENT = '#2563a8';
export const ACCENT_SOFT = '#e9f0f9';

// Neutral scale
export const PAPER = '#f5f6f8';      // page canvas
export const SURFACE = '#ffffff';
export const HAIRLINE = '#e3e7ec';
export const MUTED = '#5c6776';       // secondary text (darker = better contrast)
export const FAINT = '#8b95a3';

/**
 * Effect colors — a richer navy→steel ramp for chart FILLS (Direct / Indirect /
 * Induced). For text, use EFFECT_TEXT (darker, WCAG-AA friendly).
 */
export const EFFECT = {
  direct: '#1a365d',
  indirect: '#3a78a8',
  induced: '#7aa9cb',
};
export const EFFECT_TEXT = {
  direct: '#1a365d',
  indirect: '#2f5d86',
  induced: '#3f6f8e',
};

// Signal colors
export const HIGHLIGHT = '#b7892f';   // brass — multipliers / reference marks
export const POSITIVE = '#2f7a55';
export const NEGATIVE = '#b0432f';

/** Ordered categorical palette for revenue streams / multi-series charts. */
export const SERIES = ['#1a365d', '#3a78a8', '#7aa9cb', '#b7892f', '#3f6049', '#7a6a8a'];

export const STREAM_COLORS = {
  gaming: '#1a365d',
  food: '#3a78a8',
  lodging: '#5a91bb',
  other: '#7aa9cb',
  marketing: '#3f6049',
  tech: '#b7892f',
};

// Recharts shared styling
export const GRID_STROKE = '#eaedf1';
export const AXIS_TICK = { fill: MUTED, fontSize: 11 };

export const EFFECT_ORDER = [
  { key: 'direct', label: 'Direct', color: EFFECT.direct },
  { key: 'indirect', label: 'Indirect', color: EFFECT.indirect },
  { key: 'induced', label: 'Induced', color: EFFECT.induced },
];
