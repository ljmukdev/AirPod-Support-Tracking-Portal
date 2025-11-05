# Stripe Payment Integration Setup

## Overview
This application uses Stripe to process payments for extended warranty purchases. Customers can purchase 3, 6, or 12-month extended warranty plans.

## Required Stripe Keys

You need two keys from your Stripe account:

1. **Publishable Key** (starts with `pk_`) - Used on the frontend
2. **Secret Key** (starts with `sk_`) - Used on the backend

## Step 1: Get Your Stripe Keys

1. Log in to your Stripe Dashboard: https://dashboard.stripe.com
2. Go to **Developers** → **API keys**
3. You'll see two keys:
   - **Publishable key** (visible, starts with `pk_test_` for test mode or `pk_live_` for live mode)
   - **Secret key** (hidden, click "Reveal test key" or "Reveal live key")

## Step 2: Add Keys to Railway Environment Variables

**⚠️ IMPORTANT: Do NOT commit your Stripe keys to Git. Add them directly in Railway.**

1. Go to Railway Dashboard → Your App Service → **Variables** tab
2. Click **"New Variable"** and add these two environment variables:

**Variable 1:**
- **Name:** `STRIPE_PUBLISHABLE_KEY`
- **Value:** Your publishable key from Stripe Dashboard (starts with `pk_test_` for test mode)

**Variable 2:**
- **Name:** `STRIPE_SECRET_KEY`  
- **Value:** Your secret key from Stripe Dashboard (starts with `sk_test_` for test mode)

**Your Test Keys:**
- Publishable Key: Available in your Stripe Dashboard under Developers → API keys
- Secret Key: Available in your Stripe Dashboard (click "Reveal test key")

**Security Notes:**
- ✅ Add keys directly in Railway dashboard (never commit to Git)
- ✅ Use TEST keys (`pk_test_` and `sk_test_`) for testing
- ✅ When ready for production, use LIVE keys (`pk_live_` and `sk_live_`)
- ❌ Never commit secret keys to Git (GitHub will block the push)

**Important:**
- Use **test keys** (`pk_test_` and `sk_test_`) for testing
- Use **live keys** (`pk_live_` and `sk_live_`) for production
- Never commit these keys to Git
- Keep your secret key secure - it's already in `.gitignore`

## Step 3: Test the Integration

1. Railway will automatically redeploy when you add the variables
2. Go to your warranty registration page
3. Select an extended warranty option (3, 6, or 12 months)
4. You should see the payment form appear
5. Use Stripe test card numbers:
   - **Success:** `4242 4242 4242 4242`
   - **Decline:** `4000 0000 0000 0002`
   - **3D Secure:** `4000 0025 0000 3155`
   - Use any future expiry date (e.g., 12/25)
   - Use any 3-digit CVC
   - Use any ZIP code

## Step 4: Switch to Live Mode (Production)

When you're ready for real payments:

1. Activate your Stripe account (if not already)
2. Get your **live** publishable and secret keys from Stripe Dashboard
3. Update the Railway environment variables with live keys
4. Test with a small real transaction first

## Payment Flow

1. Customer selects extended warranty → Payment form appears
2. Customer enters card details → Stripe Elements validates in real-time
3. Customer submits → Payment intent created on server
4. Payment processed → Stripe confirms payment
5. Warranty registered → Payment intent ID stored with warranty record

## Security Features

- ✅ Payment details never touch your server (handled by Stripe)
- ✅ Payment verification before warranty registration
- ✅ Amount verification to prevent price manipulation
- ✅ Receipt emails sent automatically by Stripe
- ✅ PCI compliance handled by Stripe

## Troubleshooting

### "Payment system not configured" error
- Check that both `STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` are set in Railway
- Verify keys start with `pk_` and `sk_` respectively
- Make sure keys match (both test or both live)

### Payment fails
- Check Stripe Dashboard → Payments for error details
- Verify card details are correct
- Check server logs for Stripe API errors

### Payment succeeds but warranty not registered
- Check server logs for database errors
- Verify MongoDB connection is working
- Check that payment intent verification is succeeding

## Stripe Dashboard

Monitor payments in your Stripe Dashboard:
- **Payments:** View all transactions
- **Customers:** See customer payment history
- **Logs:** Debug API errors
- **Webhooks:** (Optional) Set up webhooks for payment status updates

## Support

For Stripe-specific issues:
- Stripe Documentation: https://stripe.com/docs
- Stripe Support: support@stripe.com

For application issues:
- Check server logs in Railway dashboard
- Verify environment variables are set correctly

