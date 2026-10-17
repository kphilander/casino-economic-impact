/** Product naming and citation, used by the masthead and footer. */
export const BRAND = {
  productName: 'GEMS',
  productFullName: 'Gaming Economic Modeling System',
  modelVersion: '2026',
  descriptor: 'Casino Economic Impact Model',
  publisher: 'GP Consulting',
  email: 'info@gamblingpolicy.com',
  url: 'https://gamblingpolicy.com/tools/economic-impact/',
  repository: 'https://github.com/kphilander/casino-economic-impact',
  citationYear: '2026',
};

export const PRODUCT_NAME_VERSIONED = `${BRAND.productName} ${BRAND.modelVersion}`;

/** APA-style software citation. */
export function suggestedCitation(): string {
  return `Simeon-Rose, K. (${BRAND.citationYear}). ${BRAND.productName}: ${BRAND.productFullName} (Version ${BRAND.modelVersion}) [Computer software]. ${BRAND.publisher}. ${BRAND.url}`;
}
