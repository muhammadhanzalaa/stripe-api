const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const event = req.body;

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const orderData = {
        order: {
          line_items: [
            {
              // create-checkout.js mein jo metadata bheja tha wahi yahan use karna hai
              title: session.metadata.product || "Stripe Order", 
              price: (session.amount_total / 100).toFixed(2),
              quantity: 1
            }
          ],
          customer: {
            email: session.customer_details.email,
            first_name: session.customer_details.name || "Customer"
          },
          shipping_address: {
            address1: session.shipping_details?.address?.line1 || "",
            city: session.shipping_details?.address?.city || "",
            zip: session.shipping_details?.address?.postal_code || "",
            country: session.shipping_details?.address?.country || "",
            first_name: session.customer_details.name || "Customer"
          },
          // Variants ko notes mein daal rahe hain taake admin dekh sake
          note: `Selected Variants: ${session.metadata.full_variants || "None"}`,
          financial_status: "paid"
        }
      };

      try {
        const shopifyUrl = process.env.SHOPIFY_STORE_URL.includes('myshopify.com') 
          ? process.env.SHOPIFY_STORE_URL 
          : `${process.env.SHOPIFY_STORE_URL}.myshopify.com`;

        await axios.post(
          `https://${shopifyUrl}/admin/api/2024-01/orders.json`,
          orderData,
          {
            headers: {
              'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log("Order created successfully in Shopify");
      } catch (err) {
        console.error("Shopify Order Error:", err.response ? err.response.data : err.message);
      }
    }
    res.status(200).send('Webhook Received');
  } else {
    res.status(405).send('Method Not Allowed');
  }
};
