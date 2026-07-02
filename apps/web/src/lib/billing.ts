import "server-only";
import Stripe from "stripe";
import { withService } from "./db";

// Premium subscription. A single paid tier gates the reflection bot + weekly
// nudges. Two ways to be premium: a live Stripe subscription, or an admin comp
// (plan='premium', current_period_end null → never expires). Everything Stripe
// is env-gated so the app builds, tests, and runs with billing switched off.

export type Plan = "free" | "premium";
export type Billing = {
  plan: Plan;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
  stripeEnabled: boolean;
  premium: boolean;
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ecodharma.vercel.app";

export function stripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let _stripe: Stripe | null = null;
function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not set");
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

type Row = {
  plan: string | null;
  current_period_end: Date | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

async function readRow(userId: string): Promise<Row | undefined> {
  return withService(async (c) => {
    const { rows } = await c.query(
      "select plan, current_period_end, stripe_customer_id, stripe_subscription_id from profiles where id = $1",
      [userId],
    );
    return rows[0] as Row | undefined;
  });
}

/** Is this plan+period-end currently premium? (comp = null period end = forever) */
function isActive(plan: string | null | undefined, periodEnd: Date | null | undefined): boolean {
  if (plan !== "premium") return false;
  if (!periodEnd) return true; // admin comp / non-expiring
  return periodEnd.getTime() > Date.now();
}

/** THE premium gate. Env can force-enable for a dedicated demo, but defaults to DB. */
export async function isPremium(userId: string): Promise<boolean> {
  const row = await readRow(userId);
  return isActive(row?.plan, row?.current_period_end ?? null);
}

export async function getBilling(userId: string): Promise<Billing> {
  const row = await readRow(userId);
  const premium = isActive(row?.plan, row?.current_period_end ?? null);
  return {
    plan: premium ? "premium" : "free",
    currentPeriodEnd: row?.current_period_end ?? null,
    stripeCustomerId: row?.stripe_customer_id ?? null,
    stripeEnabled: stripeEnabled(),
    premium,
  };
}

// --- writes (service role) ----------------------------------------------------

async function setStripeCustomer(userId: string, customerId: string): Promise<void> {
  await withService((c) => c.query("update profiles set stripe_customer_id = $2 where id = $1", [userId, customerId]));
}

/** Update plan state from a Stripe event (keyed by our user id). */
export async function applySubscriptionState(
  userId: string,
  opts: { plan: Plan; subscriptionId?: string | null; periodEnd?: Date | null },
): Promise<void> {
  await withService((c) =>
    c.query(
      `update profiles set plan = $2, stripe_subscription_id = $3, current_period_end = $4 where id = $1`,
      [userId, opts.plan, opts.subscriptionId ?? null, opts.periodEnd ?? null],
    ),
  );
}

/** Admin comp: grant/revoke premium without Stripe (never-expiring). */
export async function setCompedPremium(userId: string, on: boolean): Promise<void> {
  await withService((c) =>
    c.query("update profiles set plan = $2, current_period_end = null where id = $1", [userId, on ? "premium" : "free"]),
  );
}

async function userIdForCustomer(customerId: string): Promise<string | null> {
  return withService(async (c) => {
    const { rows } = await c.query("select id from profiles where stripe_customer_id = $1", [customerId]);
    return (rows[0]?.id as string | undefined) ?? null;
  });
}

// --- Stripe flows (only reachable when stripeEnabled) -------------------------

/** Ensure the user has a Stripe customer; return its id. */
async function ensureCustomer(userId: string, email: string): Promise<string> {
  const row = await readRow(userId);
  if (row?.stripe_customer_id) return row.stripe_customer_id;
  const customer = await stripe().customers.create({ email, metadata: { userId } });
  await setStripeCustomer(userId, customer.id);
  return customer.id;
}

/** Create a Checkout session for the premium subscription; returns the URL. */
export async function createCheckout(userId: string, email: string): Promise<string> {
  const price = process.env.STRIPE_PRICE_ID;
  if (!price) throw new Error("STRIPE_PRICE_ID not set");
  const customer = await ensureCustomer(userId, email);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: `${SITE}/settings?upgraded=1`,
    cancel_url: `${SITE}/settings`,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
    allow_promotion_codes: true,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/** Create a Customer Portal session (manage/cancel); returns the URL. */
export async function createPortal(userId: string): Promise<string> {
  const row = await readRow(userId);
  if (!row?.stripe_customer_id) throw new Error("No Stripe customer for this user");
  const session = await stripe().billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    return_url: `${SITE}/settings`,
  });
  return session.url;
}

/** Verify + parse a webhook, then reconcile plan state. Returns a short label. */
export async function handleWebhook(rawBody: string, signature: string | null): Promise<string> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not set");
  if (!signature) throw new Error("missing stripe-signature");
  const event = stripe().webhooks.constructEvent(rawBody, signature, secret);

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = (s.metadata?.userId as string) || (s.customer ? await userIdForCustomer(String(s.customer)) : null);
      if (userId && s.subscription) {
        const sub = await stripe().subscriptions.retrieve(String(s.subscription));
        await applySubscriptionState(userId, {
          plan: sub.status === "active" || sub.status === "trialing" ? "premium" : "free",
          subscriptionId: sub.id,
          periodEnd: periodEndOf(sub),
        });
      }
      return `checkout.completed → ${userId ?? "unknown"}`;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = (sub.metadata?.userId as string) || (await userIdForCustomer(String(sub.customer)));
      if (userId) {
        await applySubscriptionState(userId, {
          plan: sub.status === "active" || sub.status === "trialing" ? "premium" : "free",
          subscriptionId: sub.id,
          periodEnd: periodEndOf(sub),
        });
      }
      return `subscription.${event.type} → ${userId ?? "unknown"}`;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = (sub.metadata?.userId as string) || (await userIdForCustomer(String(sub.customer)));
      if (userId) await applySubscriptionState(userId, { plan: "free", subscriptionId: sub.id, periodEnd: null });
      return `subscription.deleted → ${userId ?? "unknown"}`;
    }
    default:
      return `ignored ${event.type}`;
  }
}

function periodEndOf(sub: Stripe.Subscription): Date | null {
  // `current_period_end` was top-level on older API versions and moved onto the
  // subscription items in 2025 versions — check both, take the latest item end.
  const top = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (top) return new Date(top * 1000);
  const itemEnds = (sub.items?.data || [])
    .map((i) => (i as unknown as { current_period_end?: number }).current_period_end)
    .filter((n): n is number => typeof n === "number");
  if (itemEnds.length) return new Date(Math.max(...itemEnds) * 1000);
  return null;
}
