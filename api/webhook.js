const axios = require('axios');
const crypto = require('crypto');
const getRawBody = require('raw-body'); // 🔥 FIX: Isko sabse upar move kar diya hai

// Vercel ke variables ke mutabiq strict binding
const stripeSecret = process.env.STRIPE_SECRET || process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(stripeSecret);
 
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
    // Webhook secret variable fallback ke sath lock kiya hai
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET_LIVE;
    
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error("❌ Webhook Signature Error:", err.message);
    // Isko 200 de rahe hain taake Stripe baar baar fail na kare, par log error karega
    return res.status(200).send(`Webhook Error Handled: ${err.message}`);
  }
 
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(`📦 Processing Checkout Session: ${session.id}`);
 
    // Metadata safely extract karein (Deduplication Sync ke liye)
    const metadata = session.metadata || {};
    const finalEventId = metadata.event_id || session.id; 
    const catalogProductHandle = metadata.product_handle || "non-slip-stair-tread-mats"; 

    // Name Parsing Logic
    const fullName = session.shipping_details?.name || session.customer_details?.name || "Customer";
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "Customer";
    const lastName = nameParts.slice(1).join(' ') || '.'; 
 
    const orderCurrency = session.currency ? session.currency.toUpperCase() : "EUR";
    const productName = metadata.product_name || "Product";
    const customerEmail = session.customer_details?.email || session.customer_email || 'no-email@lonovos.com';
 
    let stripeLineItems;
    try {
      stripeLineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
    } catch (stripeErr) {
      console.error("❌ Stripe Line Items Fetch Error:", stripeErr.message);
      stripeLineItems = { data: [] };
    }
 
    // Har Stripe line item ko alag Shopify line item banao
    const shopifyLineItems = stripeLineItems.data.length > 0
      ? stripeLineItems.data.map(item => ({
          title: item.description || productName,
          price: (item.amount_total / 100).toFixed(2),
          quantity: item.quantity || 1,
          requires_shipping: true,
          fulfillment_service: 'manual'
        }))
      : [{ title: productName, price: (session.amount_total / 100).toFixed(2), quantity: 1, requires_shipping: true, fulfillment_service: 'manual' }];
 
    const variantsSummary = stripeLineItems.data.length > 0
      ? stripeLineItems.data.map(item => `${item.description} x${item.quantity}`).join(' | ')
      : productName;
 
    // ─── 🚀 STEP A: SHOPIFY ORDER CREATION FLOW ───
    try {
      const orderData = {
        order: {
          email: customerEmail,
          send_receipt: true, 
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
            address1: session.shipping_details?.address?.line1 || "Main Street",
            address2: session.shipping_details?.address?.line2 || "",
            city: session.shipping_details?.address?.city || "City",
            province: session.shipping_details?.address?.state || "",
            zip: session.shipping_details?.address?.postal_code || "00000",
            country: session.shipping_details?.address?.country || "US",
            first_name: firstName,
            last_name: lastName,
            phone: session.customer_details?.phone || ""
          },
          billing_address: {
            address1: session.customer_details?.address?.line1 || session.shipping_details?.address?.line1 || "Main Street",
            city: session.customer_details?.address?.city || session.shipping_details?.address?.city || "City",
            zip: session.customer_details?.address?.postal_code || session.shipping_details?.address?.postal_code || "00000",
            country: session.customer_details?.address?.country || session.shipping_details?.address?.country || "US",
            first_name: firstName,
            last_name: lastName
          },
          note: `Order from Stripe Landing Page. Items: ${variantsSummary}. Session: ${session.id}`,
          inventory_behaviour: "decrement_ignoring_policy"
        }
      };
 
      const rawShopifyUrl = process.env.SHOPIFY_STORE_URL || "097904722240.shopifypreview.com";
      const shopifyUrl = rawShopifyUrl.replace('https://', '').replace(/\/$/, '');
      const token = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
 
      if (!token || !shopifyUrl) {
        throw new Error("Missing Shopify Configuration in Environment Variables");
      }
 
      await axios.post(
        `https://${shopifyUrl}/admin/api/2024-10/orders.json`,
        orderData,
        { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } }
      );
 
      console.log("✅ Shopify Order Created successfully & Confirmation Email triggered!");
 
    } catch (shopifyError) {
      console.error("❌ Shopify Order Creation Failed Error Log:", shopifyError.response ? JSON.stringify(shopifyError.response.data) : shopifyError.message);
    }
 
    // ─── 📊 STEP B: META CONVERSIONS API (CAPI) FLOW ───
    try {
      const metaPixelId = process.env.META_PIXEL_ID;
      const metaAccessToken = process.env.META_ACCESS_TOKEN;
 
      if (metaPixelId && metaAccessToken) {
        const emailHashed = hashData(customerEmail);
        const firstNameHashed = hashData(firstName);
        const lastNameHashed = hashData(lastName);
        const phoneHashed = hashData(session.customer_details?.phone);
        const countryHashed = hashData(session.shipping_details?.address?.country || session.customer_details?.address?.country);
 
        const clientIp = metadata.client_ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
        const clientUserAgent = metadata.client_user_agent || req.headers['user-agent'] || null;
 
        const metaPayload = {
          data: [
            {
              event_name: "Purchase",
              event_time: session.created || Math.floor(Date.now() / 1000), 
              event_id: finalEventId, 
              event_source_url: metadata.event_source_url || `https://www.lonovos.com/products/non-slip-stair-tread-mats`,
              action_source: "website",
              user_data: {
                em: emailHashed ? [emailHashed] : [],
                fn: firstNameHashed ? [firstNameHashed] : [],
                ln: lastNameHashed ? [lastNameHashed] : [],
                ph: phoneHashed ? [phoneHashed] : [],
                country: countryHashed ? [countryHashed] : [],
                client_ip_address: clientIp,
                client_user_agent: clientUserAgent,
                fbp: metadata.fbp || null,
                fbc: metadata.fbc || null
              },
              custom_data: {
                currency: orderCurrency.toLowerCase(),
                value: session.amount_total / 100,
                content_type: "product",
                content_ids: [catalogProductHandle],
                contents: [
                  {
                    id: catalogProductHandle,
                    quantity: 1,
                    item_price: session.amount_total / 100
                  }
                ]
              }
            }
          ],
          test_event_code: "TEST84180" 
        };
 
        console.log(`Sending CAPI Data Payload with matching event_id: ${finalEventId}`);
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
