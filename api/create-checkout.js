const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { product_name, variant_name, image_url, price, quantity } = req.body;
      const cleanPrice = parseFloat(price);

      // --- IP BASED LOCATION & CURRENCY ---
      const country = req.headers['x-vercel-ip-country'] || 'US'; 
      
      let userCurrency = 'usd';
      let rate = 1;

      // European Union Zone (Euro)
      const euroZone = ['AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES'];
      
      // Gulf Countries (GCC) Rates & Currencies
      const gulfRates = { 
        'AE': { currency: 'aed', rate: 3.67 }, 
        'SA': { currency: 'sar', rate: 3.75 }, 
        'QA': { currency: 'qar', rate: 3.64 }, 
        'KW': { currency: 'kwd', rate: 0.31 }, 
        'OM': { currency: 'omr', rate: 0.38 }, 
        'BH': { currency: 'bhd', rate: 0.38 } 
      };

      if (euroZone.includes(country)) {
          userCurrency = 'eur';
          rate = 0.92;
      } else if (gulfRates[country]) {
          userCurrency = gulfRates[country].currency;
          rate = gulfRates[country].rate;
      } else if (country === 'GB') {
          userCurrency = 'gbp';
          rate = 0.79;
      } else if (country === 'IN') {
          userCurrency = 'inr';
          rate = 83;
      }

      const finalAmount = Math.round(cleanPrice * rate * 100);
      const variantList = variant_name.split('|').map(v => v.trim()).filter(v => v !== "");
      
      let line_items = [];

      // --- BUNDLE & SINGLE ITEM LOGIC ---
      if (quantity === 3) {
        line_items.push({
          price_data: {
            currency: userCurrency,
            product_data: { name: product_name, images: [image_url], description: `Variants: ${variantList[0]}, ${variantList[1]}` },
            unit_amount: finalAmount,
          },
          quantity: 2,
        });
        line_items.push({
          price_data: {
            currency: userCurrency,
            product_data: { name: `FREE BUNDLE ITEM`, images: [image_url], description: `Free Variant: ${variantList[2]}` },
            unit_amount: 0,
          },
          quantity: 1,
        });
      } else {
        line_items.push({
          price_data: {
            currency: userCurrency,
            product_data: { name: product_name, images: [image_url], description: `Variant: ${variant_name}` },
            unit_amount: finalAmount,
          },
          quantity: 1,
        });
      }

      const session = await stripe.checkout.sessions.create({
        // Only active and stable payment methods
        payment_method_types: [
          'card', 
          'klarna', 
          'afterpay_clearpay', 
          'ideal', 
          'bancontact', 
          'eps'
        ],
        automatic_tax: { enabled: true },
        line_items: line_items,
        mode: 'payment',
        // Global Shipping List
        shipping_address_collection: { 
            allowed_countries: [
                'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'AT', 'BE', 'IE', 'PT', 'SE', 'NO', 'DK', 'FI', 'CH',
                'AE', 'SA', 'QA', 'KW', 'OM', 'BH', 'IN', 'PK', 'SG', 'MY'
            ] 
        },
        metadata: { full_variants: variant_name, product: product_name },
        success_url: 'https://lonovos.com/pages/thank-you',
        cancel_url: 'https://lonovos.com/',
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
