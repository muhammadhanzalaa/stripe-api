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
        customer_email,
        quantity // Frontend se dynamic quantity (1, 2, ya 3)
      } = req.body;

      const country = country_code ? country_code.toUpperCase() : 'DE';

      // Currency Logic (PLN support added)
      let userCurrency = 'eur';
      if (country === 'PL') userCurrency = 'pln';
      else if (currency) userCurrency = currency.toLowerCase();

      // Original Payment Methods
      let methods = ['card', 'link'];
      const klarnaSupportedCurrencies = ['eur', 'usd', 'gbp'];
      if (klarnaSupportedCurrencies.includes(userCurrency)) {
        methods.push('klarna');
      }

      if (country === 'NL') methods.push('ideal');
      else if (country === 'BE') methods.push('bancontact');
      else if (country === 'AT') methods.push('eps');
      else if (country === 'PL') methods.push('p24', 'blik');
      else if (country === 'PT') methods.push('multibanco');

      const session = await stripe.checkout.sessions.create({
        payment_method_types: methods,
        billing_address_collection: 'required',
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
              description: variant_name // Yahan sahi colors (White/Purple/Green) show honge
            },
            unit_amount: Math.round(parseFloat(price) * 100)
          },
          // ✅ Price Multiplication Fix: Stripe Price * Quantity karega
          quantity: parseInt(quantity) || 1 
        }],
        mode: 'payment',
        success_url: `https://www.lonovos.com/pages/thank-you`,
        cancel_url: `https://www.lonovos.com/`
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
};
