"use server";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createCheckout, createPortal, stripeEnabled } from "@/lib/billing";

type ActionState = { error?: string; ok?: string } | null;

/** Start the premium Checkout flow → redirect to Stripe. */
export async function startCheckoutAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!stripeEnabled()) return { error: "Premium isn't open yet — check back soon." };
  let url: string;
  try {
    url = await createCheckout(user!.id, user!.email);
  } catch {
    return { error: "Couldn't start checkout. Please try again." };
  }
  redirect(url);
}

/** Open the Stripe Customer Portal (manage / cancel) → redirect to Stripe. */
export async function openPortalAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!stripeEnabled()) return { error: "Billing isn't available." };
  let url: string;
  try {
    url = await createPortal(user!.id);
  } catch {
    return { error: "Couldn't open the billing portal." };
  }
  redirect(url);
}
