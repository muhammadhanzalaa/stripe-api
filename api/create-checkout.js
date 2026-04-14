const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      // Ab hum 'country_code' frontend se le rahe hain
      const { product_name, variant_name, image_url, price, currency, country_code } = req.body;
      
      let userCurrency = currency ? currency.toLowerCase() : 'eur';
      let final_methods = ['card']; // Default card toh hamesha rahega

      // --- STRICT MANUAL MAPPING ---
      const country = country_code ? country_code.toUpperCase() : 'NL';

      if (country === 'AT') {
          final_methods = ['card', 'eps']; // Austria ke liye sirf EPS
          userCurrency = 'eur';
      } else if (country === 'BE') {
          final_methods = ['card', 'bancontact']; // Belgium ke liye Bancontact
          userCurrency = 'eur';
      } else if (country === 'NL') {
          final_methods = ['card', 'ideal']; // Netherlands ke liye iDEAL
          userCurrency = 'eur';
      } else if (country === 'PL') {
          final_methods = ['card', 'p24', 'blik']; // Poland ke liye P24/Blik
          userCurrency = 'pln';
      } else if (country === 'PT') {
          final_methods = ['card', 'multibanco'];
          userCurrency = 'eur';
      } else if (country === 'DE') {
          final_methods = ['card', 'giropay'];
          userCurrency = 'eur';
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: final_methods, 
        line_items: [{
          price_data: {
            currency: userCurrency,
            product_data: { name: product_name, images: [image_url], description: variant_name },
            unit_amount: Math.round(parseFloat(price) * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        // User ne jo country select ki thi, checkout par wahi pre-fill hogi
        shipping_address_collection: { 
            allowed_countries: [
              'AT', 'BE', 'DE', 'NL', 'PL', 'PT', 'DK', 'SE', 'CH', 'US', 'GB', 'CA', 'AU'
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

