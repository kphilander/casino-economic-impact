/**
 * Stripe Checkout Session Creator
 *
 * Serverless function to create a Stripe Checkout session for Pro tier purchase.
 * Deploy to Netlify Functions, Vercel, or similar.
 *
 * Required environment variables:
 * - STRIPE_SECRET_KEY: Your Stripe secret key
 * - STRIPE_PRICE_ID: The Price ID for the Pro tier product
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the origin for redirect URLs
    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'http://localhost:5173';

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      // Collect customer email for license delivery
      customer_creation: 'always',
      // Custom metadata
      metadata: {
        product: 'casino-impact-pro',
      },
    });

    // Return the checkout URL
    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message,
    });
  }
}

// For Netlify Functions format
export const config = {
  runtime: 'edge',
};
