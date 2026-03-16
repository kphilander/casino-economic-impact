import React from 'react';

export default function SectionHeader({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-3 mb-5 ${className}`}>
      <div className="w-1 h-6 rounded-full bg-gradient-to-b from-[#1a365d] to-[#3182ce]" />
      <h3 className="text-lg font-semibold text-gray-900">{children}</h3>
    </div>
  );
}
