/**
 * Single source of truth for product naming, versioning, and branding.
 *
 * To rename the product or bump the model version, edit this file only —
 * every user-facing surface (page header, meta tags, reports, footer)
 * pulls from these constants.
 *
 * The model version tracks the release edition year. Bump it when a new
 * edition is published.
 */

export const BRAND = {
  // Product identity
  productName: 'GEMS',
  productFullName: 'Gaming Economic Modeling System',
  modelVersion: '2026',
  // Descriptive phrase kept alongside the product name for clarity and search
  descriptor: 'Casino Economic Impact Model',

  // Publisher identity
  publisher: 'GP Consulting',
  publisherTagline: 'Gaming Policy Research & Economic Analysis',
  email: 'info@gamblingpolicy.com',
  url: 'https://gamblingpolicy.com/tools/economic-impact/',

  // Year the current edition was published (for citations)
  citationYear: '2026',
};

// e.g. "GEMS 2026"
export const PRODUCT_NAME_VERSIONED = `${BRAND.productName} ${BRAND.modelVersion}`;

// e.g. "GEMS 2026 — Gaming Economic Modeling System"
export const PRODUCT_TITLE = `${PRODUCT_NAME_VERSIONED} — ${BRAND.productFullName}`;

/**
 * Suggested citation for reports and the site footer.
 * APA-style software citation.
 */
export function getSuggestedCitation() {
  return `Philander, K. (${BRAND.citationYear}). ${BRAND.productName}: ${BRAND.productFullName} (Version ${BRAND.modelVersion}) [Computer software]. ${BRAND.publisher}. ${BRAND.url}`;
}
