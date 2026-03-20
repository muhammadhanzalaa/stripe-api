const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      // Shopify se naya data receive karna
      const { product_name, variant_name, image_url, price, quantity, description } = req.body;
      const cleanPrice = parseFloat(price.toString().replace(/[^\d.]/g, ''));

      let line_items = [];

      // --- BUNDLE LOGIC (Buy 2 Get 1 Free) ---
      if (quantity === 3) {
        // 1. Paid Items (2 Units)
        line_items.push({
          price_data: {
            currency: 'usd',
            product_data: { 
              name: `${product_name} - ${variant_name}`, // Variant name add kiya
              images: [image_url], // Image sync ki
              description: "Main Order Items"
            },
            unit_amount: Math.round(cleanPrice * 100),
          },
          quantity: 2,
        });

        // 2. Free Item (1 Unit)
        line_items.push({
          price_data: {
            currency: 'usd',
            product_data: { 
              name: `${product_name} - ${variant_name} (FREE BUNDLE ITEM)`,
              images: [image_url],
              description: "Buy 2 Get 1 Free Promotion"
            },
            unit_amount: 0, // Zero price for free item
          },
          quantity: 1,
        });
      } else {
        // --- NORMAL SINGLE ITEM ---
        line_items.push({
          price_data: {
            currency: 'usd',
            product_data: { 
              name: `${product_name} - ${variant_name}`,
              images: [image_url],
              description: description || "" 
            },
            unit_amount: Math.round(cleanPrice * 100),
          },
          quantity: 1,
        });
      }

      const session = await stripe.checkout.sessions.create({
        // PayPal baad mein enable karenge dashboard se
        payment_method_types: ['card', 'ideal', 'klarna'], 
        phone_number_collection: { enabled: true },
        billing_address_collection: 'required',
        line_items: line_items, // Updated line items use kiye
        mode: 'payment',
        shipping_address_collection: {
          allowed_countries: [
            'SA', 'OM', 'AE', 'KW', 'QA', 'BH', 'US', 'CA', 'GB', 'AU', 'NZ', 'PK', 'IN',
            'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 
            'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'NO'
          ],
        },
        success_url: 'https://lonovos.com/pages/thank-you',
        cancel_url: 'https://lonovos.com/',
        metadata: {
          product_name: product_name,
          variant: variant_name, // Webhook ke liye variant save kiya
          bundle_info: description
        }
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      console.error("Stripe Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  } else {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }
};
