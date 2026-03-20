const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { product_name, price } = req.body;
      
      // Price cleaning logic
      const cleanPrice = parseFloat(price.toString().replace(/[^\d.]/g, ''));

      // 2. Create Stripe Session with Automatic Payment Methods
      const session = await stripe.checkout.sessions.create({
        // Is line se PayPal, Klarna, aur local methods dashboard se control honge
        automatic_payment_methods: { 
          enabled: true 
        },

        // Customer details collection
        phone_number_collection: { enabled: true },
        billing_address_collection: 'required',
        
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { 
              name: product_name || "Product",
            },
            unit_amount: Math.round(cleanPrice * 100),
          },
          quantity: 1,
        }],
        
        mode: 'payment',
        
        // Shipping details
        shipping_address_collection: {
          allowed_countries: [
            'SA', 'OM', 'AE', 'KW', 'QA', 'BH', // Middle East
            'US', 'CA', 'GB', 'AU', 'NZ', 'PK', 'IN', // Majors
            'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
            'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
            'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'NO' // Europe
          ],
        },

        success_url: 'https://lonovos.com/pages/thank-you',
        cancel_url: 'https://lonovos.com/',
        
        // Webhook ke liye metadata (Order sync karne mein madad dega)
        metadata: {
          product_name: product_name
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
