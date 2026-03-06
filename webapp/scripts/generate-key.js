#!/usr/bin/env node
/**
 * Standalone License Key Generator
 *
 * Usage:
 *   node generate-key.js              # Generate 1-year license
 *   node generate-key.js 180          # Generate 6-month license
 *   node generate-key.js 730          # Generate 2-year license
 *
 * The generated key can be manually given to customers for bespoke sales
 * or used for testing purposes.
 */

const LICENSE_SALT = 'casino-impact-pro-2024';

function generateChecksum(input) {
  let hash = 0;
  const str = input + LICENSE_SALT;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(5, '0').slice(0, 5);
}

function generateLicenseKey(daysValid = 365) {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + daysValid);
  const year = expiry.getFullYear();
  const month = String(expiry.getMonth() + 1).padStart(2, '0');
  const day = String(expiry.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  return `PRO-${dateStr}-${generateChecksum('PRO' + dateStr)}`;
}

function formatDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Parse command line argument
const days = process.argv[2] ? parseInt(process.argv[2]) : 365;

if (isNaN(days) || days <= 0) {
  console.error('Error: Please provide a valid number of days');
  console.error('Usage: node generate-key.js [days]');
  process.exit(1);
}

const key = generateLicenseKey(days);

console.log('\n========================================');
console.log('   Casino Impact Calculator License');
console.log('========================================\n');
console.log(`License Key: ${key}`);
console.log(`Valid for:   ${days} days`);
console.log(`Expires:     ${formatDate(days)}`);
console.log('\n========================================\n');
