/** Display formatting. Dollar amounts in the engine are in $M. */

const nf = (digits: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function money(m: number | null | undefined, digits = 1): string {
  if (m == null || !Number.isFinite(m)) return '–';
  const sign = m < 0 ? '−' : '';
  const a = Math.abs(m);
  if (a >= 1000) return `${sign}$${nf(digits === 0 ? 1 : 2).format(a / 1000)}B`;
  if (a > 0 && a < 0.1) return `${sign}$${nf(0).format(a * 1000)}K`;
  return `${sign}$${nf(digits).format(a)}M`;
}

export function jobs(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–';
  return nf(0).format(Math.round(n));
}

export function pct(x: number | null | undefined, digits = 1): string {
  if (x == null || !Number.isFinite(x)) return '–';
  return `${nf(digits).format(x * 100)}%`;
}

export function ratio(x: number | null | undefined, digits = 2): string {
  if (x == null || !Number.isFinite(x)) return '–';
  return nf(digits).format(x);
}

export function signedPct(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '–';
  const s = pct(Math.abs(x), 1);
  return x > 0.0005 ? `+${s}` : x < -0.0005 ? `−${s}` : '0.0%';
}
