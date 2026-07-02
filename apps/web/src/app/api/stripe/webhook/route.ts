import { handleWebhook, stripeEnabled } from "@/lib/billing";

// Stripe webhook — reconciles subscription state into profiles.plan. Needs the
// RAW request body for signature verification, so no body parsing before this.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!stripeEnabled()) {
    return new Response("billing disabled", { status: 503 });
  }
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  try {
    const label = await handleWebhook(body, sig);
    return Response.json({ received: true, label });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "webhook error";
    return new Response(`Webhook error: ${msg}`, { status: 400 });
  }
}
