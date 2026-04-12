const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const { product_name, variant_name, image_url, price, currency } = req.body;
      
      const referer = req.headers.referer || "https://lonovos.com/";
      const urlObj = new URL(referer);
      const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

      let userCurrency = currency ? currency.toLowerCase() : 'usd';
      let cleanPrice = parseFloat(price);
      
      // Khali array (No default cards)
      let payment_methods = []; 

      // --- ONLY GUARANTEED METHODS ---
      
      if (userCurrency === 'brl') {
        payment_methods = ['pix']; // Brazil
      } 
      else if (userCurrency === 'eur') {
        // Sirf wahi methods jo fast hain aur error nahi dete
        payment_methods = ['ideal', 'bancontact', 'eps', 'multibanco'];
      } 
      else if (userCurrency === 'pln') {
        payment_methods = ['p24', 'blik']; // Poland
      } else {
        // Fallback: Agar koi unknown currency ho toh iDEAL dikhaye crash hone ke bajaye
        payment_methods = ['ideal']; 
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: payment_methods,
        line_items: [{
          price_data: {
            currency: userCurrency,
            product_data: { 
              name: product_name, 
              images: [image_url], 
              description: variant_name || "Standard Selection" 
            },
            unit_amount: Math.round(cleanPrice * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        shipping_address_collection: { 
            allowed_countries: ['BR', 'PT', 'NL', 'PL', 'BE', 'DE', 'AT'] 
        },
        success_url: `${baseUrl}/pages/thank-you?value=${cleanPrice}&currency=${userCurrency}`, 
        cancel_url: `${baseUrl}`,                
      });

      return res.status(200).json({ url: session.url });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};
