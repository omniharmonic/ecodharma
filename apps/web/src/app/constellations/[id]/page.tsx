import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { MessageForm } from "@/components/MessageForm";
import { DymaxionMap } from "@/components/DymaxionMap";
import { ConstellationRelational } from "@/components/ConstellationRelational";
import { InviteLink } from "@/components/InviteLink";
import { generateReadAction, inviteMemberAction, renameConstellationAction } from "../../actions/constellation";
import type { ConstellationRead } from "@/lib/types";

export default async function ConstellationDetail({ params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const id = Number(params.id);
  if (Number.isNaN(id)) notFound();

  const data = await withUser(user!.id, async (c) => {
    const cs = await c.query("select id, name, owner_id from constellations where id=$1", [id]);
    if (cs.rows.length === 0) return null;
    const members = await c.query(
      `select m.user_id, m.consent_id, p.display_name,
              (m.user_id = $2) as is_self
         from constellation_members m
         left join profiles p on p.id = m.user_id
        where m.constellation_id = $1`,
      [id, user!.id],
    );
    const read = await c.query(
      "select content_json, generated_at from constellation_reads where constellation_id=$1 order by generated_at desc limit 1",
      [id],
    );
    return { cs: cs.rows[0], members: members.rows, read: read.rows[0] };
  });

  if (!data) notFound();
  const isOwner = data.cs.owner_id === user!.id;
  const consentedCount = data.members.filter((m: any) => m.consent_id || m.is_self).length;
  const read = data.read?.content_json as ConstellationRead | undefined;

  return (
    <div className="max-w-measure pt-10">
      <div className="flex items-center justify-between animate-rise">
        <div>
          <p className="eyebrow mb-4">Constellation</p>
          <h1 className="font-display text-title leading-tight text-fg">{data.cs.name}</h1>
        </div>
        <Link href="/constellations" className="btn-line">all</Link>
      </div>

      <section className="mt-16">
        <p className="eyebrow mb-4">Members</p>
        <ul className="divide-y divide-rule/12">
          {data.members.map((m: any) => (
            <li key={m.user_id} className="flex items-center justify-between py-3" data-testid="member-row">
              <span className="font-sans text-fg">
                {m.is_self ? "You" : m.display_name || "Invited (awaiting consent)"}
              </span>
              <span className={m.consent_id || m.is_self ? "pill" : "kv text-flag"}>
                {m.is_self ? "owner" : m.consent_id ? "consented" : "pending consent"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {isOwner && (
        <section className="mt-16">
          <p className="eyebrow mb-3">Rename</p>
          <MessageForm action={renameConstellationAction} submitLabel="Save name" pendingLabel="Saving…" className="btn-line">
            <input type="hidden" name="constellation_id" value={id} />
            <input name="name" defaultValue={data.cs.name} required maxLength={120} className="input" placeholder="Constellation name" />
          </MessageForm>
        </section>
      )}

      {isOwner && (
        <section className="mt-16">
          <p className="eyebrow mb-3">Invite a kin</p>
          <p className="mb-4 text-sm text-muted">
            They&rsquo;ll be asked to actively consent before their gifts are woven in.
          </p>
          <MessageForm action={inviteMemberAction} submitLabel="Send invitation" pendingLabel="Sending…" className="btn-line">
            <input type="hidden" name="constellation_id" value={id} />
            <input name="email" type="email" required className="input" placeholder="their@email.com" />
          </MessageForm>

          <div className="mt-8 border-t border-rule/15 pt-6">
            <InviteLink constellationId={id} />
          </div>
        </section>
      )}

      {isOwner && (
        <section className="mt-16 flex flex-wrap items-end justify-between gap-4 border-t border-rule/15 pt-8">
          <div>
            <p className="eyebrow mb-2">Weave the read</p>
            <p className="text-sm text-muted">
              {consentedCount} consented member{consentedCount === 1 ? "" : "s"} (need 2+).
            </p>
          </div>
          <MessageForm action={generateReadAction} submitLabel="Generate constellation read" pendingLabel="Weaving…" className="btn-solar">
            <input type="hidden" name="constellation_id" value={id} />
          </MessageForm>
        </section>
      )}

      {read && (
        <section className="mt-20" data-testid="constellation-read">
          <p className="eyebrow mb-2">The constellation read</p>
          <figure className="plate mt-4">
            <figcaption className="fig mb-2">Fig. C · Geodesic social plate</figcaption>
            <DymaxionMap
              names={data.members
                .filter((m: any) => m.is_self || m.consent_id)
                .map((m: any) => (m.is_self ? "You" : m.display_name || "Kin"))}
            />
          </figure>
          <p className="mt-10 whitespace-pre-line text-lg leading-relaxed text-fg">{read.narrative}</p>

          <div className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-2">
            <ReadList title="Collective gifts" items={read.collective_gifts} />
            <ReadList title="Complementarities" items={read.complementarities} />
            <ReadList title="Frictions to name" items={read.frictions} />
            <ReadList title="Gaps in the field" items={read.gaps} />
            <ReadList title="Make explicit" items={read.make_explicit} />
          </div>

          {read.pairwise && read.pairwise.length > 0 && (
            <div className="mt-12">
              <p className="eyebrow mb-4">Pairwise dynamics</p>
              <div className="divide-y divide-rule/12">
                {read.pairwise.map((p, i) => (
                  <div key={i} className="py-4">
                    <h3 className="font-display text-lg text-fg">{p.a} &amp; {p.b}</h3>
                    <p className="mt-1 text-muted">{p.dynamic}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 border-l-2 border-accent pl-5">
            <p className="eyebrow mb-2">Weaving guidance</p>
            <p className="text-fg">{read.weaving_guidance}</p>
          </div>

          <ConstellationRelational relational={read.relational} />
        </section>
      )}
    </div>
  );
}

function ReadList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="eyebrow mb-3">{title}</p>
      <ul className="divide-y divide-rule/12">
        {items.map((it, i) => <li key={i} className="py-2 text-muted">{it}</li>)}
      </ul>
    </div>
  );
}
