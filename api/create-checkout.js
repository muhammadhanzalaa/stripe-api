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
      
      // 1. Dynamic Domain Detection (Success/Cancel page ke liye)
      const referer = req.headers.referer || "https://lonovos.com/";
      const urlObj = new URL(referer);
      const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

      // 2. Currency Handling
      let userCurrency = currency ? currency.toLowerCase() : 'usd';
      let cleanPrice = parseFloat(price);
      let payment_methods = [];

      // 3. Hybrid Payment Logic
      if (userCurrency === 'brl') {
        payment_methods = ['pix'];
      } else if (userCurrency === 'pln') {
        payment_methods = ['p24'];
      } else if (userCurrency === 'eur') {
        payment_methods = ['ideal', 'bancontact', 'eps'];
      } else {
        userCurrency = 'usd';
        payment_methods = ['card'];
      }

      const finalAmount = Math.round(cleanPrice * 100);

      // 4. Create Stripe Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: payment_methods,
        line_items: [{
          price_data: {
            currency: userCurrency,
            product_data: { 
              name: product_name, 
              images: [image_url], 
              // Fallback for empty description error
              description: variant_name || "Standard Selection" 
            },
            unit_amount: finalAmount,
          },
          quantity: 1,
        }],
        mode: 'payment',
        shipping_address_collection: { 
            allowed_countries: ['BR', 'PT', 'NL', 'PL', 'BE', 'DE', 'AT', 'US', 'CA', 'GB'] 
        },
        // Redirect wapas usi store par jayega jahan se order aya
        success_url: `${baseUrl}/pages/thank-you?value=${cleanPrice}&currency=${userCurrency}`, 
        cancel_url: `${baseUrl}`,                
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      console.error("Stripe Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }
};
