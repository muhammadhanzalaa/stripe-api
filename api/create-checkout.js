const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  // 1. CORS Headers (Taake website se API connect ho sake)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // OPTIONS request handle karna zaroori hai browser ke liye
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { product_name, price } = req.body;

      // Price ko clean karna taake decimal errors na aayein
      const cleanPrice = parseFloat(price.toString().replace(/[^\d.]/g, ''));

      // 2. Stripe Session Creation
      const session = await stripe.checkout.sessions.create({
        // Aapki image wala setup: Card aur Bank dono
        payment_method_types: ['card', 'us_bank_account'],
        
        // Customer se phone number mangne ke liye
        phone_number_collection: { enabled: true },

        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { 
              name: product_name || "Product",
            },
            unit_amount: Math.round(cleanPrice * 100), // Dollars ko cents mein convert karna
          },
          quantity: 1,
        }],
        
        mode: 'payment',
        
        // Billing aur Shipping details (Global)
        billing_address_collection: 'required',
        shipping_address_collection: {
          allowed_countries: [
            'SA', 'OM', 'AE', 'KW', 'QA', 'BH', // Middle East
            'US', 'CA', 'GB', 'AU', 'NZ', 'PK', 'IN', // Major Markets
            'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
            'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
            'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'NO' // Europe
          ],
        },

        // URLs jahan payment ke baad customer jaye ga
        success_url: 'https://lonovos.com/success',
        cancel_url: 'https://lonovos.com/',
      });

      // 3. Success Response: Browser ko Checkout URL bhejna
      return res.status(200).json({ url: session.url });

    } catch (err) {
      console.error("Stripe Checkout Error:", err.message);
      // Agar error aaye toh frontend par dikhana
      return res.status(500).json({ error: err.message });
    }
  } else {
    // Agar POST ke ilawa koi aur request aaye
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }
};
