import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { product_name, price } = req.body;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: product_name },
                    unit_amount: Math.round(price * 100), 
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: 'https://lonovos.com/success',
            cancel_url: 'https://lonovos.com/cart',
        });

        res.status(200).json({ url: session.url });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}
