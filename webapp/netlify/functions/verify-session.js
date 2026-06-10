/**
 * Stripe Session Verification - Netlify Functions format
 */

const Stripe = require('stripe');

const LICENSE_SALT = process.env.LICENSE_SALT || 'casino-impact-pro-2024';

/**
 * Generate a checksum for license validation
 */
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

/**
 * Generate a license key expiring 1 year after the purchase date.
 *
 * The expiry is anchored to the Stripe session's creation time (not "now")
 * so that re-verifying the same session always regenerates the identical
 * key — this is what makes the key-recovery flow safe and prevents license
 * extension by revisiting the checkout success URL.
 */
function generateLicenseKey(purchaseDate) {
  const expirationDate = new Date(purchaseDate);
  expirationDate.setFullYear(expirationDate.getFullYear() + 1);

  const year = expirationDate.getFullYear();
  const month = String(expirationDate.getMonth() + 1).padStart(2, '0');
  const day = String(expirationDate.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const prefix = 'PRO';
  const checksum = generateChecksum(prefix + dateStr);

  return { key: `${prefix}-${dateStr}-${checksum}`, expiresAt: expirationDate };
}

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check for Stripe key
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Stripe not configured' }),
    };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // Parse query parameters
  const params = event.queryStringParameters || {};
  const session_id = params.session_id;

  if (!session_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        valid: false,
        error: 'Missing session_id parameter',
      }),
    };
  }

  try {
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Check if payment was successful
    if (session.payment_status === 'paid') {
      // Generate a license key anchored to the purchase date (session.created
      // is a Unix timestamp in seconds)
      const purchaseDate = new Date(session.created * 1000);
      const { key: licenseKey, expiresAt } = generateLicenseKey(purchaseDate);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          valid: true,
          licenseKey,
          email: session.customer_email || session.customer_details?.email,
          expiresAt: expiresAt.toISOString(),
        }),
      };
    } else {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valid: false,
          error: 'Payment not completed',
          status: session.payment_status,
        }),
      };
    }
  } catch (error) {
    console.error('Session verification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        valid: false,
        error: 'Failed to verify session',
        message: error.message,
      }),
    };
  }
};
