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

      // Frontend se separator '|' use karein taake colors ke andar ke '/' masla na karein
      // Hum variant_name ko filter kar rahe hain taake empty values na aayein
      const variantList = variant_name.split('|').map(v => v.trim()).filter(v => v !== "");
      
      let line_items = [];

      // --- BUNDLE LOGIC (Buy 2 Get 1 Free) ---
      if (quantity === 3) {
        const savingsAmount = cleanPrice.toFixed(2);

        // 1. Paid Items (Pehle 2 selections)
        line_items.push({
          price_data: {
            currency: 'usd',
            product_data: { 
              name: product_name,
              images: [image_url],
              description: `SELECTED VARIANTS:\n• ${variantList[0] || 'Selected Color'}\n• ${variantList[1] || 'Selected Color'}\n\n✅ YOU SAVED: $${savingsAmount}`
            },
            unit_amount: Math.round(cleanPrice * 100),
          },
          quantity: 2,
        });

        // 2. Free Item (Teesri selection)
        line_items.push({
          price_data: {
            currency: 'usd',
            product_data: { 
              name: `FREE BUNDLE ITEM (Included)`,
              images: [image_url],
              description: `Promotion: Buy 2 Get 1 Free Applied\n• ${variantList[2] || 'Selected Color'}`
            },
            unit_amount: 0,
          },
          quantity: 1,
        });
      } else {
        // --- SINGLE ITEM LOGIC ---
        line_items.push({
          price_data: {
            currency: 'usd',
            product_data: { 
              name: product_name,
              images: [image_url],
              description: `Variant: ${variant_name}`
            },
            unit_amount: Math.round(cleanPrice * 100),
          },
          quantity: 1,
        });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        automatic_tax: { enabled: true },
        line_items: line_items,
        mode: 'payment',
        // Is mein humne UAE aur Pakistan bhi add kar diye hain testing ke liye
        shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'AE', 'PK'] },
        // Metadata Shopify order sync ke liye zaroori hai
        metadata: {
          full_variants: variant_name,
          product: product_name
        },
        success_url: 'https://lonovos.com/pages/thank-you',
        cancel_url: 'https://lonovos.com/',
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
