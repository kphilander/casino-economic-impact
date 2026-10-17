/**
 * CPI-U annual averages (BLS series CUUR0000SA0). The jobs satellite uses 2023
 * QCEW jobs per dollar of 2023 output, so revenue is converted to 2023
 * dollars before jobs are computed. Dollar results stay in the dollars of the
 * revenue inputs; the 2019 StateIO year sets only the interindustry structure.
 */
export const CPI_BASE_YEAR = 2023;

export const CPI: Record<number, number> = {
  2019: 255.657,
  2020: 258.811,
  2021: 270.970,
  2022: 292.655,
  2023: 304.702,
  2024: 313.689,
  2025: 321.943,
};

export const CPI_YEARS = Object.keys(CPI).map(Number).sort((a, b) => a - b);
export const LATEST_CPI_YEAR = CPI_YEARS[CPI_YEARS.length - 1];

/** Factor converting dollars of `year` to 2023 dollars; later years use the latest complete average. */
export function deflator(year: number | null | undefined): number {
  const y = year != null && CPI[year] ? year : LATEST_CPI_YEAR;
  return CPI[CPI_BASE_YEAR] / CPI[y];
}
