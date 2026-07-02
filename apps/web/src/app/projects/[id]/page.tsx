import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { loadFramework } from "@/lib/framework";
import { MessageForm } from "@/components/MessageForm";
import { matchPeopleForProject, type ProjectRow } from "@/lib/marketplace";
import { expressInterestAction } from "../../actions/marketplace";

// Marketplace disabled for launch (see /work). Set to true to re-enable.
const WORK_ENABLED = false;

export default async function ProjectDetail({ params }: { params: { id: string } }) {
  if (!WORK_ENABLED) redirect("/profile");
  const user = await getUser();
  if (!user) redirect("/login");
  const id = Number(params.id);
  if (Number.isNaN(id)) notFound();
  const fw = loadFramework();
  const giftName = (gid: string) => fw.gifts.find((g) => g.id === gid)?.name || gid;
  const domainName = (did: string) => fw.domains.find((d) => d.id === did)?.name || did;

  const project = await withUser(user.id, async (c) => {
    const { rows } = await c.query<ProjectRow>("select * from projects where id=$1", [id]);
    return rows[0];
  });
  if (!project) notFound();
  const isOwner = project.owner_id === user.id;

  const matches = isOwner ? await matchPeopleForProject(project) : [];
  const interests = isOwner
    ? await withUser(user.id, async (c) => {
        const { rows } = await c.query(
          `select pi.message, p.display_name from project_interests pi
             left join profiles p on p.id = pi.user_id
            where pi.project_id = $1 order by pi.created_at desc`,
          [id],
        );
        return rows;
      })
    : [];

  return (
    <div className="max-w-measure pt-10">
      <div className="flex items-start justify-between gap-4 animate-rise">
        <div>
          <p className="eyebrow mb-4">Project</p>
          <h1 className="font-display text-title leading-tight text-fg">{project.title}</h1>
          {project.place && <p className="mt-1 kv">{project.place}</p>}
        </div>
        <Link href="/projects" className="btn-line shrink-0">all</Link>
      </div>
      <p className="mt-6 text-lg text-muted">{project.description}</p>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {project.needed_gifts.map((g) => <span key={g} className="pill">{giftName(g)}</span>)}
        {project.needed_domains.map((d) => <span key={d} className="pill">{domainName(d)}</span>)}
      </div>

      {isOwner ? (
        <>
          <section className="mt-16">
            <p className="eyebrow mb-2">Gift-aligned people ({matches.length})</p>
            <p className="mb-4 text-sm text-muted">Surfaced from those who opted into discovery — by gift fit, not credentials.</p>
            {matches.length === 0 && <p className="text-muted/70">No matches yet. As more people opt in, they'll appear here.</p>}
            <div className="divide-y divide-rule/12">
              {matches.map((m) => (
                <div key={m.user_id} className="py-4" data-testid="person-match">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-sans text-fg">{m.display_name}</span>
                    <span className="pill shrink-0">fit {m.score}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {m.shared_gifts.map((g) => <span key={g} className="pill">{g}</span>)}
                    {m.shared_domains.map((d) => <span key={d} className="pill">{d}</span>)}
                  </div>
                  {m.offerings.length > 0 && (
                    <p className="mt-1 text-sm text-muted/80">Offers: {m.offerings.join(", ")}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
          {interests.length > 0 && (
            <section className="mt-16">
              <p className="eyebrow mb-4">Expressed interest</p>
              <div className="divide-y divide-rule/12">
                {interests.map((it: any, i: number) => (
                  <div key={i} className="py-4">
                    <p className="font-sans text-fg">{it.display_name || "A kin"}</p>
                    {it.message && <p className="mt-1 text-sm text-muted">{it.message}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="mt-16 border-t border-rule/15 pt-8">
          <p className="eyebrow mb-4">Offer your gifts</p>
          <MessageForm action={expressInterestAction} submitLabel="Express interest" pendingLabel="Sending…">
            <input type="hidden" name="project_id" value={id} />
            <textarea name="message" rows={3} className="input" placeholder="A few words on how your gifts might serve this…" />
          </MessageForm>
        </section>
      )}
    </div>
  );
}
