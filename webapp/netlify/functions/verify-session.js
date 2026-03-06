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
 * Generate a license key with 1-year expiration
 */
function generateLicenseKey() {
  const expirationDate = new Date();
  expirationDate.setFullYear(expirationDate.getFullYear() + 1);

  const year = expirationDate.getFullYear();
  const month = String(expirationDate.getMonth() + 1).padStart(2, '0');
  const day = String(expirationDate.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const prefix = 'PRO';
  const checksum = generateChecksum(prefix + dateStr);

  return `${prefix}-${dateStr}-${checksum}`;
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
      // Generate a license key
      const licenseKey = generateLicenseKey();

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
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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
