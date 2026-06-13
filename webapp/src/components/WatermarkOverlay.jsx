/**
 * Watermark Overlay Component
 *
 * A single, restrained diagonal wordmark for free-tier users — present enough
 * to mark evaluation use, light enough not to fight the dashboard.
 */

import React from 'react';

export default function WatermarkOverlay({ show }) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-30 overflow-hidden flex items-center justify-center"
      aria-hidden="true"
    >
      <span
        className="select-none whitespace-nowrap font-display font-semibold tracking-wide"
        style={{
          transform: 'rotate(-24deg)',
          fontSize: 'clamp(2.5rem, 9vw, 7rem)',
          color: '#0e1d31',
          opacity: 0.04,
        }}
      >
        Evaluation · Not for Commercial Use
      </span>
    </div>
  );
}
