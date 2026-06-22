import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { listCandidates, libraryStats } from "@/lib/trimtabs";
import { loadFramework } from "@/lib/framework";
import { MessageForm } from "@/components/MessageForm";
import { promoteTrimTabAction, deleteCandidateAction } from "../actions/trimtab";

export default async function CuratePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await isAdmin(user.email))) {
    return <div className="mx-auto mt-24 max-w-measure text-center text-muted">Curation is limited to stewards.</div>;
  }

  const fw = loadFramework();
  const name = (id: string, kind: "gift" | "domain") =>
    (kind === "gift" ? fw.gifts : fw.domains).find((x) => x.id === id)?.name || id;
  const [candidates, stats] = await Promise.all([listCandidates(), libraryStats()]);

  return (
    <div className="max-w-measure pt-10">
      <header className="animate-rise">
        <p className="eyebrow mb-4">Stewardship</p>
        <h1 className="font-display text-title leading-tight text-fg">Trim-tab commons</h1>
        <p className="mt-4 text-muted">
          The library grows as new gift × domain intersections are reached: Claude proposes, you dispose.
          Promote what rings true into the canon; it folds into the next framework version.
        </p>
      </header>

      <section className="mt-12 flex flex-wrap gap-x-4 gap-y-1">
        {stats.map((s: any) => (
          <span key={`${s.source}-${s.status}`} className="pill" data-testid="library-stat">
            {s.source}/{s.status}: {s.n} ({s.uses ?? 0} uses)
          </span>
        ))}
      </section>

      <section className="mt-16">
        <p className="eyebrow mb-4">Candidates ({candidates.length})</p>
        {candidates.length === 0 && (
          <p className="text-muted/70">No candidates yet — they appear as people reach new intersections.</p>
        )}
        <div className="divide-y divide-rule/12">
          {candidates.map((t) => (
            <div key={t.id} className="py-6" data-testid="candidate">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="pill">{name(t.gift_id, "gift")}</span>
                <span className="pill">{name(t.domain_id, "domain")}</span>
                <span className="pill">{t.source}</span>
                <span className="kv">
                  {t.usage_count} uses · ✷{t.resonance_up} / ✕{t.resonance_down}
                </span>
              </div>
              <p className="mt-3 font-sans text-fg">{t.pattern}</p>
              <p className="mt-1 text-sm text-muted">
                <strong className="text-live">Upward spiral:</strong> {t.upward_spiral_logic}
              </p>
              <div className="mt-4 flex items-center gap-5">
                <MessageForm action={promoteTrimTabAction} submitLabel="Promote to canon" pendingLabel="Promoting…" className="btn-line">
                  <input type="hidden" name="trim_tab_id" value={t.id} />
                </MessageForm>
                <MessageForm action={deleteCandidateAction} submitLabel="Discard" className="btn-line">
                  <input type="hidden" name="trim_tab_id" value={t.id} />
                </MessageForm>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
