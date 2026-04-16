const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { product_name, variant_name, image_url, price, currency, country_code, customer_email } = req.body;
      
      const country = country_code ? country_code.toUpperCase() : 'DE';
      let userCurrency = (country === 'PL') ? 'pln' : (currency ? currency.toLowerCase() : 'eur');

      // --- GLOBAL FORCED METHODS ---
      // 'card' ke sath Google Pay/Apple Pay automatic trigger hote hain
      // 'klarna' aur 'link' ko humne global list mein dal diya hai
      let methods = ['card', 'link', 'klarna']; 

      // --- COUNTRY SPECIFIC EXTRA METHODS ---
      if (country === 'NL') { methods.push('ideal'); }
      else if (country === 'BE') { methods.push('bancontact'); }
      else if (country === 'AT') { methods.push('eps'); }
      else if (country === 'PL') { methods.push('p24', 'blik'); }
      else if (country === 'PT') { methods.push('multibanco'); }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: methods,

        // Wallets ko display karwane ke liye important options
        payment_method_options: {
          card: {
            request_three_d_secure: 'any',
          },
          klarna: {
            setup_future_usage: 'none',
          }
        },

        shipping_address_collection: { 
            allowed_countries: [country] 
        },

        customer_email: customer_email || undefined,
        phone_number_collection: { enabled: true },
        
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
        success_url: `https://lonovos.com/pages/thank-you`,
        cancel_url: `https://lonovos.com/`,
      });

      return res.status(200).json({ url: session.url });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
