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
  // Method Check
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

  // 3. Payment Successful Logic
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      const fullName = session.shipping_details?.name || session.customer_details?.name || "Customer";
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "Customer";
      const lastName = nameParts.slice(1).join(' ') || "";

      // ✅ FIX 1: Currency session se lo, USD hardcoded nahi
      const orderCurrency = session.currency ? session.currency.toUpperCase() : "EUR";

      // ✅ FIX 2: Product name + variant title theek kiya
      const productName = session.metadata?.product_name || "Product";
      const variantName = session.metadata?.variant_name || "";
      const lineItemTitle = variantName ? `${productName} - ${variantName}` : productName;

      const orderData = {
        order: {
          email: session.customer_details?.email,
          send_receipt: true,
          financial_status: "paid",
          currency: orderCurrency, // ✅ FIX 3: Order level pe currency
          
          line_items: [{
            title: lineItemTitle, // ✅ "Product" nahi, actual name
            price: (session.amount_total / 100).toFixed(2),
            currency: orderCurrency, // ✅ line item pe bhi currency
            quantity: 1
          }],
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
          note: `Order from Stripe. Variants: ${session.metadata?.variants || "Standard"}`,
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
