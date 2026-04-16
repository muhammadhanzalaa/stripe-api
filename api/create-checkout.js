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
      
      let userCurrency = currency ? currency.toLowerCase() : 'eur';
      const country = country_code ? country_code.toUpperCase() : 'NL';

      if (country === 'PL') {
          userCurrency = 'pln';
      }

      // --- Smart Methods Logic ---
      // 'card' hamesha rahega taake Wallets (Apple/Google Pay) trigger ho sakein
      let methods = ['card']; 

      if (country === 'NL') { methods.push('ideal'); }
      else if (country === 'BE') { methods.push('bancontact'); }
      else if (country === 'AT') { methods.push('eps'); }
      else if (country === 'PL') { methods.push('p24', 'blik'); }
      else if (country === 'PT') { methods.push('multibanco'); }
      
      // Germany aur baqi EU ke liye Klarna add karna
      const klarnaSupported = ['DE', 'AT', 'BE', 'NL', 'ES', 'IT', 'FR'];
      if (klarnaSupported.includes(country)) {
          methods.push('klarna');
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: methods,
        
        // --- Wallets (Apple/Google Pay) Display Fix ---
        // 'payment_method_options' card ke andar wallets ko force karta hai
        payment_method_options: {
          card: {
            request_three_d_secure: 'any',
          },
        },

        // Is se country by-default wahi select hogi jo Shopify se aayi hai
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
