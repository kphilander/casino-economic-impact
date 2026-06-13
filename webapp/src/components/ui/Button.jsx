import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Flat, report-grade button. Variants map to the design-system button classes
 * defined in index.css (primary navy, secondary outline, ghost, accent blue).
 */
const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  className = '',
  children,
  disabled,
  ...props
}) {
  return (
    <button
      className={`btn btn-${variant} ${SIZES[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        Icon && <Icon size={size === 'lg' ? 20 : 16} />
      )}
      {children}
      {IconRight && !loading && <IconRight size={size === 'lg' ? 20 : 16} />}
    </button>
  );
}
