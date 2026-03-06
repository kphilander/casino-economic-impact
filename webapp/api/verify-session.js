/**
 * Stripe Session Verification
 *
 * Serverless function to verify a Stripe Checkout session and generate a license key.
 * Deploy to Netlify Functions, Vercel, or similar.
 *
 * Required environment variables:
 * - STRIPE_SECRET_KEY: Your Stripe secret key
 * - LICENSE_SALT: Secret salt for license key generation (optional, has default)
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({
      valid: false,
      error: 'Missing session_id parameter',
    });
  }

  try {
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Check if payment was successful
    if (session.payment_status === 'paid') {
      // Generate a license key
      const licenseKey = generateLicenseKey();

      // Return success with license key
      return res.status(200).json({
        valid: true,
        licenseKey,
        email: session.customer_email || session.customer_details?.email,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } else {
      return res.status(200).json({
        valid: false,
        error: 'Payment not completed',
        status: session.payment_status,
      });
    }
  } catch (error) {
    console.error('Session verification error:', error);
    return res.status(500).json({
      valid: false,
      error: 'Failed to verify session',
      message: error.message,
    });
  }
}

// For Netlify Functions format
export const config = {
  runtime: 'edge',
};
