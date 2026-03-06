/**
 * Watermark Overlay Component
 *
 * Displays a semi-transparent watermark across the dashboard
 * for free-tier users to indicate evaluation/non-commercial use.
 */

import React from 'react';

export default function WatermarkOverlay({ show }) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-30 overflow-hidden"
      aria-hidden="true"
    >
      {/* Multiple watermark instances for coverage */}
      <div className="absolute inset-0 flex flex-col justify-around">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex justify-around -rotate-12"
            style={{ transform: `rotate(-12deg) translateY(${row * 20}px)` }}
          >
            {[0, 1, 2].map((col) => (
              <span
                key={col}
                className="text-gray-400 opacity-[0.08] text-4xl md:text-5xl lg:text-6xl font-bold whitespace-nowrap select-none"
              >
                For Non-Commercial Use
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
