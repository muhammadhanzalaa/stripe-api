const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { product_name, price } = req.body;
      
      // Price cleaning: Ye bundle ki discounted price ko bhi sahi handle karega
      const cleanPrice = parseFloat(price.toString().replace(/[^\d.]/g, ''));
      if (isNaN(cleanPrice)) {
        throw new Error("Invalid price received");
      }

      const session = await stripe.checkout.sessions.create({
        // 1. Payment Methods: automatic_payment_methods se Apple Pay, Google Pay, Afterpay sab khud aa jayenge
        automatic_payment_methods: { 
          enabled: true 
        },
        
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { 
              name: product_name || "Product" 
            },
            unit_amount: Math.round(cleanPrice * 100), // Cents mein convert
          },
          quantity: 1,
        }],
        mode: 'payment',

        // 2. Customer Address: Is se "Shipping Address" ka box nazar aayega
        billing_address_collection: 'required',
        shipping_address_collection: {
          allowed_countries: ['US', 'CA', 'GB', 'AU'], // Client ki main markets
        },

        success_url: 'https://lonovos.com/success',
        cancel_url: 'https://lonovos.com/',
      });

      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error("Stripe Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }
};
