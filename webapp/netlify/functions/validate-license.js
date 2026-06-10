/**
 * Server-Side License Validation - Netlify Functions format
 *
 * Validates a license key's checksum without exposing the salt in the
 * client bundle. The client performs only format/expiry parsing; the
 * checksum check happens here.
 *
 * Required environment variables:
 * - LICENSE_SALT: Secret salt for license key checksums (falls back to the
 *   legacy value so keys issued before the env var was set remain valid)
 */

const LICENSE_SALT = process.env.LICENSE_SALT || 'casino-impact-pro-2024';

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

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  let key = null;

  if (event.httpMethod === 'GET') {
    key = (event.queryStringParameters || {}).key;
  } else if (event.httpMethod === 'POST') {
    try {
      key = JSON.parse(event.body || '{}').key;
    } catch (e) {
      return jsonResponse(400, { valid: false, error: 'Invalid request body' });
    }
  } else {
    return jsonResponse(405, { valid: false, error: 'Method not allowed' });
  }

  if (!key || typeof key !== 'string') {
    return jsonResponse(400, { valid: false, error: 'No license key provided' });
  }

  const trimmedKey = key.trim().toUpperCase();

  const match = trimmedKey.match(/^(PRO)-(\d{8})-([A-Z0-9]{5})$/);
  if (!match) {
    return jsonResponse(200, { valid: false, error: 'Invalid license format' });
  }

  const [, prefix, dateStr, checksum] = match;

  const expectedChecksum = generateChecksum(prefix + dateStr);
  if (checksum !== expectedChecksum) {
    return jsonResponse(200, { valid: false, error: 'Invalid license key' });
  }

  const year = parseInt(dateStr.slice(0, 4));
  const month = parseInt(dateStr.slice(4, 6)) - 1;
  const day = parseInt(dateStr.slice(6, 8));
  const expiresAt = new Date(year, month, day, 23, 59, 59);

  if (expiresAt < new Date()) {
    return jsonResponse(200, {
      valid: false,
      error: 'License has expired',
      expiresAt: expiresAt.toISOString(),
    });
  }

  return jsonResponse(200, {
    valid: true,
    expiresAt: expiresAt.toISOString(),
  });
};
