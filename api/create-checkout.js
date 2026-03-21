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

      // --- IP BASED LOCATION DETECTION ---
      const country = req.headers['x-vercel-ip-country'] || 'US'; 
      
      let userCurrency = 'usd';
      let rate = 1;

      // 1. Euro Zone (20+ Countries)
      const euroZone = ['AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'HR', 'MC'];
      
      // 2. Gulf/Middle East (GCC)
      const gulfRates = { 
        'AE': { c: 'aed', r: 3.67 }, 
        'SA': { c: 'sar', r: 3.75 }, 
        'QA': { c: 'qar', r: 3.64 }, 
        'KW': { c: 'kwd', r: 0.31 }, 
        'OM': { c: 'omr', r: 0.38 }, 
        'BH': { c: 'bhd', r: 0.38 } 
      };

      // 3. Logic for Currency Assignment
      if (euroZone.includes(country)) {
          userCurrency = 'eur';
          rate = 0.92;
      } else if (gulfRates[country]) {
          userCurrency = gulfRates[country].c;
          rate = gulfRates[country].r;
      } else if (country === 'GB') {
          userCurrency = 'gbp';
          rate = 0.79;
      } else if (country === 'IN') {
          userCurrency = 'inr';
          rate = 83;
      } else if (country === 'CA') {
          userCurrency = 'cad';
          rate = 1.35;
      } else if (country === 'AU') {
          userCurrency = 'aud';
          rate = 1.52;
      }

      const finalAmount = Math.round(cleanPrice * rate * 100);
      const variantList = variant_name.split('|').map(v => v.trim()).filter(v => v !== "");
      
      let line_items = [];
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
            product_data: { name: `FREE BUNDLE ITEM`, images: [image_url], description: `Free Variant: ${variantList[2] || 'Selected'}` },
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
        payment_method_types: ['card', 'klarna', 'afterpay_clearpay', 'ideal', 'bancontact', 'eps'],
        automatic_tax: { enabled: true },
        line_items: line_items,
        mode: 'payment',
        // --- ALLOW SHIPPING TO ALL COUNTRIES ---
        // 'shipping_address_collection' ko nikaal dein ya niche wali setting use karein
        // Stripe Checkout mein agar countries list lambi ho jaye to better hai empty rakhein ya 'US' base rakhein
        // Lekin aap ne 'all countries' manga hai, is liye main ne list expand kar di hai:
        shipping_address_collection: { 
            allowed_countries: [
                'US', 'CA', 'GB', 'AU', 'NZ', 'IE', 'DE', 'FR', 'IT', 'ES', 'NL', 'AT', 'BE', 'CH', 'SE', 'NO', 'DK', 
                'AE', 'SA', 'QA', 'KW', 'OM', 'BH', 'IN', 'PK', 'SG', 'MY', 'HK', 'JP', 'ZA'
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
