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
      const cleanPrice = parseFloat(price.toString().replace(/[^\d.]/g, ''));

      // 2. Create Stripe Session
      const session = await stripe.checkout.sessions.create({
        // 'card' ko pehle rakha hai taake Google/Apple Pay priority pe rahein
        payment_method_types: [
          'card', 
          'us_bank_account', 
          'link', 
          'cashapp', 
          'amazon_pay', 
          'klarna'
        ],

        payment_method_options: {
          card: {
            request_three_d_secure: 'any',
          },
          us_bank_account: {
            financial_connections: { permissions: ['payment_method'] },
          },
        },

        phone_number_collection: { enabled: true },
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
        billing_address_collection: 'required',
        shipping_address_collection: {
          allowed_countries: [
            'SA', 'OM', 'AE', 'KW', 'QA', 'BH', // Middle East
            'US', 'CA', 'GB', 'AU', 'NZ', 'PK', 'IN', // Majors
            'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
            'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
            'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'NO' // Europe
          ],
        },
        success_url: 'https://lonovos.com/success',
        cancel_url: 'https://lonovos.com/',
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
