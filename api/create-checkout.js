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

      // --- Client ki Shart: Country wise Gateways ---
      // Yahan hum wo tamam methods add kar rahe hain jo aapne dashboard par on kiye hain
      let final_methods = ['card']; 

      if (country === 'AT') {
          final_methods = ['card', 'eps', 'klarna']; 
      } else if (country === 'BE') {
          final_methods = ['card', 'bancontact', 'klarna']; 
      } else if (country === 'NL') {
          final_methods = ['card', 'ideal', 'klarna']; 
      } else if (country === 'PL') {
          final_methods = ['card', 'p24', 'blik']; 
          userCurrency = 'pln';
      } else if (country === 'PT') {
          final_methods = ['card', 'multibanco']; 
      } else if (country === 'DE') {
          final_methods = ['card', 'giropay', 'sofort', 'klarna']; 
      } else if (country === 'FR') {
          final_methods = ['card', 'cartes_bancaires'];
      } else {
          // Default for other EU/US countries
          final_methods = ['card', 'klarna', 'afterpay_clearpay'];
      }

      const session = await stripe.checkout.sessions.create({
        // automatic_payment_methods ko hata diya taake error na aaye
        payment_method_types: final_methods, 
        
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
