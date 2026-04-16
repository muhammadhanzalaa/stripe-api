const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const {
        product_name,
        variant_name,
        image_url,
        price,
        currency,
        country_code,
        customer_email
      } = req.body;

      // Product page se jo code aayega wahi use hoga
      const country = country_code ? country_code.toUpperCase() : 'DE';

      // ✅ SAFE CURRENCY LOGIC
      let userCurrency = 'eur';

      if (country === 'PL') userCurrency = 'pln';
      else if (country === 'IN') userCurrency = 'inr'; // India ke liye INR
      else if (currency) userCurrency = currency.toLowerCase();

      // ✅ BASE METHODS
      let methods = ['card', 'link'];

      // ✅ ADD KLARNA ONLY IF SUPPORTED
      const klarnaSupportedCurrencies = ['eur', 'usd', 'gbp'];

      if (klarnaSupportedCurrencies.includes(userCurrency)) {
        methods.push('klarna');
      }

      // ✅ COUNTRY SPECIFIC METHODS
      if (country === 'NL') methods.push('ideal');
      else if (country === 'BE') methods.push('bancontact');
      else if (country === 'AT') methods.push('eps');
      else if (country === 'PL') methods.push('p24', 'blik');
      else if (country === 'PT') methods.push('multibanco');
      else if (country === 'IN') methods.push('upi'); // India ke liye UPI add kar diya

      const session = await stripe.checkout.sessions.create({
        payment_method_types: methods,

        billing_address_collection: 'required',

        // ✅ ENABLE STATE/REGION OPTION
        // Is se address mein State ka option nazar aayega
        custom_text: {
            shipping_address_牽: {message: "Please provide your full state/region for delivery."},
        },
        
        // Is line se State/Province lazmi ho jata hai address field mein
        shipping_address_collection: {
          allowed_countries: [country]
        },

        customer_email: customer_email || undefined,

        phone_number_collection: {
          enabled: true
        },

        line_items: [
          {
            price_data: {
              currency: userCurrency,
              product_data: {
                name: product_name,
                images: [image_url],
                description: variant_name
              },
              unit_amount: Math.round(parseFloat(price) * 100)
            },
            quantity: 1
          }
        ],

        mode: 'payment',
        
        // Is se billing address mein state field trigger hoti hai
        automatic_tax: { enabled: false }, 

        success_url: `https://lonovos.com/pages/thank-you`,
        cancel_url: `https://lonovos.com/`
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
