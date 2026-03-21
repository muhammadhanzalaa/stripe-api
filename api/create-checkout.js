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

      // Currency Logic for the specific list
      const euroZone = ['AT', 'BE', 'FI', 'FR', 'DE', 'IE', 'IT', 'NL', 'PT', 'ES']; 
      
      if (euroZone.includes(country)) {
          userCurrency = 'eur';
          rate = 0.92;
      } else if (country === 'GB') {
          userCurrency = 'gbp';
          rate = 0.79;
      } else if (country === 'IN') {
          userCurrency = 'inr';
          rate = 83;
      } else if (country === 'NZ') {
          userCurrency = 'nzd';
          rate = 1.65;
      } else if (country === 'AU') { // Australia added
          userCurrency = 'aud';
          rate = 1.52;
      } else if (country === 'CA') { // Canada added
          userCurrency = 'cad';
          rate = 1.35;
      } else if (country === 'SE') {
          userCurrency = 'sek';
          rate = 10.50;
      } else if (country === 'DK') {
          userCurrency = 'dkk';
          rate = 6.85;
      } else if (country === 'PL') {
          userCurrency = 'pln';
          rate = 3.95;
      } else if (country === 'CH') {
          userCurrency = 'chf';
          rate = 0.88;
      } else if (country === 'KR') {
          userCurrency = 'krw';
          rate = 1330;
      } else if (country === 'BR') {
          userCurrency = 'brl';
          rate = 5.00;
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
        // --- UPDATED SHIPPING COUNTRIES ---
        shipping_address_collection: { 
            allowed_countries: [
                'US', 'CA', 'AU', 'PL', 'AT', 'CH', 'KR', 'BE', 'BR', 'NZ', 'IN', 'FR', 'DE', 'NL', 'ES', 'SE', 'GB', 'DK', 'FI', 'IE', 'IT', 'PT'
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
