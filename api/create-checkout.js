const session = await stripe.checkout.sessions.create({
  // 1. Sirf wo methods jo dashboard par active hain
  payment_method_types: ['card', 'us_bank_account'], 
  
  phone_number_collection: { enabled: true },
  line_items: [{
    price_data: {
      currency: 'usd',
      product_data: { name: product_name || "Product" },
      unit_amount: Math.round(cleanPrice * 100),
    },
    quantity: 1,
  }],
  mode: 'payment',
  billing_address_collection: 'required',
  shipping_address_collection: {
    // 2. Saudi, Oman, Europe saari countries yahan add hain
    allowed_countries: [
      'SA', 'OM', 'AE', 'KW', 'QA', 'BH', 
      'US', 'CA', 'GB', 'AU', 'NZ', 'PK', 'IN', 
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
      'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
      'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'NO'
    ],
  },
  success_url: 'lonovos.com/pages/thank-you',
  cancel_url: 'https://lonovos.com/',
});
