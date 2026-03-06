/**
 * Stripe Checkout Session Creator - Netlify Functions format
 */

const Stripe = require('stripe');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check for Stripe keys
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Stripe not configured' }),
    };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    // Get the origin for redirect URLs
    const origin = event.headers.origin || event.headers.referer?.replace(/\/$/, '') || 'https://dulcet-tulumba-2aab15.netlify.app';

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
      success_url: `${origin}/tools/economic-impact/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/tools/economic-impact/`,
      customer_creation: 'always',
      metadata: {
        product: 'casino-impact-pro',
      },
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to create checkout session',
        message: error.message,
      }),
    };
  }
};
