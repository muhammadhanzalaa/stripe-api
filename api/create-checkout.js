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
      
      // Referer se Country detect karna (e.g., /en-nl ya /en-be)
      const referer = req.headers.referer || "";
      const urlPath = referer.toLowerCase();
      
      let userCurrency = currency ? currency.toLowerCase() : 'eur';
      let cleanPrice = parseFloat(price);
      let payment_methods = [];

      // --- STRICT COUNTRY MAPPING LOGIC ---
      
      if (urlPath.includes('-br') || userCurrency === 'brl') {
        payment_methods = ['pix']; // Brazil Only
      } 
      else if (urlPath.includes('-nl')) {
        payment_methods = ['ideal']; // Netherlands Only
      }
      else if (urlPath.includes('-be')) {
        payment_methods = ['bancontact']; // Belgium Only
      }
      else if (urlPath.includes('-at')) {
        payment_methods = ['eps']; // Austria Only
      }
      else if (urlPath.includes('-pt')) {
        payment_methods = ['multibanco']; // Portugal Only
      }
      else if (urlPath.includes('-pl') || userCurrency === 'pln') {
        payment_methods = ['p24', 'blik']; // Poland Only
      }
      else if (urlPath.includes('-de')) {
        // Germany ke liye agar Giropay/SEPA nahi chahiye toh Sofort ya iDEAL
        payment_methods = ['sofort']; 
      }
      else {
        // Fallback agar koi match na ho (Stripe needs at least one)
        payment_methods = ['ideal'];
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
        shipping_address_collection: { 
            allowed_countries: ['BR', 'PT', 'NL', 'PL', 'BE', 'DE', 'AT'] 
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
