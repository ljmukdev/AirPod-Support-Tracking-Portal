# Payment Setup Summary

## What's Already Configured ✅

Your application already has Stripe payment integration fully implemented! Here's what's in place:

### Frontend (Customer-Facing)
- ✅ Stripe Elements integration for secure card input
- ✅ Real-time card validation
- ✅ Payment processing flow
- ✅ Error handling and user feedback

### Backend (Server)
- ✅ Stripe API integration
- ✅ Payment intent creation
- ✅ Payment verification before warranty registration
- ✅ Amount validation to prevent manipulation
- ✅ Payment intent ID stored with warranty records

## What You Need to Do

### Step 1: Add Stripe Keys to Railway

1. **Get your Stripe keys:**
   - Log in to Stripe Dashboard: https://dashboard.stripe.com
   - Go to **Developers** → **API keys**
   - Copy your **Publishable key** (starts with `pk_test_`)
   - Click "Reveal test key" to see your **Secret key** (starts with `sk_test_`)

2. **Add to Railway:**
   - Go to Railway Dashboard → Your App Service → **Variables** tab
   - Add these two environment variables:

   **Variable 1:**
   - Name: `STRIPE_PUBLISHABLE_KEY`
   - Value: Your publishable key (e.g., `pk_test_51SQ90CGxj0aa6dcX...`)

   **Variable 2:**
   - Name: `STRIPE_SECRET_KEY`
   - Value: Your secret key (e.g., `sk_test_51SQ90CGxj0aa6dcX...`)

3. **Railway will automatically redeploy** when you add the variables

### Step 2: Test Payments

Once the keys are added, test with Stripe test cards:

- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- Use any future expiry date (e.g., 12/25)
- Use any 3-digit CVC
- Use any ZIP code

### Step 3: Switch to Live Mode (When Ready)

When you're ready for real payments:

1. Activate your Stripe account (if not already)
2. Get your **live** keys from Stripe Dashboard (switch from "Test mode" to "Live mode")
3. Update Railway environment variables with live keys:
   - `STRIPE_PUBLISHABLE_KEY` → Live publishable key (`pk_live_...`)
   - `STRIPE_SECRET_KEY` → Live secret key (`sk_live_...`)

## Payment Flow

1. Customer selects extended warranty (3, 6, or 12 months)
2. Payment form appears automatically
3. Customer enters card details (validated in real-time)
4. On submit:
   - Payment intent created on server
   - Payment processed by Stripe
   - Payment verified
   - Warranty registered with payment record
5. Customer receives confirmation

## Security Features

- ✅ Card details never touch your server (handled by Stripe)
- ✅ Payment verification before warranty registration
- ✅ Amount verification prevents price manipulation
- ✅ PCI compliance handled by Stripe
- ✅ Receipt emails sent automatically by Stripe

## Troubleshooting

**"Payment system not configured" error:**
- Check that both `STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` are set in Railway
- Verify keys start with `pk_` and `sk_` respectively
- Make sure keys match (both test or both live)

**Payment fails:**
- Check Stripe Dashboard → Payments for error details
- Verify card details are correct
- Check server logs in Railway for Stripe API errors

## Monitoring Payments

Monitor all payments in your Stripe Dashboard:
- **Payments:** View all transactions
- **Customers:** See customer payment history  
- **Logs:** Debug API errors

For more details, see `STRIPE_SETUP.md`





