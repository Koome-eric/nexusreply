# PayPal Subscription Setup

## Creating PayPal Subscription Plans

Since PayPal is now in live mode, you need to create subscription plans in the PayPal dashboard. Here's how:

### 1. Go to PayPal Developer Dashboard
- Visit: https://developer.paypal.com/dashboard/
- Make sure you're in Live mode (not Sandbox)

### 2. Create Products (one for each plan)
Go to Products & Plans → Products → Create Product

**Starter Product:**
- Name: `NexusReply Starter`
- Description: `1 location, 2,000 AI messages/month`
- Type: `Service`
- Category: `Software`

**Pro Product:**
- Name: `NexusReply Pro`
- Description: `Up to 5 locations, 8,000 AI messages/month`
- Type: `Service`
- Category: `Software`

**Agency Product:**
- Name: `NexusReply Agency`
- Description: `Up to 15 locations, 25,000 AI messages/month`
- Type: `Service`
- Category: `Software`

### 3. Create Subscription Plans
For each product, go to Products & Plans → Plans → Create Plan

**Common Settings for All Plans:**
- Plan Type: `Fixed`
- Billing Frequency: `Monthly`
- Billing Cycles: `0` (infinite)
- Auto Bill: `Yes`
- Payment Failure Threshold: `1`

**Starter Plan ($97/month):**
- Product: NexusReply Starter
- Plan Name: `NexusReply Starter Monthly`
- Price: `$97.00 USD`

**Pro Plan ($197/month):**
- Product: NexusReply Pro
- Plan Name: `NexusReply Pro Monthly`
- Price: `$197.00 USD`

**Agency Plan ($397/month):**
- Product: NexusReply Agency
- Plan Name: `NexusReply Agency Monthly`
- Price: `$397.00 USD`

### 4. Get Plan IDs
After creating each plan, go to the plan details and copy the Plan ID (starts with `P-`).

### 5. Update .env file
Add the plan IDs to your `.env` file:

```env
PAYPAL_STARTER_PLAN_ID="P-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
PAYPAL_PRO_PLAN_ID="P-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
PAYPAL_AGENCY_PLAN_ID="P-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

### 6. Test the Integration
- Restart your application
- Try purchasing with PayPal in the checkout flow
- Verify subscriptions are created and activated properly

## API Endpoints Used

- `POST /api/billing/paypal-create-order` - Creates subscription
- `POST /api/billing/paypal-capture-order` - Activates subscription after approval
- `GET /api/billing/paypal-approve` - Handles PayPal approval redirect

## Troubleshooting

If PayPal payments aren't working:
1. Check that `PAYPAL_BASE_URL` is set to `https://api-m.paypal.com` (live)
2. Verify plan IDs are correct and active
3. Check PayPal dashboard for any errors
4. Ensure your PayPal account is verified for subscriptions