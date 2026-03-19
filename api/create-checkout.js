const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { product_name, price } = req.body;
      const cleanPrice = parseFloat(price.toString().replace(/[^\d.]/g, ''));

      const session = await stripe.checkout.sessions.create({
        // Payment methods (Card as default, dashboard handles Apple/Google Pay)
        payment_method_types: ['card'],
        
        phone_number_collection: { enabled: true },

        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: product_name || "Product" },
            unit_amount: Math.round(cleanPrice * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        
        billing_address_collection: 'required',
        shipping_address_collection: {
          // Ye list globally shipping enable karti hai (Major regions added)
          // Agar kisi specific country ka code missing ho toh bas yahan add kar dein
          allowed_countries: [
            'US', 'CA', 'GB', 'AU', 'NZ', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 
            'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 
            'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'NO', 'PK', 'IN', 'AE', 'SA'
          ],
        },
        
        success_url: 'https://lonovos.com/success',
        cancel_url: 'https://lonovos.com/',
      });

      return res.status(200).json({ url: session.url });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
