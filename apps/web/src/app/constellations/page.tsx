import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { isPremium } from "@/lib/billing";
import { MessageForm } from "@/components/MessageForm";
import { PremiumInvite } from "@/components/PremiumInvite";
import {
  createConstellationAction,
  respondInviteAction,
  revokeConsentAction,
} from "../actions/constellation";

type Row = {
  id: number;
  name: string;
  owner_id: string;
  consent_id: number | null;
  is_owner: boolean;
};

export default async function ConstellationsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const rows: Row[] = await withUser(user!.id, async (c) => {
    const { rows } = await c.query(
      `select cs.id, cs.name, cs.owner_id, m.consent_id, (cs.owner_id = $1) as is_owner
         from constellation_members m
         join constellations cs on cs.id = m.constellation_id
        where m.user_id = $1
        order by cs.created_at desc`,
      [user!.id],
    );
    return rows;
  });

  const owned = rows.filter((r) => r.is_owner);
  const joined = rows.filter((r) => !r.is_owner && r.consent_id);
  const pending = rows.filter((r) => !r.is_owner && !r.consent_id);
  const premium = await isPremium(user!.id);

  return (
    <div className="max-w-measure pt-10">
      <header className="animate-rise">
        <p className="eyebrow mb-4">In relationship</p>
        <h1 className="font-display text-title leading-tight text-fg">Constellations</h1>
        <p className="mt-4 text-muted">
          Your gift is only fully realized in relationship. Compose a constellation and invite others —
          nobody&rsquo;s profile is ever woven in without their active consent.
        </p>
        <Link href="/constellations/sample" className="btn-line mt-5 inline-block">
          See a sample constellation →
        </Link>
      </header>

      {pending.length > 0 && (
        <section className="mt-16">
          <p className="eyebrow mb-4">Invitations awaiting your consent</p>
          <div className="divide-y divide-rule/12">
            {pending.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4" data-testid="pending-invite">
                <span className="font-sans text-fg">{r.name}</span>
                <div className="flex items-center gap-5">
                  <MessageForm action={respondInviteAction} submitLabel="Consent & join" pendingLabel="Joining…" className="btn-line">
                    <input type="hidden" name="constellation_id" value={r.id} />
                    <input type="hidden" name="decision" value="accept" />
                  </MessageForm>
                  <MessageForm action={respondInviteAction} submitLabel="Decline" className="btn-line">
                    <input type="hidden" name="constellation_id" value={r.id} />
                    <input type="hidden" name="decision" value="decline" />
                  </MessageForm>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-16">
        <p className="eyebrow mb-4">Yours</p>
        {owned.length === 0 && (
          <p className="text-muted/70">None yet — compose one below.</p>
        )}
        <div className="divide-y divide-rule/12">
          {owned.map((r) => (
            <Link key={r.id} href={`/constellations/${r.id}`} className="flex items-center justify-between py-4 font-sans text-fg hover:text-accent" data-testid="owned-constellation">
              {r.name}
              <span aria-hidden className="text-muted">→</span>
            </Link>
          ))}
        </div>
        <div className="mt-10">
          <p className="eyebrow mb-3">Compose a new constellation</p>
          <MessageForm action={createConstellationAction} submitLabel="Create" pendingLabel="Creating…" className="btn-solar">
            <input name="name" className="input" placeholder="e.g. Cascadia weavers" required />
          </MessageForm>
        </div>
      </section>

      {joined.length > 0 && (
        <section className="mt-16">
          <p className="eyebrow mb-4">You&rsquo;ve joined</p>
          <div className="divide-y divide-rule/12">
            {joined.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4" data-testid="joined-constellation">
                <Link href={`/constellations/${r.id}`} className="font-sans text-fg hover:text-accent">
                  {r.name} <span aria-hidden className="text-muted">→</span>
                </Link>
                <MessageForm action={revokeConsentAction} submitLabel="Revoke consent" className="btn-line">
                  <input type="hidden" name="constellation_id" value={r.id} />
                </MessageForm>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MEMBERSHIP — quiet nudge toward relational reflection (or a pointer, if a member) */}
      <PremiumInvite premium={premium} context="constellation" />
    </div>
  );
}
