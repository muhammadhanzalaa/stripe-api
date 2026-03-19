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
        // 1. Payment Method: 'card' rakhne se error nahi aayega, 
        // Apple/Google Pay dashboard se handle honge.
        payment_method_types: ['card'],
        
        // 2. Phone Number: Customer se mobile number lazmi mangega.
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
        
        // 3. Global Address: Customer ka address mangega.
        billing_address_collection: 'required',
        shipping_address_collection: {
          // Ye main countries hain, baki dashboard se global set hoga.
          allowed_countries: ['US', 'CA', 'GB', 'AU', 'NZ', 'DE', 'FR', 'IT', 'ES', 'PK', 'IN'],
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
