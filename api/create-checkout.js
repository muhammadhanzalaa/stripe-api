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
      const { product_name, variant_name, image_url, price, quantity, currency } = req.body;
      
      let userCurrency = currency ? currency.toLowerCase() : 'usd';
      let cleanPrice = parseFloat(price);
      let payment_methods = [];

      // --- HYBRID CHECKOUT LOGIC ---
      if (userCurrency === 'brl') {
        payment_methods = ['pix']; // Brazil logic
      } else if (userCurrency === 'pln') {
        payment_methods = ['p24']; // Poland/Blik logic
      } else if (userCurrency === 'eur') {
        payment_methods = ['ideal', 'multibanco', 'bancontact', 'eps']; // EU logic
      } else {
        // Pakistan, India aur baqi sab ke liye USD + Card
        userCurrency = 'usd';
        payment_methods = ['card'];
      }

      const finalAmount = Math.round(cleanPrice * 100);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: payment_methods,
        line_items: [{
          price_data: {
            currency: userCurrency,
            product_data: { 
              name: product_name, 
              images: [image_url], 
              description: variant_name 
            },
            unit_amount: finalAmount,
          },
          quantity: 1,
        }],
        mode: 'payment',
        // Shipping list (India ko list se nikal diya hai shipping address mein)
        shipping_address_collection: { 
            allowed_countries: ['BR', 'PT', 'NL', 'PL', 'BE', 'DE', 'AT', 'US', 'CA', 'GB'] 
        },
        success_url: `https://lonovos.com/pages/thank-you?value=${cleanPrice}&currency=${userCurrency}`, 
        cancel_url: 'https://lonovos.com/',                
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
