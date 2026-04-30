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
        line_items_data
      } = req.body;
      // ✅ STEP 1: Country handle karein
      const country = country_code ? country_code.toUpperCase() : 'DE';
      // ✅ STEP 2: Currency Fix - Pehle Shopify ki bheji hui currency ko check karein
      let userCurrency = 'eur'; // Default
      if (currency) {
        userCurrency = currency.toLowerCase();
      } else if (country === 'PL') {
        userCurrency = 'pln';
      }
      // ✅ STEP 3: Payment Methods setup
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
      // ✅ STEP 4: Line Items Build Karo (Title + Variant Mix)
      let lineItems = [];
      if (line_items_data && line_items_data.length > 0) {
        // Multi-Item / Bundle Logic
        line_items_data.forEach(item => {
          lineItems.push({
            price_data: {
              currency: userCurrency,
              product_data: {
                name: `${product_name} - ${item.variant}`,
                images: [image_url]
              },
              unit_amount: Math.round(parseFloat(item.price) * 100)
            },
            quantity: 1
          });
        });
      } else {
        // Single Item Logic
        lineItems.push({
          price_data: {
            currency: userCurrency,
            product_data: {
              name: `${product_name} - ${variant_name}`,
              images: [image_url]
            },
            unit_amount: Math.round(parseFloat(price) * 100)
          },
          quantity: 1
        });
      }
      // ✅ STEP 5: Create Stripe Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: methods,
        billing_address_collection: 'required',
        shipping_address_collection: {
          allowed_countries: [country]
        },
        customer_email: customer_email || undefined,
        phone_number_collection: { enabled: true },
        line_items: lineItems,
        mode: 'payment',
        payment_intent_data: {
          description: `Order for ${product_name} (${variant_name})`,
        },
        // ✅ FIX: Metadata add kiya taake webhook product_name aur variant_name le sake
        metadata: {
          product_name: product_name || "",
          variant_name: variant_name || "",
          variants: variant_name || "Standard"
        },
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
