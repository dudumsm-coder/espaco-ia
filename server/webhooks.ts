/**
 * Stripe Webhook Handler
 * Registered BEFORE express.json() to preserve raw body for signature verification
 */

import { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { getStripe, PREMIUM_MONTHLY_CREDITS } from "./stripe";
import * as db from "./db";

export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!sig || !webhookSecret) {
        console.warn("[Webhook] Missing signature or secret");
        return res.status(400).json({ error: "Missing signature" });
      }

      let event: Stripe.Event;

      try {
        event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error("[Webhook] Signature verification failed:", err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      console.log(`[Webhook] Event received: ${event.type} | ID: ${event.id}`);

      // Handle test events
      if (event.id.startsWith("evt_test_")) {
        console.log("[Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            await handleCheckoutCompleted(session);
            break;
          }

          case "invoice.paid": {
            const invoice = event.data.object as Stripe.Invoice;
            await handleInvoicePaid(invoice);
            break;
          }

          case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice;
            await handleInvoicePaymentFailed(invoice);
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionDeleted(subscription);
            break;
          }

          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionUpdated(subscription);
            break;
          }

          default:
            console.log(`[Webhook] Unhandled event type: ${event.type}`);
        }
      } catch (err: any) {
        console.error(`[Webhook] Error processing event ${event.type}:`, err.message);
        return res.status(500).json({ error: "Internal processing error" });
      }

      return res.json({ received: true });
    }
  );
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = parseInt(session.metadata?.user_id || session.client_reference_id || "0");
  if (!userId) {
    console.warn("[Webhook] checkout.session.completed: no user_id in metadata");
    return;
  }

  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id;

  const customerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id;

  // Update user with Stripe IDs and upgrade to premium
  await db.updateUserStripeInfo(userId, {
    stripeCustomerId: customerId ?? null,
    stripeSubscriptionId: subscriptionId ?? null,
    role: "premium",
  });

  // Get or create subscription record
  const premiumLevel = await db.getAccessLevelBySlug("premium");
  if (premiumLevel) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await db.upsertUserSubscription(userId, {
      accessLevelId: premiumLevel.id,
      status: "active",
      billingCycle: "monthly",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });

    // Grant monthly credits
    await db.grantCreditsToUser(
      userId,
      PREMIUM_MONTHLY_CREDITS,
      "subscription_grant",
      "Créditos mensais Premium ativados"
    );
  }

  // Record payment
  const amountTotal = session.amount_total ?? 0;
  await db.recordPayment({
    userId,
    amountCents: amountTotal,
    currency: (session.currency ?? "brl").toUpperCase(),
    status: "completed",
    paymentMethod: "card",
    externalId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null,
    description: "Assinatura Premium - Espaço IA",
  });

  console.log(`[Webhook] User ${userId} upgraded to Premium. Credits granted: ${PREMIUM_MONTHLY_CREDITS}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) return;

  const user = await db.getUserByStripeCustomerId(customerId);
  if (!user) {
    console.warn("[Webhook] invoice.paid: no user found for customer", customerId);
    return;
  }

  // Renewal: grant monthly credits again
  if (invoice.billing_reason === "subscription_cycle") {
    await db.grantCreditsToUser(
      user.id,
      PREMIUM_MONTHLY_CREDITS,
      "subscription_grant",
      "Renovação mensal Premium - créditos concedidos"
    );

    // Update subscription period
    const sub = await db.getUserSubscription(user.id);
    if (sub) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await db.updateSubscriptionPeriod(sub.id, now, periodEnd);
    }

    console.log(`[Webhook] User ${user.id} subscription renewed. Credits granted: ${PREMIUM_MONTHLY_CREDITS}`);
  }

  // Record payment
  await db.recordPayment({
    userId: user.id,
    amountCents: invoice.amount_paid,
    currency: (invoice.currency ?? "brl").toUpperCase(),
    status: "completed",
    paymentMethod: "card",
    externalId: invoice.id,
    stripeInvoiceId: invoice.id,
    description: `Fatura Stripe - ${invoice.billing_reason ?? "payment"}`,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) return;

  const user = await db.getUserByStripeCustomerId(customerId);
  if (!user) return;

  // Update subscription status to past_due
  const sub = await db.getUserSubscription(user.id);
  if (sub) {
    await db.updateSubscriptionStatus(sub.id, "past_due");
  }

  console.warn(`[Webhook] Payment failed for user ${user.id}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = parseInt(subscription.metadata?.user_id ?? "0");
  if (!userId) return;

  // Downgrade to free
  await db.updateUserStripeInfo(userId, {
    stripeSubscriptionId: null,
    role: "free",
  });

  const sub = await db.getUserSubscription(userId);
  if (sub) {
    await db.updateSubscriptionStatus(sub.id, "cancelled");
  }

  console.log(`[Webhook] User ${userId} subscription cancelled. Downgraded to free.`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = parseInt(subscription.metadata?.user_id ?? "0");
  if (!userId) return;

  const status = subscription.status;
  const sub = await db.getUserSubscription(userId);

  if (sub) {
    if (status === "active") {
      await db.updateSubscriptionStatus(sub.id, "active");
    } else if (status === "past_due") {
      await db.updateSubscriptionStatus(sub.id, "past_due");
    } else if (status === "canceled") {
      await db.updateSubscriptionStatus(sub.id, "cancelled");
    }
  }

  console.log(`[Webhook] User ${userId} subscription updated: ${status}`);
}
