const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      product_name,
      variant_name,
      image_url,
      price,
      currency,
      country_code,
      customer_email,
      line_items_data,
      // ✅ FIX: ab in teeno ko destructure kar rahe hain taake metadata mein save ho sakein
      fbp,
      fbc,
      event_id
    } = req.body;

    // ✅ STEP 1: Customer ki apni original country aur currency lo (No Overrides)
    let country = country_code ? country_code.toUpperCase().trim() : 'DE';
    let userCurrency = currency ? currency.toLowerCase().trim() : 'eur';

    // Shopify multi-currency standard handler for fallback cases
    if (!currency && country === 'PL') {
      userCurrency = 'pln';
    }

    // ✅ STEP 2: Payment Methods Setup
    let methods = ['card', 'link'];
    const klarnaSupportedCurrencies = ['eur', 'usd', 'gbp'];
    if (klarnaSupportedCurrencies.includes(userCurrency)) {
      methods.push('klarna');
    }
    if (country === 'NL') methods.push('ideal');
    else if (country === 'BE') methods.push('bancontact');
    else if (country === 'AT') methods.push('eps');
    else if (country === 'PL') methods.push('p24', 'blik');
    else if (country === 'PT') methods.push('multibanco');

    // ✅ STEP 3: Verified Shopify CDN Fallback Image URL
    const fallbackImage = "https://cdn.shopify.com/s/files/1/0979/0472/2240/files/ee7017476aac4b72b801389ed16d8dd1.webp";
    const validImage = image_url && image_url.trim().startsWith('http') ? image_url.trim() : fallbackImage;

    // ✅ STEP 4: Build Line Items Array safely
    let lineItems = [];
    if (line_items_data && line_items_data.length > 0) {
      line_items_data.forEach(item => {
        lineItems.push({
          price_data: {
            currency: userCurrency,
            product_data: {
              name: `${product_name || 'Product'} - ${item.variant || 'Standard'}`,
              images: [validImage]
            },
            unit_amount: Math.round(parseFloat(item.price || price || 0) * 100)
          },
          quantity: 1
        });
      });
    } else {
      lineItems.push({
        price_data: {
          currency: userCurrency,
          product_data: {
            name: `${product_name || 'Product'} - ${variant_name || 'Standard'}`,
            images: [validImage]
          },
          unit_amount: Math.round(parseFloat(price || 0) * 100)
        },
        quantity: 1
      });
    }

    // Zero-value validation check
    if (lineItems.length === 0 || lineItems[0].price_data.unit_amount <= 0) {
      return res.status(400).json({ error: 'Invalid checkout parameters or zero amount value.' });
    }

    // ✅ STEP 5: Create Stripe Session Config
    const sessionConfig = {
      payment_method_types: methods,
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      line_items: lineItems,
      mode: 'payment',
      payment_intent_data: {
        description: `Order for ${product_name || 'Product'} (${variant_name || 'Standard'})`
      },
      metadata: {
        product_name: product_name || '',
        variant_name: variant_name || '',
        variants: variant_name || 'Standard',
        // ✅ FIX: fbp/fbc/event_id ab metadata mein save ho rahe hain taake webhook.js
        // Meta CAPI call mein inhe use kar sake — match quality aur dedupe dono ke liye
        fbp: fbp || '',
        fbc: fbc || '',
        client_event_id: event_id || ''
      },
      success_url: `https://www.lonovos.com/pages/thank-you`,
      cancel_url: `https://www.lonovos.com/`
    };

    // ✅ STEP 6: Smart Dynamic Shipping Filter (Bypasses 504 Timeout)
    const stripeSupportedShipping = ['US', 'CA', 'GB', 'AU', 'NZ', 'DE', 'FR', 'NL', 'AT', 'BE', 'PL', 'PT', 'IT', 'ES', 'IE'];

    if (stripeSupportedShipping.includes(country)) {
      sessionConfig.shipping_address_collection = {
        allowed_countries: [country]
      };
    } else {
      // Agar India/Pakistan jaisi unsupported country hai, toh safe array mix pass karo taake API freeze na ho
      sessionConfig.shipping_address_collection = {
        allowed_countries: [country, 'US', 'GB', 'DE'].filter(c => c === country || stripeSupportedShipping.includes(c)).slice(0, 25)
      };
    }

    if (customer_email && customer_email.trim() !== "") {
      sessionConfig.customer_email = customer_email.trim();
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('❌ Stripe Engine Session Error:', err.message);
    return res.status(400).json({ error: err.message });
  }
};
