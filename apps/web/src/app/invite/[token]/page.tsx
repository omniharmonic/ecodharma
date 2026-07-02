import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { redeemInvite } from "@/lib/invites";

// Redeem a constellation join link. Signed-in only; redeeming makes you a PENDING
// member (still consent-gated) and sends you to /constellations to opt in.
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${params.token}`)}`);

  const result = await redeemInvite(params.token, user!.id);
  if (result.ok) redirect("/constellations?joined=1");

  return (
    <div className="mx-auto mt-24 max-w-measure text-center">
      <p className="eyebrow">Invite link</p>
      <h1 className="mt-3 font-display text-title text-fg">{result.reason}</h1>
      <p className="mx-auto mt-4 max-w-prose text-muted">
        Ask whoever invited you for a fresh link, or head to your constellations.
      </p>
      <Link href="/constellations" className="btn-line mt-6 inline-block">Your constellations</Link>
    </div>
  );
}
