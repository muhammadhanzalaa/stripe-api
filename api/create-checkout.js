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
      let detectedCountry = 'NL'; // Default

      // --- 1. Store detection logic (IP/URL based) ---
      if (urlPath.includes('-at')) {
          userCurrency = 'eur'; // Force EUR for Austria to fix AUD error
          detectedCountry = 'AT';
      }
      else if (urlPath.includes('-be')) {
          detectedCountry = 'BE';
      }
      else if (urlPath.includes('-br')) {
          detectedCountry = 'BR';
          userCurrency = 'brl';
      }
      else if (urlPath.includes('-pt')) {
          detectedCountry = 'PT';
      }
      else if (urlPath.includes('-pl')) {
          detectedCountry = 'PL';
          userCurrency = 'pln';
      }
      else if (urlPath.includes('-de')) {
          detectedCountry = 'DE';
      }
      else if (urlPath.includes('-nl')) {
          detectedCountry = 'NL';
      }

      // --- 2. Create Dynamic Session ---
      const session = await stripe.checkout.sessions.create({
        // Humne sirf wo methods rakhe hain jo error nahi dete
        payment_method_types: ['ideal', 'bancontact', 'eps', 'multibanco', 'p24', 'pix'],
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
        shipping_address_collection: { 
            // Detected country dropdown mein pehle aayegi
            allowed_countries: [detectedCountry, 'BE', 'NL', 'AT', 'DE', 'PT', 'PL', 'BR'].filter((c, i, a) => a.indexOf(c) === i)
        },
        success_url: `https://lonovos.com/pages/thank-you`, 
        cancel_url: `https://lonovos.com/`,                
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      // Agar error aaye toh humein pata chale ke kyun aa raha hai
      return res.status(500).json({ error: err.message });
    }
  }
};
