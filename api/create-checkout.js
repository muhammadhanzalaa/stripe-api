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
      
      // Basic methods jo har country mein honge (Card includes Apple/Google Pay)
      let final_methods = ['card', 'link', 'klarna']; 

      // --- STRICT EU MANUAL MAPPING (Logic Preserved & Enhanced) ---
      const country = country_code ? country_code.toUpperCase() : 'NL';

      if (country === 'AT') {
          final_methods = ['card', 'link', 'klarna', 'eps']; 
      } else if (country === 'BE') {
          final_methods = ['card', 'link', 'klarna', 'bancontact']; 
      } else if (country === 'NL') {
          final_methods = ['card', 'link', 'klarna', 'ideal']; 
      } else if (country === 'PL') {
          // Poland mein Klarna ki jagah P24/Blik zyada chaltay hain
          final_methods = ['card', 'link', 'p24', 'blik']; 
          userCurrency = 'pln';
      } else if (country === 'PT') {
          final_methods = ['card', 'link', 'multibanco']; 
      } else if (country === 'DE') {
          final_methods = ['card', 'link', 'klarna', 'giropay']; 
      } else if (country === 'IT' || country === 'ES' || country === 'FR') {
          final_methods = ['card', 'link', 'klarna']; 
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: final_methods,
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
