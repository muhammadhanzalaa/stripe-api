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

      // --- 1. Wallet Support (Apple/Google Pay) ---
      // Apple Pay/Google Pay ke liye Dashboard par 'automatic_payment_methods' behtar hai,
      // lekin restriction ke liye hum isse ID se connect karenge.
      
      let methods = ['card']; 

      // --- 2. Country-wise Restriction Logic ---
      if (country === 'NL') { methods.push('ideal'); }
      else if (country === 'BE') { methods.push('bancontact'); }
      else if (country === 'AT') { methods.push('eps'); }
      else if (country === 'PL') { methods.push('p24', 'blik'); }
      else if (country === 'PT') { methods.push('multibanco'); }

      // EU Countries ke liye Klarna
      const klarnaCountries = ['AT', 'BE', 'DE', 'ES', 'FR', 'IT', 'NL', 'PL', 'PT'];
      if (klarnaCountries.includes(country)) {
          methods.push('klarna');
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: methods,
        
        // --- 3. Default Country Fix ---
        // Is se Shopify wali country by-default Checkout par select ho jayegi
        shipping_address_collection: { 
            allowed_countries: [country] 
        },

        // Email pass karne se Stripe customer ki identity jaldi recognize karta hai
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
