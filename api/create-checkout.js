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

      // Variants ki formatting (Line by Line)
      const formattedVariants = variant_name.split(' / ').map(v => `• ${v.trim()}`).join('\n');

      let line_items = [];

      if (quantity === 3) {
        const savingsAmount = cleanPrice.toFixed(2);

        line_items.push({
          price_data: {
            currency: 'usd',
            product_data: { 
              name: product_name,
              images: [image_url],
              description: `SELECTED VARIANTS:\n${formattedVariants}\n\n✅ YOU SAVED: $${savingsAmount}`
            },
            unit_amount: Math.round(cleanPrice * 100),
          },
          quantity: 2,
        });

        line_items.push({
          price_data: {
            currency: 'usd',
            product_data: { 
              name: `FREE BUNDLE ITEM (Included)`,
              images: [image_url],
              description: "Promotion: Buy 2 Get 1 Free Applied"
            },
            unit_amount: 0,
          },
          quantity: 1,
        });
      } else {
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
        shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL'] },
        success_url: 'https://lonovos.com/pages/thank-you',
        cancel_url: 'https://lonovos.com/',
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
