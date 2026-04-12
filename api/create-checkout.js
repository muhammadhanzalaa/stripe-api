const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { product_name, variant_name, image_url, price, currency } = req.body;
      const referer = req.headers.referer || "";
      const urlPath = referer.toLowerCase();
      
      // Default currency handling to prevent AUD errors in Europe
      let userCurrency = currency ? currency.toLowerCase() : 'eur';
      
      // Austria, Germany, Netherlands, Belgium ke liye force EUR karein
      if (urlPath.includes('-at') || urlPath.includes('-de') || urlPath.includes('-nl') || urlPath.includes('-be')) {
          userCurrency = 'eur';
      }

      const session = await stripe.checkout.sessions.create({
        // DYNAMIC LOGIC: Specific methods list kar diye hain, Stripe address ke mutabiq dikhayega
        payment_method_types: ['ideal', 'bancontact', 'eps', 'multibanco', 'p24', 'blik', 'pix', 'sofort'],
        line_items: [{
          price_data: {
            currency: userCurrency,
            product_data: { 
              name: product_name, 
              images: [image_url], 
              description: variant_name 
            },
            unit_amount: Math.round(parseFloat(price) * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        // Address dropdown list
        shipping_address_collection: { 
            allowed_countries: ['AT', 'BE', 'NL', 'DE', 'PT', 'PL', 'BR'] 
        },
        success_url: `https://lonovos.com/pages/thank-you`, 
        cancel_url: `https://lonovos.com/`,                
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
