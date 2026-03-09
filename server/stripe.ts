/**
 * Stripe integration helpers
 * Produto: Espaço IA Premium — R$49,00/mês
 * Price ID: price_1T94OpPhq1CBhqMGmR3IbvcK
 */

import Stripe from "stripe";

// Price IDs
export const STRIPE_PRICES = {
  premium_monthly: "price_1T94OpPhq1CBhqMGmR3IbvcK",
} as const;

// Monthly credits granted on Premium subscription
export const PREMIUM_MONTHLY_CREDITS = 5000;

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  }
  return _stripe;
}

/**
 * Get or create a Stripe Customer for the user
 */
export async function getOrCreateStripeCustomer(
  userId: number,
  email: string | null | undefined,
  name: string | null | undefined,
  existingCustomerId?: string | null
): Promise<string> {
  const stripe = getStripe();

  if (existingCustomerId) {
    // Verify customer still exists
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (!customer.deleted) return existingCustomerId;
    } catch {
      // Customer not found, create new
    }
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: name ?? undefined,
    metadata: { userId: userId.toString() },
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout Session for Premium subscription
 */
export async function createCheckoutSession(params: {
  customerId: string;
  userId: number;
  userEmail: string | null | undefined;
  userName: string | null | undefined;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    customer: params.customerId,
    payment_method_types: ["card"],
    line_items: [{ price: params.priceId, quantity: 1 }],
    mode: "subscription",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
    client_reference_id: params.userId.toString(),
    metadata: {
      user_id: params.userId.toString(),
      customer_email: params.userEmail ?? "",
      customer_name: params.userName ?? "",
    },
    subscription_data: {
      metadata: {
        user_id: params.userId.toString(),
      },
    },
  });

  if (!session.url) throw new Error("Failed to create checkout session URL");
  return session.url;
}

/**
 * Create a Stripe Customer Portal session for managing subscription
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * Retrieve subscription details from Stripe
 */
export async function getSubscriptionDetails(subscriptionId: string) {
  const stripe = getStripe();
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscriptionAtPeriodEnd(subscriptionId: string) {
  const stripe = getStripe();
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}
