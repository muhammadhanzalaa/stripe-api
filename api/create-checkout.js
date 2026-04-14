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
      let final_methods = ['card'];
      let default_country = 'NL'; // Default safe option

      // --- 1. DYNAMIC DETECTION & STRICT FILTERING ---
      
      if (urlPath.includes('-at')) {
          final_methods = ['card', 'eps']; 
          userCurrency = 'eur';
          default_country = 'AT';
      } 
      else if (urlPath.includes('-pl')) {
          final_methods = ['card', 'p24', 'blik']; 
          userCurrency = 'pln';
          default_country = 'PL';
      }
      else if (urlPath.includes('-be')) {
          final_methods = ['card', 'bancontact']; 
          userCurrency = 'eur';
          default_country = 'BE';
      }
      else if (urlPath.includes('-de')) {
          final_methods = ['card', 'giropay']; // Germany specific
          userCurrency = 'eur';
          default_country = 'DE';
      }
      else if (urlPath.includes('-pt')) {
          final_methods = ['card', 'multibanco'];
          userCurrency = 'eur';
          default_country = 'PT';
      }
      else if (urlPath.includes('-nl')) {
          final_methods = ['card', 'ideal'];
          userCurrency = 'eur';
          default_country = 'NL';
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: final_methods,
        
        // --- 2. RESTRICT COUNTRY & SYNC DATA ---
        shipping_address_collection: { 
            allowed_countries: [
              'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
              'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
              'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'US', 'CA', 
              'GB', 'BR', 'AU', 'NZ'
            ]
        },

        line_items: [{
          price_data: {
            currency: userCurrency,
            product_data: { name: product_name, images: [image_url], description: variant_name },
            unit_amount: Math.round(parseFloat(price) * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        
        // Ye line ensure karegi ke payment methods country ke sath sync rahein
        customer_creation: 'always', 

        success_url: `https://lonovos.com/pages/thank-you`, 
        cancel_url: `https://lonovos.com/`,                
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
