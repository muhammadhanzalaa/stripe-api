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

      // --- 1. Store/Path Detection Logic ---
      if (urlPath.includes('-at')) { userCurrency = 'eur'; detectedCountry = 'AT'; }
      else if (urlPath.includes('-be')) detectedCountry = 'BE';
      else if (urlPath.includes('-de')) detectedCountry = 'DE';
      else if (urlPath.includes('-it')) detectedCountry = 'IT';
      else if (urlPath.includes('-fr')) detectedCountry = 'FR';
      else if (urlPath.includes('-es')) detectedCountry = 'ES';
      else if (urlPath.includes('-pt')) detectedCountry = 'PT';
      else if (urlPath.includes('-pl')) { userCurrency = 'pln'; detectedCountry = 'PL'; }
      else if (urlPath.includes('-se')) { userCurrency = 'sek'; detectedCountry = 'SE'; }
      else if (urlPath.includes('-dk')) { userCurrency = 'dkk'; detectedCountry = 'DK'; }
      else if (urlPath.includes('-ch')) { userCurrency = 'chf'; detectedCountry = 'CH'; }
      else if (urlPath.includes('-gb')) { userCurrency = 'gbp'; detectedCountry = 'GB'; }
      else if (urlPath.includes('-us')) { userCurrency = 'usd'; detectedCountry = 'US'; }

      const session = await stripe.checkout.sessions.create({
        // Card + Sab Reliable Local Methods (SEPA removed for stability)
        payment_method_types: [
          'card', 'ideal', 'bancontact', 'eps', 'multibanco', 'p24', 'blik', 'pix'
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
            // In countries ka support add kar diya gaya hai
            allowed_countries: [
              'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
              'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
              'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'US', 'CA', 
              'GB', 'BR', 'AU', 'NZ', 'NO'
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
