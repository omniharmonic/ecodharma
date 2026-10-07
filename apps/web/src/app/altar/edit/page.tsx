import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { canUseAltar } from "@/lib/altar/access";
import { elementHistory, getAltar, getRitualPrefs } from "@/lib/altar/repo";
import { ELEMENT_KINDS, INQUIRY_STATUSES, KIND_META, ROOT_STATUSES, THREAD_STATUSES, type AltarElement, type ElementKind } from "@/lib/altar/model";
import { MessageForm } from "@/components/MessageForm";
import { PageTransition } from "@/components/PageTransition";
import { addElementAction, compostAction, reviseElementAction, ritualPrefsAction, setStatusAction } from "../../actions/altar";

export const dynamic = "force-dynamic";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATUSES: Partial<Record<ElementKind, readonly string[]>> = { root: ROOT_STATUSES, inquiry: INQUIRY_STATUSES, thread: THREAD_STATUSES };

async function ElementCard({ userId, e }: { userId: string; e: AltarElement }) {
  const hist = await elementHistory(userId, e.lineage_id);
  const statuses = STATUSES[e.kind];
  return (
    <details className="border border-rule/15 p-3" id={`e${e.lineage_id}`} data-testid={`element-${e.kind}`}>
      <summary className="cursor-pointer list-none">
        <span className="glyph mr-2 text-accent">{KIND_META[e.kind].glyph}</span>
        <span className="text-fg">{e.title}</span>
        <span className="ml-2 telemetry">{e.status !== "active" ? e.status : ""} {e.version > 1 ? `· ring ${e.version}` : ""}</span>
      </summary>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <MessageForm action={reviseElementAction} submitLabel="Add a new ring" className="btn-line text-2xs">
          <input type="hidden" name="lineage_id" value={e.lineage_id} />
          <label className="label">Name</label>
          <input name="title" defaultValue={e.title} className="input" />
          <label className="label">Notes (sealed)</label>
          <textarea name="body" defaultValue={e.body} rows={3} className="input" />
          <label className="label">Why it changed (optional)</label>
          <input name="note" className="input" />
        </MessageForm>
        <div className="space-y-3">
          {statuses && (
            <MessageForm action={setStatusAction} submitLabel="Set state" className="btn-line text-2xs">
              <input type="hidden" name="lineage_id" value={e.lineage_id} />
              <select name="status" defaultValue={e.status} className="input" data-testid={`status-${e.lineage_id}`}>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input name="note" className="input" placeholder="what moved you to change it?" />
            </MessageForm>
          )}
          {e.kind !== "prayer" && (
            <MessageForm action={compostAction} submitLabel="Compost" className="btn-line text-2xs">
              <input type="hidden" name="lineage_id" value={e.lineage_id} />
              <input name="note" className="input" placeholder="what it gave you, as you let it go" />
            </MessageForm>
          )}
          <div className="telemetry">
            life history
            <ul className="mt-1 space-y-0.5 normal-case tracking-normal">
              {hist.events.map((ev, i) => (
                <li key={i}>{new Date(ev.at).toLocaleDateString()} · {ev.event}{ev.note ? ` — ${ev.note}` : ""}</li>
              ))}
            </ul>
          </div>
          <Link href={`/journal?el=${e.lineage_id}`} className="telemetry text-accent hover:underline">reflections touching this →</Link>
        </div>
      </div>
    </details>
  );
}

export default async function AltarEditPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  const altar = await getAltar(user!.id);
  if (!altar.prayer) redirect("/altar/kindle");
  const prefs = await getRitualPrefs(user!.id);
  const groups: { kind: ElementKind; items: AltarElement[] }[] = [
    { kind: "prayer", items: [altar.prayer] },
    { kind: "devotion", items: altar.devotions },
    { kind: "root", items: altar.roots },
    { kind: "work", items: altar.works },
    { kind: "practice", items: altar.practices },
    { kind: "measure", items: altar.measures },
    { kind: "inquiry", items: altar.inquiries },
    { kind: "thread", items: altar.threads },
  ];
  return (
    <PageTransition>
      <section className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Tend the altar</p>
          <h1 className="mt-2 font-display text-[2.2rem] leading-tight text-fg">Every element can grow, be questioned, or be composted</h1>
        </div>
        <Link href="/altar" className="btn-line">← the altar</Link>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.kind}>
              <p className="eyebrow"><span className="glyph text-accent">{KIND_META[g.kind].glyph}</span> {KIND_META[g.kind].plural}</p>
              <p className="mb-2 text-2xs text-muted">{KIND_META[g.kind].prompt}</p>
              <div className="space-y-2">
                {g.items.map((e) => <ElementCard key={e.id} userId={user!.id} e={e} />)}
                {g.items.length === 0 && <p className="text-2xs text-muted">None yet.</p>}
              </div>
            </section>
          ))}
          {altar.composted.length > 0 && (
            <section>
              <p className="eyebrow">Composted — feeding what grows next</p>
              <ul className="mt-2 space-y-1 text-2xs text-muted">
                {altar.composted.map((e) => <li key={e.id}>{KIND_META[e.kind].glyph} {e.title} · {new Date(e.retired_at!).toLocaleDateString()}</li>)}
              </ul>
            </section>
          )}
        </div>
        <aside className="space-y-6">
          <div className="console p-4">
            <p className="telemetry text-accent">+ place something on the altar</p>
            <MessageForm action={addElementAction} submitLabel="Place it" className="btn-solar text-2xs">
              <select name="kind" className="input" defaultValue="work" data-testid="new-kind">
                {ELEMENT_KINDS.filter((k) => k !== "prayer" && k !== "thread").map((k) => <option key={k} value={k}>{KIND_META[k].glyph} {KIND_META[k].label}</option>)}
              </select>
              <input name="title" className="input" placeholder="name it" data-testid="new-title" />
              <textarea name="body" rows={2} className="input" placeholder="notes (sealed)" />
            </MessageForm>
          </div>
          <div className="border border-rule/20 p-4">
            <p className="telemetry">⟲ your rhythm</p>
            <MessageForm action={ritualPrefsAction} submitLabel="Save rhythm" className="btn-line text-2xs">
              <select name="weekly_dow" defaultValue={String(prefs?.weekly_dow ?? 0)} className="input">
                {DAYS.map((d, i) => <option key={d} value={i}>weekly on {d}</option>)}
              </select>
              <select name="local_hour" defaultValue={String(prefs?.local_hour ?? 18)} className="input">
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>at {String(h).padStart(2, "0")}:00</option>)}
              </select>
              <input name="tz" defaultValue={prefs?.tz || "UTC"} className="input" />
              <div className="flex flex-wrap gap-3 text-2xs">
                <label className="flex items-center gap-1"><input type="checkbox" name="channels" value="email" defaultChecked={prefs?.channels?.includes("email") ?? true} /> email</label>
                <label className="flex items-center gap-1"><input type="checkbox" name="channels" value="telegram" defaultChecked={prefs?.channels?.includes("telegram")} /> telegram</label>
                <label className="flex items-center gap-1"><input type="checkbox" name="lunar" defaultChecked={prefs?.lunar} /> moons</label>
              </div>
              <select name="hemisphere" defaultValue={prefs?.hemisphere || "N"} className="input">
                <option value="N">northern hemisphere</option><option value="S">southern hemisphere</option>
              </select>
            </MessageForm>
          </div>
        </aside>
      </div>
    </PageTransition>
  );
}
