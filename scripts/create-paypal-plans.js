#!/usr/bin/env node

/**
 * PayPal Subscription Plan Creator
 *
 * This script creates PayPal subscription plans for NexusReply.
 * Run with: node scripts/create-paypal-plans.js
 *
 * Make sure to set PAYPAL_CLIENT_ID and PAYPAL_SECRET in your .env file first.
 */

const https = require('https');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com";

if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
  console.error("❌ Missing PayPal credentials. Set PAYPAL_CLIENT_ID and PAYPAL_SECRET in .env");
  process.exit(1);
}

// Get PayPal access token
async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');

    const options = {
      hostname: PAYPAL_BASE_URL.replace('https://', ''),
      path: '/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error('Failed to get access token: ' + data));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write('grant_type=client_credentials');
    req.end();
  });
}

// Create a product
async function createProduct(token, productData) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: PAYPAL_BASE_URL.replace('https://', ''),
      path: '/v1/catalogs/products',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `PRODUCT-${Date.now()}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 201) {
            resolve(response);
          } else {
            reject(new Error(`Product creation failed: ${res.statusCode} - ${data}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(productData));
    req.end();
  });
}

// Create a subscription plan
async function createPlan(token, planData) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: PAYPAL_BASE_URL.replace('https://', ''),
      path: '/v1/billing/plans',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `PLAN-${Date.now()}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 201) {
            resolve(response);
          } else {
            reject(new Error(`Plan creation failed: ${res.statusCode} - ${data}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(planData));
    req.end();
  });
}

// Plan configurations
const PLANS = [
  {
    key: 'starter',
    name: 'NexusReply Starter',
    description: '1 location, 2,000 AI messages/month',
    price: '97.00',
  },
  {
    key: 'pro',
    name: 'NexusReply Pro',
    description: 'Up to 5 locations, 8,000 AI messages/month',
    price: '197.00',
  },
  {
    key: 'agency',
    name: 'NexusReply Agency',
    description: 'Up to 15 locations, 25,000 AI messages/month',
    price: '397.00',
  },
];

async function main() {
  try {
    console.log("🔑 Getting PayPal access token...");
    const token = await getAccessToken();
    console.log("✅ Got access token");

    const planIds = {};

    for (const plan of PLANS) {
      console.log(`\n📦 Creating product for ${plan.key}...`);

      // Create product
      const product = await createProduct(token, {
        name: plan.name,
        description: plan.description,
        type: 'SERVICE',
        category: 'SOFTWARE',
        image_url: 'https://nexusreply.vercel.app/logo.png',
        home_url: 'https://nexusreply.vercel.app',
      });

      console.log(`✅ Created product: ${product.id}`);

      // Create plan
      console.log(`📋 Creating subscription plan for ${plan.key}...`);
      const planData = await createPlan(token, {
        product_id: product.id,
        name: `${plan.name} Monthly`,
        description: `${plan.description} - Monthly subscription`,
        billing_cycles: [{
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: plan.price,
              currency_code: 'USD',
            },
          },
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: 'CANCEL',
          payment_failure_threshold: 3,
        },
        taxes: {
          percentage: '0',
          inclusive: false,
        },
      });

      console.log(`✅ Created plan: ${planData.id}`);
      planIds[plan.key] = planData.id;
    }

    console.log("\n🎉 All plans created successfully!");
    console.log("\n📝 Add these to your .env file:");
    console.log(`PAYPAL_STARTER_PLAN_ID="${planIds.starter}"`);
    console.log(`PAYPAL_PRO_PLAN_ID="${planIds.pro}"`);
    console.log(`PAYPAL_AGENCY_PLAN_ID="${planIds.agency}"`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();