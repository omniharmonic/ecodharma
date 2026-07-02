import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { listCandidates, libraryStats } from "@/lib/trimtabs";
import { getConfig } from "@/lib/config";
import { loadFramework } from "@/lib/framework";
import { MessageForm } from "@/components/MessageForm";
import { promoteTrimTabAction, deleteCandidateAction } from "../actions/trimtab";
import { setModeAction, setPasswordAction, compPremiumAction } from "../actions/config";

export default async function CuratePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await isAdmin(user.email))) {
    return <div className="mx-auto mt-24 max-w-measure text-center text-muted">Curation is limited to stewards.</div>;
  }

  const fw = loadFramework();
  const name = (id: string, kind: "gift" | "domain") =>
    (kind === "gift" ? fw.gifts : fw.domains).find((x) => x.id === id)?.name || id;
  const [candidates, stats, config] = await Promise.all([listCandidates(), libraryStats(), getConfig()]);

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

      <section className="mt-16" data-testid="reading-engine">
        <p className="eyebrow mb-2">Reading engine</p>
        <p className="mb-4 text-sm text-muted">
          Claude-powered readings are the default. Flip to the hardcoded engine to conserve
          credits (it also trips there automatically if a reading hits an out-of-credits error).
          In Claude mode, a shared access password keeps signups invite-only.
        </p>
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="kv">current engine:</span>
          <span className="pill pill-solar" data-testid="engine-mode" data-mode={config.interpreterMode}>
            {config.interpreterMode === "claude" ? "Claude-powered" : "Hardcoded fallback"}
          </span>
          <span className="kv" data-testid="password-state" data-has={config.hasPassword ? "yes" : "no"}>
            · signup {config.hasPassword ? "password-gated" : "open"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MessageForm action={setModeAction} submitLabel={config.interpreterMode === "claude" ? "Switch to hardcoded" : "Switch to Claude"} pendingLabel="Switching…" className="btn-line">
            <input type="hidden" name="mode" value={config.interpreterMode === "claude" ? "fixture" : "claude"} />
          </MessageForm>
        </div>
        <div className="mt-5 max-w-sm">
          <p className="label mb-1">Shared access password</p>
          <MessageForm action={setPasswordAction} submitLabel="Save password" pendingLabel="Saving…" className="btn-line">
            <input name="access_password" type="text" className="input" placeholder={config.hasPassword ? "set — type a new one, or blank to clear" : "set a password to gate signup"} aria-label="Access password" data-testid="set-password-input" />
          </MessageForm>
        </div>
      </section>

      <section className="mt-16" data-testid="premium-admin">
        <p className="eyebrow mb-2">Premium</p>
        <p className="mb-4 text-sm text-muted">
          Comp premium to a member by email — no card needed. This is how you gift the reflection
          bot + weekly nudges to friends (and it works whether or not Stripe is connected).
        </p>
        <div className="max-w-sm space-y-3">
          <MessageForm action={compPremiumAction} submitLabel="Grant premium" pendingLabel="Granting…" className="btn-line">
            <input name="email" type="email" required className="input" placeholder="member@email.com" aria-label="Member email" data-testid="comp-email" />
            <input type="hidden" name="action" value="grant" />
          </MessageForm>
          <MessageForm action={compPremiumAction} submitLabel="Revoke premium" pendingLabel="Revoking…" className="btn-line">
            <input name="email" type="email" required className="input" placeholder="member@email.com" aria-label="Revoke member email" />
            <input type="hidden" name="action" value="revoke" />
          </MessageForm>
        </div>
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
