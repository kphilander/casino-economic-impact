/**
 * License Validation Utility
 *
 * Validates license keys for the Pro tier.
 *
 * License Format: PRO-YYYYMMDD-XXXXX
 * - PRO: Tier prefix
 * - YYYYMMDD: Expiration date
 * - XXXXX: 5-character checksum
 *
 * Example: PRO-20270209-A7B3C
 *
 * Checksum verification happens server-side (/api/validate-license) so the
 * checksum salt never ships in the client bundle. The client performs only
 * format and expiry checks — used for keys that were already server-validated
 * at activation time.
 */

/**
 * Validate a license key locally (format + expiry only, no checksum).
 * Use validateLicenseRemote() to verify the checksum when activating a key.
 * @param {string} key - License key to validate
 * @returns {{ valid: boolean, error?: string, expiresAt?: Date }}
 */
export function validateLicense(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'No license key provided' };
  }

  const trimmedKey = key.trim().toUpperCase();

  // Check format: PRO-YYYYMMDD-XXXXX
  const match = trimmedKey.match(/^PRO-(\d{8})-[A-Z0-9]{5}$/);
  if (!match) {
    return { valid: false, error: 'Invalid license format' };
  }

  const dateStr = match[1];

  // Parse expiration date
  const year = parseInt(dateStr.slice(0, 4));
  const month = parseInt(dateStr.slice(4, 6)) - 1; // 0-indexed
  const day = parseInt(dateStr.slice(6, 8));
  const expiresAt = new Date(year, month, day, 23, 59, 59);

  // Check if expired
  if (expiresAt < new Date()) {
    return {
      valid: false,
      error: 'License has expired',
      expiresAt
    };
  }

  return {
    valid: true,
    expiresAt
  };
}

/**
 * Validate a license key against the server (full checksum verification).
 * @param {string} key - License key to validate
 * @returns {Promise<{ valid: boolean, error?: string, expiresAt?: Date, networkError?: boolean }>}
 */
export async function validateLicenseRemote(key) {
  // Fail fast on malformed keys without a network round-trip
  const localResult = validateLicense(key);
  if (!localResult.valid) {
    return localResult;
  }

  try {
    const res = await fetch('/api/validate-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key.trim().toUpperCase() })
    });
    const data = await res.json();
    return {
      valid: !!data.valid,
      error: data.error,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined
    };
  } catch (e) {
    return {
      valid: false,
      error: 'Could not reach the license server. Please check your connection and try again.',
      networkError: true
    };
  }
}

/**
 * Check if a license key format looks valid (quick check without full validation)
 * @param {string} key - License key to check
 * @returns {boolean}
 */
export function isValidFormat(key) {
  if (!key || typeof key !== 'string') return false;
  return /^PRO-\d{8}-[A-Z0-9]{5}$/i.test(key.trim());
}

/**
 * Normalize a property name for consistent comparison
 * Removes common words (hotel, casino, resort, the, and), punctuation, extra spaces
 * @param {string} name - Property name to normalize
 * @returns {string} Normalized property name
 */
export function normalizePropertyName(name) {
  if (!name || typeof name !== 'string') return '';

  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')                           // remove punctuation
    .replace(/\b(hotel|casino|resort|and|the|a)\b/gi, '')  // remove common words
    .replace(/\s+/g, ' ')                              // collapse multiple spaces
    .trim();
}

/**
 * Check if a property name matches any in the licensed list
 * @param {string} propertyName - Current property name
 * @param {string[]} licensedProperties - Array of licensed property names
 * @returns {boolean}
 */
export function isPropertyLicensed(propertyName, licensedProperties) {
  if (!propertyName || !licensedProperties || !Array.isArray(licensedProperties)) {
    return false;
  }

  const normalizedCurrent = normalizePropertyName(propertyName);
  if (!normalizedCurrent) return false;

  return licensedProperties.some(p =>
    normalizePropertyName(p) === normalizedCurrent
  );
}

/**
 * Check if download is allowed for a property
 * @param {string} propertyName - Current property name
 * @param {string} licenseKey - License key
 * @param {string[]} licensedProperties - Array of licensed property names
 * @returns {{ allowed: boolean, reason?: string, licensedFor?: string, attempting?: string }}
 */
export function canDownloadForProperty(propertyName, licenseKey, licensedProperties) {
  // 1. Validate license key
  const keyValid = validateLicense(licenseKey);
  if (!keyValid.valid) {
    return { allowed: false, reason: 'invalid_key', error: keyValid.error };
  }

  // 2. If no property name entered, allow (they'll need one for the report anyway)
  if (!propertyName || !propertyName.trim()) {
    return { allowed: true };
  }

  // 3. If no licensed properties stored yet, this is a new license - allow first property
  if (!licensedProperties || licensedProperties.length === 0) {
    return { allowed: true, isNewLicense: true };
  }

  // 4. Check if current property is in licensed list
  if (isPropertyLicensed(propertyName, licensedProperties)) {
    return { allowed: true };
  }

  // 5. Property not licensed
  return {
    allowed: false,
    reason: 'wrong_property',
    licensedFor: licensedProperties[0], // Show first licensed property
    attempting: propertyName
  };
}

/**
 * Get license data from localStorage
 * @returns {{ licenseKey: string|null, licensedProperties: string[], expiresAt: Date|null }}
 */
export function getLicenseData() {
  try {
    const licenseKey = localStorage.getItem('licenseKey');
    const propertiesJson = localStorage.getItem('licensedProperties');
    const licensedProperties = propertiesJson ? JSON.parse(propertiesJson) : [];

    let expiresAt = null;
    if (licenseKey) {
      const result = validateLicense(licenseKey);
      if (result.valid) {
        expiresAt = result.expiresAt;
      }
    }

    return { licenseKey, licensedProperties, expiresAt };
  } catch (e) {
    return { licenseKey: null, licensedProperties: [], expiresAt: null };
  }
}

/**
 * Save license data to localStorage
 * @param {string} licenseKey - License key
 * @param {string[]} licensedProperties - Array of licensed property names
 */
export function saveLicenseData(licenseKey, licensedProperties) {
  if (licenseKey) {
    localStorage.setItem('licenseKey', licenseKey);
  }
  if (licensedProperties && Array.isArray(licensedProperties)) {
    localStorage.setItem('licensedProperties', JSON.stringify(licensedProperties));
  }
}

/**
 * Add a property to the licensed list
 * @param {string} propertyName - Property name to add
 */
export function addLicensedProperty(propertyName) {
  if (!propertyName || !propertyName.trim()) return;

  const { licensedProperties } = getLicenseData();
  const normalized = normalizePropertyName(propertyName);

  // Check if already licensed
  if (!licensedProperties.some(p => normalizePropertyName(p) === normalized)) {
    licensedProperties.push(propertyName.trim());
    localStorage.setItem('licensedProperties', JSON.stringify(licensedProperties));
  }
}

/**
 * Clear all license data from localStorage
 */
export function clearLicenseData() {
  localStorage.removeItem('licenseKey');
  localStorage.removeItem('licensedProperties');
}
