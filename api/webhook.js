const axios = require('axios');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const getRawBody = require('raw-body');

// 1. Vercel Config
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

// 2. Main Handler Function
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook Signature Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      const fullName = session.shipping_details?.name || session.customer_details?.name || "Customer";
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "Customer";
      const lastName = nameParts.slice(1).join(' ') || "";

      const orderCurrency = session.currency ? session.currency.toUpperCase() : "EUR";
      const productName = session.metadata?.product_name || "Product";

      // ✅ Stripe se sare line items fetch karo
      const stripeLineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });

      // ✅ Har Stripe line item ko alag Shopify line item banao
      const shopifyLineItems = stripeLineItems.data.map(item => ({
        title: item.description || productName,
        price: (item.amount_total / 100).toFixed(2),
        quantity: item.quantity || 1
      }));

      // ✅ Note mein bhi sare variants clearly likho owner ke liye
      const variantsSummary = stripeLineItems.data
        .map(item => `${item.description} x${item.quantity}`)
        .join(' | ');

      const orderData = {
        order: {
          email: session.customer_details?.email,
          send_receipt: true,
          financial_status: "paid",
          currency: orderCurrency,

          // ✅ Alag alag line items — Shopify order page pe sab dikhe ga
          line_items: shopifyLineItems,

          customer: {
            email: session.customer_details?.email,
            first_name: firstName,
            last_name: lastName
          },
          shipping_address: {
            address1: session.shipping_details?.address?.line1 || "",
            address2: session.shipping_details?.address?.line2 || "",
            city: session.shipping_details?.address?.city || "",
            province: session.shipping_details?.address?.state || "",
            zip: session.shipping_details?.address?.postal_code || "",
            country: session.shipping_details?.address?.country || "",
            first_name: firstName,
            last_name: lastName,
            phone: session.customer_details?.phone || ""
          },
          billing_address: {
            address1: session.customer_details?.address?.line1 || session.shipping_details?.address?.line1 || "",
            city: session.customer_details?.address?.city || session.shipping_details?.address?.city || "",
            zip: session.customer_details?.address?.postal_code || session.shipping_details?.address?.postal_code || "",
            country: session.customer_details?.address?.country || session.shipping_details?.address?.country || "",
            first_name: firstName,
            last_name: lastName
          },

          // ✅ Owner ke liye note mein sare variants clearly
          note: `Order from Stripe. Items: ${variantsSummary}`,
          inventory_behaviour: "decrement_ignoring_policy"
        }
      };

      const rawShopifyUrl = process.env.SHOPIFY_STORE_URL || "";
      const shopifyUrl = rawShopifyUrl.replace('https://', '').replace(/\/$/, '');
      const token = process.env.SHOPIFY_CLIENT_SECRET;

      if (!token || !shopifyUrl) {
        throw new Error("Missing Shopify Configuration in Environment Variables");
      }

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

      console.log("✅ Shopify Order Created & Email Sent!");

    } catch (err) {
      console.error("❌ Shopify API Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
  }

  res.status(200).json({ received: true });
};
