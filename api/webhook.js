const axios = require('axios');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const getRawBody = require('raw-body');

// 1. Config ko upar hi rehne dein
export const config = {
  api: {
    bodyParser: false, // Stripe signature verification ke liye ye zaroori hai
  },
};

// 2. Default function export karein
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Raw body ko read karna
    const rawBody = await getRawBody(req);
    
    // Stripe Signature Verify karna
    event = stripe.webhooks.constructEvent(
      rawBody, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook Signature Error:", err.message);
    // Agar signature galat hai toh 400 bhejte hain
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 3. Payment Successful Logic
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

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
        note: `Order from Stripe. Variants: ${session.metadata?.variants || "Standard"}`,
        financial_status: "paid",
        inventory_behaviour: "decrement_ignoring_policy"
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
      // Order fail hone par bhi hum Stripe ko 200 bhej sakte hain taake wo bar bar signal na bheje
    }
  }

  // Stripe ko batana ke signal mil gaya hai
  res.status(200).json({ received: true });
}
