        // Line Items se Product IDs nikalne ka safe extracted array
        const productIdsArray = stripeLineItems.data.length > 0
          ? stripeLineItems.data.map(item => item.price?.product || "product_id")
          : ["product_id"];
 
        const metaPayload = {
          data: [
            {
              event_name: "Purchase",
              event_time: session.created || Math.floor(Date.now() / 1000), // Original transaction time for better matching
              event_id: session.id,
              event_source_url: `https://${process.env.SHOPIFY_STORE_URL || ''}`,
              action_source: "website",
              user_data: {
                em: emailHashed ? [emailHashed] : [],
                fn: firstNameHashed ? [firstNameHashed] : [],
                ln: lastNameHashed ? [lastNameHashed] : [],
                ph: phoneHashed ? [phoneHashed] : [],
                country: countryHashed ? [countryHashed] : [],
                client_ip_address: clientIp,
                client_user_agent: clientUserAgent
              },
              custom_data: {
                currency: orderCurrency.toLowerCase(),
                value: session.amount_total / 100,
                content_type: "product",
                // ✅ FIX 2: Top-level content_ids array pass kiya taake Facebook standard validation pass ho sake
                content_ids: productIdsArray,
                contents: stripeLineItems.data.length > 0
                  ? stripeLineItems.data.map(item => ({
                      id: item.price?.product || "product_id",
                      quantity: item.quantity || 1,
                      item_price: item.amount_total / 100
                    }))
                  : [{ id: "product_id", quantity: 1, item_price: session.amount_total / 100 }]
              }
            }
          ]
        };
 
        await axios.post(
          `https://graph.facebook.com/v19.0/${metaPixelId}/events?access_token=${metaAccessToken}`,
          metaPayload,
          { headers: { 'Content-Type': 'application/json' } }
        );
 
        console.log("🔥 Meta CAPI Purchase Event Sent Successfully!");
      } else {
        console.log("⚠️ Meta Pixel ID or Access Token missing in Env. Skipping CAPI.");
      }
    } catch (metaError) {
      console.error("❌ Meta CAPI Process Error Log:", metaError.response ? JSON.stringify(metaError.response.data) : metaError.message);
    }
  }
 
  res.status(200).json({ received: true });
};
