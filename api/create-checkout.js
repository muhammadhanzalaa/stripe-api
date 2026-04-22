const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { product_name, variant_name, image_url, price, currency, country_code, customer_email, quantity } = req.body;

      const country = country_code ? country_code.toUpperCase() : 'DE';
      let userCurrency = (country === 'PL') ? 'pln' : (currency ? currency.toLowerCase() : 'eur');

      // Original Payment Method Logic
      let methods = ['card', 'link'];
      const klarnaSupported = ['eur', 'usd', 'gbp'];
      if (klarnaSupported.includes(userCurrency)) { methods.push('klarna'); }
      if (country === 'NL') methods.push('ideal');
      else if (country === 'BE') methods.push('bancontact');
      else if (country === 'AT') methods.push('eps');
      else if (country === 'PL') methods.push('p24', 'blik');

      const session = await stripe.checkout.sessions.create({
        payment_method_types: methods,
        billing_address_collection: 'required',
        shipping_address_collection: { allowed_countries: [country] },
        customer_email: customer_email || undefined,
        phone_number_collection: { enabled: true },
        line_items: [{
          price_data: {
            currency: userCurrency,
            product_data: { 
              name: product_name, 
              images: [image_url], 
              description: variant_name // ✅ Now picks correct Purple/White/Green
            },
            unit_amount: Math.round(parseFloat(price) * 100)
          },
          // ✅ FIX: This line doubles the price on checkout if quantity is 2
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
