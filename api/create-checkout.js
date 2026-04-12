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
      let detectedCountry = 'NL'; 
      let payment_methods = ['ideal'];

      // --- STRICT LOGIC FOR POLAND & OTHER COUNTRIES ---
      
      if (urlPath.includes('-pl')) {
          detectedCountry = 'PL';
          userCurrency = 'pln'; // Poland ke liye PLN zaroori hai
          payment_methods = ['p24', 'blik']; // Dono add kar diye taake error na aaye
      }
      else if (urlPath.includes('-at')) {
          userCurrency = 'eur'; // Austria AUD error fix
          detectedCountry = 'AT';
          payment_methods = ['eps'];
      }
      else if (urlPath.includes('-be')) {
          detectedCountry = 'BE';
          payment_methods = ['bancontact'];
      }
      else if (urlPath.includes('-nl')) {
          detectedCountry = 'NL';
          payment_methods = ['ideal'];
      }
      else if (urlPath.includes('-pt')) {
          detectedCountry = 'PT';
          payment_methods = ['multibanco'];
      }
      else if (urlPath.includes('-br')) {
          detectedCountry = 'BR';
          userCurrency = 'brl';
          payment_methods = ['pix'];
      }
      else if (urlPath.includes('-de')) {
          detectedCountry = 'DE';
          payment_methods = ['ideal']; 
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
