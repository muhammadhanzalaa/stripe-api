const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      // Front-end (Beast Converter) se aane wali currency yahan capture hogi
      const { product_name, variant_name, image_url, price, quantity, currency } = req.body;
      const cleanPrice = parseFloat(price);
      
      // Agar currency nahi aayi toh default 'eur' rakhein
      const userCurrency = currency ? currency.toLowerCase() : 'eur';
      const finalAmount = Math.round(cleanPrice * 100);

      // --- DYNAMIC PAYMENT METHODS LOGIC ---
      let payment_methods = []; 

      if (userCurrency === 'brl') {
        payment_methods.push('pix'); // Brazil + BRL currency = Pix enabled
      } else if (userCurrency === 'pln') {
        payment_methods.push('p24'); // Poland + PLN currency = Blik/P24 enabled
      } else if (userCurrency === 'eur') {
        payment_methods.push('ideal', 'multibanco', 'bancontact', 'eps'); // EU methods
      }

      // Fallback: Agar koi local method match na ho (Card deactivated hai)
      if (payment_methods.length === 0) {
          payment_methods = ['ideal']; 
      }

      let line_items = [];
      line_items.push({
        price_data: {
          currency: userCurrency, // Ye symbol ($ vs € vs zł) auto-change karega
          product_data: { 
            name: product_name, 
            images: [image_url], 
            description: `Variant: ${variant_name}` 
          },
          unit_amount: finalAmount,
        },
        quantity: 1,
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: payment_methods, // Card deactivated as requested
        automatic_tax: { enabled: false },
        line_items: line_items,
        mode: 'payment',
        // Shipping list se India (IN) removed
        shipping_address_collection: { 
            allowed_countries: ['BR', 'PT', 'NL', 'PL', 'BE', 'DE', 'AT'] 
        },
        success_url: `https://lonovos.com/pages/thank-you?value=${cleanPrice}&currency=${userCurrency}`, 
        cancel_url: 'https://lonovos.com/',                
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
