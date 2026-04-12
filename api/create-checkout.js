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
      
      let userCurrency = currency ? currency.toLowerCase() : 'eur';
      let payment_methods = [];
      let detectedCountry = 'NL'; // Default

      // --- 1. Austria Fix (Force EUR if AUD is mistakenly sent) ---
      if (urlPath.includes('-at')) {
          userCurrency = 'eur'; 
          payment_methods = ['eps'];
          detectedCountry = 'AT';
      }
      // --- 2. Belgium Fix (Strict check before Netherlands) ---
      else if (urlPath.includes('-be')) {
          payment_methods = ['bancontact'];
          detectedCountry = 'BE';
      }
      // --- 3. Netherlands Fix ---
      else if (urlPath.includes('-nl')) {
          payment_methods = ['ideal'];
          detectedCountry = 'NL';
      }
      // --- 4. Other Countries ---
      else if (urlPath.includes('-br') || userCurrency === 'brl') {
          payment_methods = ['pix'];
          detectedCountry = 'BR';
      }
      else if (urlPath.includes('-pt')) {
          payment_methods = ['multibanco'];
          detectedCountry = 'PT';
      }
      else if (urlPath.includes('-pl') || userCurrency === 'pln') {
          payment_methods = ['p24', 'blik'];
          detectedCountry = 'PL';
      }
      else if (urlPath.includes('-de')) {
          payment_methods = ['sofort'];
          detectedCountry = 'DE';
      }
      else {
          payment_methods = ['ideal'];
          detectedCountry = 'NL';
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: payment_methods,
        line_items: [{
          price_data: {
            currency: userCurrency,
            product_data: { name: product_name, images: [image_url], description: variant_name },
            unit_amount: Math.round(parseFloat(price) * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        shipping_address_collection: { 
            // Is se hamesha detected country hi pehle show hogi
            allowed_countries: [detectedCountry, 'BE', 'NL', 'AT', 'DE', 'PT', 'PL', 'BR'].filter((c, i, a) => a.indexOf(c) === i)
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
