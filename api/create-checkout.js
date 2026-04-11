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

      // --- CURRENCY SET TO EUR & RATE 1 ---
      const userCurrency = 'eur'; 
      const rate = 1; 

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
        // --- ADDED CARD FOR ALL COUNTRIES ---
        payment_method_types: [
          'card', 
          'pix', 
          'multibanco', 
          'ideal', 
          'p24', 
          'bancontact', 
          'eps'
        ], 
        automatic_tax: { enabled: true },
        line_items: line_items,
        mode: 'payment',
        // --- ADDED 'IN' FOR INDIA SHIPPING ---
        shipping_address_collection: { 
            allowed_countries: ['BR', 'PT', 'NL', 'PL', 'BE', 'DE', 'AT', 'IN'] 
        },
        metadata: { full_variants: variant_name, product: product_name },
        // --- UPDATE THESE URLS TO YOUR NEW DOMAIN ---
        success_url: 'https://lonovos.com/pages/thank-you',
        cancel_url: 'https://lonovos.com/',
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
