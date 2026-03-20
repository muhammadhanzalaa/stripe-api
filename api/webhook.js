const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const event = req.body;

    // Check karein ke payment success hui hai ya nahi
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Shopify Order Data
      const orderData = {
        order: {
          line_items: [
            {
              title: session.metadata.product_name || "Stripe Order",
              price: (session.amount_total / 100).toFixed(2),
              quantity: 1,
              notes: session.metadata.bundle_info || ""
            }
          ],
          customer: {
            email: session.customer_details.email,
            first_name: session.customer_details.name || "Customer"
          },
          billing_address: {
            address1: session.shipping_details?.address?.line1 || "",
            city: session.shipping_details?.address?.city || "",
            zip: session.shipping_details?.address?.postal_code || "",
            country: session.shipping_details?.address?.country || ""
          },
          financial_status: "paid"
        }
      };

      try {
        // Shopify API ko order bhejna
        await axios.post(
          `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/orders.json`,
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
