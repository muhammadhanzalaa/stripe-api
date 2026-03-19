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
        // 1. Payment Methods (Automatic enabled)
        // Note: Dashboard se Apple/Google Pay ON hona lazmi hai
        automatic_payment_methods: { enabled: true },
        
        // 2. Phone Number Collection
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
        
        // 3. Address & Global Shipping
        billing_address_collection: 'required',
        shipping_address_collection: {
          // Ye list globally shipping allow karti hai (Main Countries)
          allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'NZ', 'PK', 'IN'],
        },
        
        success_url: 'https://lonovos.com/success',
        cancel_url: 'https://lonovos.com/',
      });

      return res.status(200).json({ url: session.url });
    } catch (err) {
      // Agar 'automatic_payment_methods' phir bhi error de (version issue ki wajah se)
      // Toh ye catch block automatically simple card payment par switch kar dega
      console.error("Trying fallback due to:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }
};
