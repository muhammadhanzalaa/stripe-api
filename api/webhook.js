const axios = require('axios');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const getRawBody = require('raw-body');

// Meta CAPI ke liye hashing function
function hashData(data) {
  if (!data) return null;
  return crypto.createHash('sha256').update(data.trim().toLowerCase()).digest('hex');
}

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

    // Name Parsing Logic with Safe Fallback for Single Names
    const fullName = session.shipping_details?.name || session.customer_details?.name || "Customer";
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "Customer";
    
    // 🔥 FIX: Agar last_name blank ho toh '.' bhejain taake Validation Error na aaye
    const lastName = nameParts.slice(1).join(' ') || ".";

    const orderCurrency = session.currency ? session.currency.toUpperCase() : "EUR";
    const productName = session.metadata?.product_name || "Product";
    const customerEmail = session.customer_details?.email;

    let stripeLineItems;
    try {
      // ✅ Stripe se sare line items fetch karo
      stripeLineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
    } catch (stripeErr) {
      console.error("❌ Stripe Line Items Fetch Error:", stripeErr.message);
      stripeLineItems = { data: [] };
    }

    // ✅ Har Stripe line item ko alag Shopify line item banao
    const shopifyLineItems = stripeLineItems.data.length > 0 
      ? stripeLineItems.data.map(item => ({
          title: item.description || productName,
          price: (item.amount_total / 100).toFixed(2),
          quantity: item.quantity || 1
        }))
      : [{ title: productName, price: (session.amount_total / 100).toFixed(2), quantity: 1 }];

    // ✅ Note mein bhi sare variants clearly likho owner ke liye
    const variantsSummary = stripeLineItems.data.length > 0
      ? stripeLineItems.data.map(item => `${item.description} x${item.quantity}`).join(' | ')
      : productName;

    // STEP A: SHOPIFY ORDER CREATION FLOW
    try {
      const orderData = {
        order: {
          email: customerEmail,
          send_receipt: true, // Automatically triggers the customer confirmation email
          send_fulfillment_receipt: true,
          financial_status: "paid",
          currency: orderCurrency,
          line_items: shopifyLineItems,
          customer: {
            email: customerEmail,
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

      // Shopify Admin API request payload trigger
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

      console.log("✅ Shopify Order Created successfully & Confirmation Email triggered!");

    } catch (shopifyError) {
      console.error("❌ Shopify Order Creation Failed Error Log:", shopifyError.response ? JSON.stringify(shopifyError.response.data) : shopifyError.message);
    }

    // STEP B: META CONVERSIONS API (CAPI) FLOW
    try {
      const metaPixelId = process.env.META_PIXEL_ID;
      const metaAccessToken = process.env.META_ACCESS_TOKEN;

      if (metaPixelId && metaAccessToken) {
        const emailHashed = hashData(customerEmail);
        const firstNameHashed = hashData(firstName);
        const lastNameHashed = hashData(lastName);
        const phoneHashed = hashData(session.customer_details?.phone);
        const countryHashed = hashData(session.shipping_details?.address?.country || session.customer_details?.address?.country);

        const clientIp = session.metadata?.client_ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const clientUserAgent = session.metadata?.client_user_agent || req.headers['user-agent'];

        const metaPayload = {
          data: [
            {
              event_name: "Purchase",
              event_time: Math.floor(Date.now() / 1000),
              event_id: session.id,
              event_source_url: `https://${process.env.SHOPIFY_STORE_URL || ''}`,
              action_source: "website",
              user_data: {
                em: emailHashed ? [emailHashed] : [],
                fn: firstNameHashed ? [firstNameHashed] : [],
                ln: lastNameHashed ? [lastNameHashed] : [],
                ph: phoneHashed ? [phoneHashed] : [],
                country: countryHashed ? [countryHashed] : [],
                client_ip_address: clientIp,
                client_user_agent: clientUserAgent
              },
              custom_data: {
                currency: orderCurrency.toLowerCase(),
                value: session.amount_total / 100,
                content_type: "product",
                contents: stripeLineItems.data.map(item => ({
                  id: item.price?.product || "product_id",
                  quantity: item.quantity || 1,
                  item_price: item.amount_total / 100
                }))
              }
            }
          ]
        };

        await axios.post(
          `https://graph.facebook.com/v19.0/${metaPixelId}/events?access_token=${metaAccessToken}`,
          metaPayload,
          { headers: { 'Content-Type': 'application/json' } }
        );

        console.log("🔥 Meta CAPI Purchase Event Sent Successfully!");
      } else {
        console.log("⚠️ Meta Pixel ID or Access Token missing in Env. Skipping CAPI.");
      }
    } catch (metaError) {
      console.error("❌ Meta CAPI Process Error Log:", metaError.response ? JSON.stringify(metaError.response.data) : metaError.message);
    }
  }

  res.status(200).json({ received: true });
};
