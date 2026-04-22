const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  // 1. CORS Headers
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
        quantity
      } = req.body;

      // 2. Country & Currency Setup
      const country = country_code ? country_code.toUpperCase() : 'DE';
      let userCurrency = currency ? currency.toLowerCase() : 'eur';
      if (country === 'PL' && !currency) userCurrency = 'pln';

      // 3. Payment Methods Logic (Aapka original logic)
      let methods = ['card', 'link'];
      const klarnaCurrencies = ['eur', 'usd', 'gbp'];
      if (klarnaCurrencies.includes(userCurrency)) methods.push('klarna');
      
      if (country === 'NL') methods.push('ideal');
      else if (country === 'BE') methods.push('bancontact');
      else if (country === 'AT') methods.push('eps');
      else if (country === 'PL') methods.push('p24', 'blik');
      else if (country === 'PT') methods.push('multibanco');

      // 4. Create Stripe Session
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
              description: variant_name // Shows correctly selected colors
            },
            /* IMPORTANT FIX: 
               Stripe cents mein amount leta hai. 
               Math.round() decimals ko round-off kar deta hai taake 
               Stripe API error na de (e.g. 1932.66666 cents invalid hain).
            */
            unit_amount: Math.round(parseFloat(price) * 100)
          },
          // Frontend se aayi hui quantity (1 ya 3)
          quantity: parseInt(quantity) || 1 
        }],
        mode: 'payment',
        success_url: `https://www.lonovos.com/pages/thank-you`,
        cancel_url: `https://www.lonovos.com/`
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      console.error("Stripe Error:", err.message);
      return res.status(400).json({ error: err.message });
    }
  }
};
