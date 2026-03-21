const axios = require('axios');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const getRawBody = require('raw-body');

// Vercel config for raw body (Stripe verification ke liye zaroori hai)
export const config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    // Stripe se verify karna ke ye real signal hai
    event = stripe.webhooks.constructEvent(
      rawBody, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Jab payment successfully complete ho jaye
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Shopify Order ka Data taiyar karna
    const orderData = {
      order: {
        line_items: [{
          title: session.metadata?.product_name || "Stripe Product",
          price: (session.amount_total / 100).toFixed(2),
          quantity: 1
        }],
        customer: {
          email: session.customer_details?.email,
          first_name: session.customer_details?.name || "Customer"
        },
        shipping_address: {
          address1: session.shipping_details?.address?.line1 || "",
          city: session.shipping_details?.address?.city || "",
          zip: session.shipping_details?.address?.postal_code || "",
          country: session.shipping_details?.address?.country || "",
          first_name: session.customer_details?.name || "Customer"
        },
        // Note mein bundle aur variants ki detail ayegi
        note: `Order from Stripe. Variants: ${session.metadata?.variants || "Standard"}`,
        financial_status: "paid",
        inventory_behaviour: "decrement_ignoring_policy" // Stock manage karne ke liye
      }
    };

    try {
      const shopifyUrl = process.env.SHOPIFY_STORE_URL.replace('https://', '').replace(/\/$/, '');
      const token = process.env.SHOPIFY_CLIENT_SECRET;

      await axios.post(
        `https://${shopifyUrl}/admin/api/2024-01/orders.json`,
        orderData,
        {
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log("✅ Shopify Order Created!");
    } catch (err) {
      console.error("❌ Shopify Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
  }

  // Stripe ko 200 response dena lazmi hai warna wo bar bar bhejta rahega
  res.status(200).json({ received: true });
};
