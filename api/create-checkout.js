const stripe = require('stripe')(process.env.STRIPE_SECRET);

module.exports = async (req, res) => {
    // Ye headers Shopify ko ijazat denge Stripe kholne ki
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'POST') {
        try {
            const { product_name, price } = req.body;
            
            // Price ko saaf karna (agar $ sign bhej raha ho shopify)
            const cleanPrice = parseFloat(price.toString().replace(/[^\d.]/g, ''));

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: { name: product_name },
                        unit_amount: Math.round(cleanPrice * 100), 
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: 'https://lonovos.com/success',
                cancel_url: 'https://lonovos.com/',
            });

            res.status(200).json({ url: session.url });
        } catch (err) {
            console.error("Stripe Error:", err.message);
            res.status(500).json({ error: err.message });
        }
    } else {
        res.status(405).json({ error: "Method not allowed" });
    }
};
