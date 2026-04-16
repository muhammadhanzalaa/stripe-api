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

      // --- Smart Restriction Logic ---
      // Hum 'card' ko hamesha enable rakhenge (Apple/Google Pay ke liye)
      // Baqi specific methods ko sirf related country ke liye append karenge.
      
      let restricted_methods = ['card'];

      if (country === 'NL') {
          restricted_methods.push('ideal');
      } else if (country === 'BE') {
          restricted_methods.push('bancontact');
      } else if (country === 'AT') {
          restricted_methods.push('eps');
      } else if (country === 'PL') {
          restricted_methods.push('p24', 'blik');
      } else if (country === 'PT') {
          restricted_methods.push('multibanco');
      } 
      // Germany ke liye Sofort/Klarna use kar sakte hain agar on hain
      // else if (country === 'DE') { restricted_methods.push('sofort'); }

      // Default rules: related regions mein Klarna allow karna
      const euCountriesWithKlarna = ['AT', 'BE', 'DK', 'FI', 'FR', 'DE', 'IT', 'NL', 'NO', 'ES', 'SE', 'CH', 'GB'];
      if (euCountriesWithKlarna.includes(country)) {
          restricted_methods.push('klarna');
      }

      const session = await stripe.checkout.sessions.create({
        // Ab manual restrict kar di list taake Portugal mein iDEAL na dikhe
        payment_method_types: restricted_methods, 

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
