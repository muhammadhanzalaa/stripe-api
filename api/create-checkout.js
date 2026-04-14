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

      // --- Currency Management ---
      if (urlPath.includes('-pl')) userCurrency = 'pln'; 
      else if (urlPath.includes('-se')) userCurrency = 'sek';
      else if (urlPath.includes('-dk')) userCurrency = 'dkk';
      else if (urlPath.includes('-gb')) userCurrency = 'gbp';

      const session = await stripe.checkout.sessions.create({
        // v14.21.0 support: automatic_payment_methods is the recommended way
        automatic_payment_methods: { 
            enabled: true 
        }, 
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
            // All requested countries
            allowed_countries: [
              'PK', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
              'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
              'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'US', 'CA', 
              'GB', 'BR', 'AU', 'NZ'
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
