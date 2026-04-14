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

      // --- 1. Store Detection & Currency Fix ---
      // Austria AUD error fix
      if (urlPath.includes('-at')) {
          userCurrency = 'eur'; 
          detectedCountry = 'AT';
      }
      else if (urlPath.includes('-be')) detectedCountry = 'BE';
      else if (urlPath.includes('-nl')) detectedCountry = 'NL';
      else if (urlPath.includes('-de')) detectedCountry = 'DE';
      else if (urlPath.includes('-pt')) detectedCountry = 'PT';
      else if (urlPath.includes('-pl')) {
          userCurrency = 'pln'; // Poland mandatory currency
          detectedCountry = 'PL';
      }
      else if (urlPath.includes('-br')) {
          userCurrency = 'brl';
          detectedCountry = 'BR';
      }

      // --- 2. Dynamic Payment Methods List ---
      // Humne card aur saare EU/Global methods ek sath bhej diye hain.
      // Stripe user ki selection ke mutabiq khud filter karega.
      const session = await stripe.checkout.sessions.create({
        payment_method_types: [
          'card',           // US/CA/GB/EU ke liye
          'ideal',          // Netherlands
          'bancontact',     // Belgium
          'eps',            // Austria
          'multibanco',     // Portugal
          'p24',            // Poland
          'blik',           // Poland
          'pix',            // Brazil
          'sepa_debit'      // All Europe
        ],
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
            // All EU countries + North America
            allowed_countries: [
              'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
              'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
              'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'US', 'CA', 'GB', 'BR'
            ]
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
