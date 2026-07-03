          currency: userCurrency,
          product_data: {
            name: `${product_name || 'Product'} - ${variant_name || 'Standard'}`,
            images: [validImage]
          },
          unit_amount: Math.round(parseFloat(price || 0) * 100)
        },
        quantity: 1
      });
    }

    // Zero-value validation check
    if (lineItems.length === 0 || lineItems[0].price_data.unit_amount <= 0) {
      return res.status(400).json({ error: 'Invalid checkout parameters or zero amount value.' });
    }

    // ✅ STEP 5: Create Stripe Session Config
    const sessionConfig = {
      payment_method_types: methods,
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      line_items: lineItems,
      mode: 'payment',
      payment_intent_data: {
        description: `Order for ${product_name || 'Product'} (${variant_name || 'Standard'})`
      },
      metadata: {
        product_name: product_name || '',
        variant_name: variant_name || '',
        variants: variant_name || 'Standard'
      },
      success_url: `https://www.lonovos.com/pages/thank-you`,
      cancel_url: `https://www.lonovos.com/`
    };

    // ✅ STEP 6: Smart Dynamic Shipping Filter (Bypasses 504 Timeout)
    const stripeSupportedShipping = ['US', 'CA', 'GB', 'AU', 'NZ', 'DE', 'FR', 'NL', 'AT', 'BE', 'PL', 'PT', 'IT', 'ES', 'IE'];
    
    if (stripeSupportedShipping.includes(country)) {
      sessionConfig.shipping_address_collection = {
        allowed_countries: [country]
      };
    } else {
      // Agar India/Pakistan jaisi unsupported country hai, toh safe array mix pass karo taake API freeze na ho
      sessionConfig.shipping_address_collection = {
        allowed_countries: [country, 'US', 'GB', 'DE'].filter(c => c === country || stripeSupportedShipping.includes(c)).slice(0, 25)
      };
    }

    if (customer_email && customer_email.trim() !== "") {
      sessionConfig.customer_email = customer_email.trim();
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('❌ Stripe Engine Session Error:', err.message);
    return res.status(400).json({ error: err.message });
  }
};
