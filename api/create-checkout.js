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
      const { product_name, variant_name, image_url, price, quantity } = req.body;
      const cleanPrice = parseFloat(price.toString().replace(/[^\d.]/g, ''));

      // --- FORMATTING LOGIC ---
      // Variants ko split karke list banana aur Size check karna
      const formattedVariants = variant_name.split(' / ').map(v => {
          // Agar size include nahi hai to hum 'None' ya 'Default' handling frontend se karwa sakte hain
          // Filhal hum ensure kar rahe hain ke layout saaf dikhe
          return `• ${v.trim()}`;
      }).join('\n');

      let line_items = [];

      // --- BUNDLE LOGIC (Buy 2 Get 1 Free) ---
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
        // --- NORMAL SINGLE ITEM ---
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
        phone_number_collection: { enabled: true },
        billing_address_collection: 'required',
        line_items: line_items,
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
          variant: variant_name,
          bundle_info: quantity === 3 ? "Buy 2 Get 1 Free" : "Single Pack"
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
