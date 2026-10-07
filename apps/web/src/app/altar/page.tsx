import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { canUseAltar } from "@/lib/altar/access";
import { getAltar, listProposals, listReflections } from "@/lib/altar/repo";
import { loadSnapshot } from "@/lib/altar/snapshot";
import { strainedRoots } from "@/lib/altar/becoming";
import { KIND_META, altarElements } from "@/lib/altar/model";
import { latestInvitation } from "@/lib/invitations";
import { AltarHUD } from "@/components/dream/AltarHUD";
import { StrandChip } from "@/components/altar/StrandChip";
import { MessageForm } from "@/components/MessageForm";
import { decideProposalAction, inquireRootAction, setStatusAction } from "../actions/altar";
import { refreshThreads } from "@/lib/altar/repo";
import { detectThreads } from "@/lib/altar/threads";
import { dueRitualFor } from "@/lib/altar/rituals";

export const dynamic = "force-dynamic";

export default async function AltarPage({ searchParams }: { searchParams: { kindled?: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  const altar = await getAltar(user!.id);
  if (!altar.prayer) redirect("/inquiry");

  const [snap, proposals, recent, invitation, due] = await Promise.all([
    loadSnapshot(user!.id),
    listProposals(user!.id),
    listReflections(user!.id, { limit: 5 }),
    latestInvitation(user!.id),
    dueRitualFor(user!.id),
  ]);
  // Notice patterns across reflections → proposed threads (the person decides).
  if (await refreshThreads(user!.id, detectThreads(snap.elements, snap.strands, Date.parse(snap.now)))) {
    const fresh = await getAltar(user!.id);
    altar.threads = fresh.threads;
  }
  const proposedThreads = altar.threads.filter((t) => t.status === "proposed");
  const titleOf = new Map(altarElements(altar).map((e) => [e.lineage_id, e.title]));
  const strained = strainedRoots(snap.elements, snap.strands, Date.parse(snap.now)).map((id) => altar.roots.find((r) => r.lineage_id === id)).filter(Boolean);
  const questioning = altar.roots.filter((r) => r.status === "questioning");
  const facets = altar.prayer.facets || {};

  return (
    <>
      <AltarHUD snap={snap} />
      <div className="relative z-10 grid min-h-[calc(100vh-7rem)] gap-6 pt-14 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="veil veil-gold p-5" data-testid="prayer-panel">
            <p className="whisper">☉ The Prayer · ring {altar.prayer.version}</p>
            <p className="illuminated mt-3 font-display text-xl leading-snug text-fg" data-testid="prayer-text">{altar.prayer.title}</p>
            {(facets.for_whom || facets.toward_what || facets.through_what) && (
              <dl className="mt-3 space-y-1 text-2xs text-muted">
                {facets.for_whom && <div><dt className="inline telemetry">for · </dt><dd className="inline">{facets.for_whom}</dd></div>}
                {facets.toward_what && <div><dt className="inline telemetry">toward · </dt><dd className="inline">{facets.toward_what}</dd></div>}
                {facets.through_what && <div><dt className="inline telemetry">through · </dt><dd className="inline">{facets.through_what}</dd></div>}
              </dl>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {due && (
                <Link href={`/ritual/${due.cadence}?r=${due.id}`} className="dream-btn !px-3 !py-2" data-testid="begin-ritual">⟲ {due.label}</Link>
              )}
              <Link href="/journal" className={due ? "dream-btn-ghost !px-3 !py-2" : "dream-btn !px-3 !py-2"} data-testid="reflect-now">☽ Reflect</Link>
              <Link href="/altar/edit" className="dream-btn-ghost !px-3 !py-2">⟡ Tend</Link>
            </div>
          </div>
          {searchParams.kindled && (
            <p className="veil p-4 text-sm text-fg" data-testid="kindled">Your altar is lit. Return to it each week; it will grow with you.</p>
          )}
          {proposals.length > 0 && (
            <div className="veil veil-gold p-4" data-testid="proposals">
              <p className="telemetry text-accent">Proposed by Claude · you hold the pen</p>
              <ul className="mt-2 space-y-3">
                {proposals.map((p) => (
                  <li key={p.id} className="text-sm">
                    <p className="text-fg">
                      {p.lineage_id ? `Change “${titleOf.get(p.lineage_id) || "element"}”` : `New ${KIND_META[p.kind].label}`}:{" "}
                      <span className="text-accent">{String((p.change as any).title || (p.change as any).status || "")}</span>
                    </p>
                    {p.rationale && <p className="mt-0.5 text-2xs text-muted">{p.rationale}</p>}
                    <div className="mt-2 flex gap-2">
                      <MessageForm action={decideProposalAction} submitLabel="Accept" className="btn-solar text-2xs">
                        <input type="hidden" name="proposal_id" value={p.id} /><input type="hidden" name="decision" value="accept" />
                      </MessageForm>
                      <MessageForm action={decideProposalAction} submitLabel="Decline" className="btn-line text-2xs">
                        <input type="hidden" name="proposal_id" value={p.id} /><input type="hidden" name="decision" value="decline" />
                      </MessageForm>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="veil p-4">
            <p className="telemetry">? Living questions</p>
            {altar.inquiries.filter((q) => q.status !== "integrated").length === 0 && questioning.length === 0 && strained.length === 0 ? (
              <p className="mt-2 text-2xs text-muted">No open inquiries. When a belief starts to strain, one will appear here.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {altar.inquiries.filter((q) => q.status !== "integrated").map((q) => <li key={q.id} className="text-fg">? {q.title}</li>)}
                {questioning.map((r) => <li key={r.id} className="text-[color:rgb(var(--root-questioning))]">⟟ in question: {r.title}</li>)}
                {strained.map((r) => (
                  <li key={r!.id} className="text-[color:rgb(var(--root-questioning))]" data-testid="strained-root">
                    ⟟ under strain: {r!.title}
                    <MessageForm action={inquireRootAction} submitLabel="open an inquiry" className="btn-line mt-1 text-2xs">
                      <input type="hidden" name="lineage_id" value={r!.lineage_id} /><input type="hidden" name="title" value={r!.title} />
                    </MessageForm>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {proposedThreads.length > 0 && (
            <div className="veil p-4" data-testid="threads">
              <p className="telemetry">≋ Threads noticed — true for you?</p>
              <ul className="mt-2 space-y-3">
                {proposedThreads.map((t) => (
                  <li key={t.id} className="text-sm">
                    <p className="text-fg">{t.title}</p>
                    {t.facets?.why && <p className="text-2xs text-muted">{t.facets.why}</p>}
                    <div className="mt-1 flex gap-2">
                      <MessageForm action={setStatusAction} submitLabel="yes, a thread" className="btn-line text-2xs">
                        <input type="hidden" name="lineage_id" value={t.lineage_id} /><input type="hidden" name="status" value="accepted" />
                      </MessageForm>
                      <MessageForm action={setStatusAction} submitLabel="not quite" className="btn-line text-2xs">
                        <input type="hidden" name="lineage_id" value={t.lineage_id} /><input type="hidden" name="status" value="dismissed" />
                      </MessageForm>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="veil p-4">
            <p className="telemetry">❦ The story so far</p>
            <p className="mt-1 text-2xs text-muted">Your season, your year — in your own words.</p>
            <Link href="/altar/story" className="mt-2 inline-block telemetry text-accent hover:underline" data-testid="story-link">read your story →</Link>
          </div>

          {invitation && (
            <div className="veil p-4">
              <p className="telemetry">✉ Latest invitation</p>
              <p className="mt-2 whitespace-pre-line text-2xs leading-relaxed text-muted">{invitation.body.length > 420 ? `${invitation.body.slice(0, 418)}…` : invitation.body}</p>
            </div>
          )}
        </aside>
        <div aria-hidden />
      </div>

      {/* JOURNAL STRIP */}
      <section className="veil relative z-10 mt-[30vh] p-5" data-testid="journal-strip">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Recent reflections</p>
          <Link href="/journal" className="telemetry hover:text-accent">the whole journal →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing yet. Your first reflection will send the first pulse through the web.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule/10">
            {recent.map((r) => (
              <li key={r.id} className="py-3">
                <p className="telemetry">{new Date(r.created_at).toLocaleDateString()} · {r.cadence} · loop {"I".repeat(r.depth)}</p>
                <p className="mt-1 line-clamp-2 text-sm text-fg">{r.body}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.strands.filter((s) => s.status !== "rejected").map((s) => (
                    <StrandChip key={s.id} relation={s.relation} title={titleOf.get(s.lineage_id) || "…"} charge={s.charge} status={s.status} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
