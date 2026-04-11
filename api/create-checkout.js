const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  // CORS Headers (Same as before)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { product_name, variant_name, image_url, price, quantity, currency } = req.body;
      
      // Ensure currency is captured properly from frontend
      const userCurrency = currency ? currency.toLowerCase() : 'eur'; 
      const finalAmount = Math.round(parseFloat(price) * 100);

      // --- DYNAMIC METHODS BASED ON CURRENCY ---
      let payment_methods = [];

      if (userCurrency === 'brl') {
        payment_methods = ['pix']; // Brazil
      } else if (userCurrency === 'pln') {
        payment_methods = ['p24']; // Poland
      } else if (userCurrency === 'eur') {
        payment_methods = ['ideal', 'bancontact', 'eps', 'multibanco']; // Europe
      } else {
        // USD ya kisi aur currency ke liye 'card' lazmi dena hoga warna error aayega
        payment_methods = ['card']; 
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: payment_methods,
        line_items: [{
          price_data: {
            currency: userCurrency,
            product_data: { name: product_name, images: [image_url], description: variant_name },
            unit_amount: finalAmount,
          },
          quantity: 1,
        }],
        mode: 'payment',
        // India (IN) removed from shipping
        shipping_address_collection: { 
            allowed_countries: ['BR', 'PT', 'NL', 'PL', 'BE', 'DE', 'AT', 'GB', 'US', 'CA'] 
        },
        success_url: `https://lonovos.com/pages/thank-you?value=${price}&currency=${userCurrency}`, 
        cancel_url: 'https://lonovos.com/',                
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      // Error message for debugging
      return res.status(500).json({ error: err.message });
    }
  }
};
