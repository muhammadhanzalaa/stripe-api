const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async (req, res) => {
  // 🔥 1. CORS Headers Apply Karen (Cross-Origin Block Fix)
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 🔥 2. Preflight Browser Request (OPTIONS) Handle Karen
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
      event_id,
      fbp,
      fbc,
      event_source_url,
      product_handle
    } = req.body;

    const userCurrency = (currency || 'USD').toLowerCase();
    const country = (country_code || 'US').toUpperCase();
    const validImage = image_url && image_url.startsWith('http') ? image_url : 'https://cdn.shopify.com/s/files/1/0979/0472/2240/files/ee7017476aac4b72b801389ed16d8dd1_tplv-fhlh96nyum-crop-webp_1600_1600.webp';

    const lineItems = [{
      price_data: {
        currency: userCurrency,
        product_data: {
          name: `${product_name || 'Product'} - ${variant_name || 'Standard'}`,
          images: [validImage]
        },
        unit_amount: Math.round(parseFloat(price || 0) * 100)
      },
      quantity: 1
    }];

    // Zero-value validation check
    if (lineItems.length === 0 || lineItems[0].price_data.unit_amount <= 0) {
      return res.status(400).json({ error: 'Invalid checkout parameters or zero amount value.' });
    }

    // Dynamic payment methods mapping
    const methods = ['card'];
    const upperCurrency = userCurrency.toUpperCase();
    
    // Klarna multi-currency support karta hai, par ideal/bancontact sirf EUR par chalte hain
    if (['EUR', 'DKK', 'SEK', 'GBP'].includes(upperCurrency)) {
      methods.push('klarna');
    }
    if (upperCurrency === 'EUR') {
      methods.push('ideal', 'bancontact');
    }

    // ✅ Create Stripe Session Config (With Tracking Payload)
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
        event_id: event_id || '', 
        fbp: fbp || '',
        fbc: fbc || '',
        event_source_url: event_source_url || '',
        product_handle: product_handle || 'non-slip-stair-tread-mats'
      },
      success_url: `https://www.lonovos.com/pages/thank-you`,
      cancel_url: `https://www.lonovos.com/`
    };

    // ✅ Smart Dynamic Shipping Filter
    const stripeSupportedShipping = ['US', 'CA', 'GB', 'AU', 'NZ', 'DE', 'FR', 'NL', 'AT', 'BE', 'PL', 'PT', 'IT', 'ES', 'IE', 'DK', 'SE'];
    
    if (stripeSupportedShipping.includes(country)) {
      sessionConfig.shipping_address_collection = {
        allowed_countries: [country]
      };
    } else {
      sessionConfig.shipping_address_collection = {
        allowed_countries: ['US', 'GB', 'DE']
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
