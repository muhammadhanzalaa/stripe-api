const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { product_name, variant_name, image_url, price, currency, country_code } = req.body;
      
      let userCurrency = currency ? currency.toLowerCase() : 'eur';
      let final_methods = ['card']; 

      // --- STRICT EU MANUAL MAPPING (Logic preserved) ---
      const country = country_code ? country_code.toUpperCase() : 'NL';

      if (country === 'AT') {
          final_methods = ['card', 'eps']; 
      } else if (country === 'BE') {
          final_methods = ['card', 'bancontact']; 
      } else if (country === 'NL') {
          final_methods = ['card', 'ideal']; 
      } else if (country === 'PL') {
          final_methods = ['card', 'p24', 'blik']; 
          userCurrency = 'pln';
      } else if (country === 'PT') {
          final_methods = ['card', 'multibanco']; 
      } else if (country === 'DE') {
          final_methods = ['card', 'giropay']; 
      } else if (country === 'IT' || country === 'ES' || country === 'FR') {
          final_methods = ['card']; 
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: final_methods,
        // --- NEW: Phone Number Collection ---
        phone_number_collection: {
            enabled: true,
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
        shipping_address_collection: { 
            allowed_countries: [
              'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
              'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
              'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'GB', 'US', 'CA', 'AU'
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
