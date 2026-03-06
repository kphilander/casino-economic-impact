/**
 * Template Filler Utility
 *
 * Uses docxtemplater to fill PPTX templates with placeholder data.
 * Reads a user-uploaded PPTX file, finds {placeholders}, and replaces them with values.
 */

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { formatNumber, formatCurrency, formatJobs } from './calculations';

/**
 * Fill a PPTX template with data
 * @param {File} templateFile - The uploaded PPTX file
 * @param {Object} data - Key-value pairs for placeholder replacement
 * @returns {Promise<Blob>} - The filled PPTX as a blob
 */
export async function fillTemplate(templateFile, data) {
  // Read the file as ArrayBuffer
  const arrayBuffer = await templateFile.arrayBuffer();

  // Create a PizZip instance
  const zip = new PizZip(arrayBuffer);

  // Create a Docxtemplater instance
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Don't throw on undefined placeholders - just leave them empty
    nullGetter: () => ''
  });

  // Render the document with data
  doc.render(data);

  // Generate output as blob
  const output = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  });

  return output;
}

/**
 * Build the template data object from results and inputs
 * @param {Object} results - Calculation results
 * @param {Object} inputs - User inputs (state, revenues, etc.)
 * @param {Object} authorInfo - Author information
 * @returns {Object} - Data ready for template filling
 */
export function buildTemplateData(results, inputs, authorInfo = {}) {
  // Calculate total revenue
  const totalRevenue = Object.values(inputs.revenues || {}).reduce((sum, v) => sum + (v || 0), 0);

  return {
    // Basic info
    state: inputs.state || '',
    date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    total_revenue: formatCurrency(totalRevenue),
    analysis_type: inputs.useGamblingSpecific
      ? 'Gambling-Specific Analysis (NAICS 7132)'
      : 'Blended Recreation Analysis (NAICS 713)',

    // Key metrics - totals
    total_output: formatCurrency(results.totals.output.total),
    total_gdp: formatCurrency(results.totals.gdp.total),
    total_jobs: formatJobs(results.totals.employment.total),
    total_wages: formatCurrency(results.totals.wages.total),

    // Multipliers
    output_multiplier: formatNumber(results.multipliers.output, 2) + 'x',
    gdp_multiplier: formatNumber(results.multipliers.gdp, 2) + 'x',
    employment_multiplier: formatNumber(results.multipliers.employment, 2),
    wages_multiplier: formatNumber(results.multipliers.wages, 2) + 'x',

    // Direct effects
    direct_output: formatCurrency(results.totals.output.direct),
    direct_gdp: formatCurrency(results.totals.gdp.direct),
    direct_jobs: formatJobs(results.totals.employment.direct),
    direct_wages: formatCurrency(results.totals.wages.direct),

    // Indirect effects
    indirect_output: formatCurrency(results.totals.output.indirect),
    indirect_gdp: formatCurrency(results.totals.gdp.indirect),
    indirect_jobs: formatJobs(results.totals.employment.indirect),
    indirect_wages: formatCurrency(results.totals.wages.indirect),

    // Induced effects
    induced_output: formatCurrency(results.totals.output.induced),
    induced_gdp: formatCurrency(results.totals.gdp.induced),
    induced_jobs: formatJobs(results.totals.employment.induced),
    induced_wages: formatCurrency(results.totals.wages.induced),

    // Author info
    author_name: authorInfo.name || '',
    author_title: authorInfo.title || '',
    author_institution: authorInfo.institution || '',
    author_bio: authorInfo.bio || '',
    author_email: authorInfo.email || '',
    author_phone: authorInfo.phone || ''
  };
}

/**
 * Fill template and trigger download
 * @param {File} templateFile - The uploaded PPTX template
 * @param {Object} results - Calculation results
 * @param {Object} inputs - User inputs
 * @param {Object} authorInfo - Author information
 * @returns {Promise<string>} - The filename of the downloaded file
 */
export async function fillTemplateAndDownload(templateFile, results, inputs, authorInfo = {}) {
  // Build the data object
  const data = buildTemplateData(results, inputs, authorInfo);

  // Fill the template
  const filledBlob = await fillTemplate(templateFile, data);

  // Create filename
  const stateName = (inputs.state || 'Report').replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Economic_Impact_${stateName}_${dateStr}.pptx`;

  // Trigger download
  const url = URL.createObjectURL(filledBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}
