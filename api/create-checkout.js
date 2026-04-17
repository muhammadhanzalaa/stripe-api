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

      const country = country_code ? country_code.toUpperCase() : 'DE';

      // ✅ SAFE CURRENCY LOGIC
      let userCurrency = 'eur';
      if (country === 'PL') userCurrency = 'pln';
      else if (country === 'IN') userCurrency = 'inr'; 
      else if (currency) userCurrency = currency.toLowerCase();

      // ✅ BASE METHODS
      let methods = ['card', 'link'];

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
      else if (country === 'IN') methods.push('upi'); 

      const session = await stripe.checkout.sessions.create({
        payment_method_types: methods,
        billing_address_collection: 'required',

        // ✅ FIXED STATE OPTION
        // Stripe automatic state/province field dikhata hai jab billing_address_collection required ho.
        // India, US, Canada ke liye ye field dropdown ban jayegi.
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
            unit_amount: Math.round(parseFloat(price) * 100)
          },
          quantity: 1
        }],

        mode: 'payment',
        success_url: `https://www.lonovos.com/pages/thank-you`,
        cancel_url: `https://www.lonovos.com/`
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      // ✅ Agar ab bhi error aaye toh ye exact Stripe error message dikhayega
      return res.status(400).json({ error: err.message });
    }
  }
};
