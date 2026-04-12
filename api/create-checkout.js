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
      let cleanPrice = parseFloat(price);
      let payment_methods = [];
      
      // --- LOGIC: Detect specific country from URL ---
      let detectedCountry = 'NL'; // Default initialization
      
      if (urlPath.includes('-br') || userCurrency === 'brl') {
        payment_methods = ['pix'];
        detectedCountry = 'BR';
      } 
      else if (urlPath.includes('-nl')) {
        payment_methods = ['ideal'];
        detectedCountry = 'NL';
      }
      else if (urlPath.includes('-be')) {
        payment_methods = ['bancontact'];
        detectedCountry = 'BE';
      }
      else if (urlPath.includes('-at')) {
        payment_methods = ['eps'];
        detectedCountry = 'AT';
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
            product_data: { 
              name: product_name, 
              images: [image_url], 
              description: variant_name || "Standard Selection" 
            },
            unit_amount: Math.round(cleanPrice * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        // FIX: 'allowed_countries' mein 'detectedCountry' ko pehle rakha hai taake 
        // Belgium walon ko address mein Brazil nazar na aaye.
        shipping_address_collection: { 
            allowed_countries: [detectedCountry, 'BE', 'NL', 'AT', 'DE', 'PT', 'PL', 'BR'] 
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
