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
      const country = country_code ? country_code.toUpperCase() : 'NL';

      if (country === 'PL') {
          userCurrency = 'pln';
      }

      const session = await stripe.checkout.sessions.create({
        // 1. automatic_payment_methods nikal diya taake error khatam ho jaye
        // 2. Is ID ke andar dashboard par saare methods pehle se on hain
        payment_method_configuration: 'pmc_1T8NtZPgLCQN2LvdTbTcDjqY',

        phone_number_collection: {
            enabled: true,
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
