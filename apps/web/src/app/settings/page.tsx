import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { dataSummary } from "@/lib/account";
import { getBilling } from "@/lib/billing";
import { latestNudge, nudgesEnabled } from "@/lib/nudges";
import { hasActiveMcpToken } from "@/lib/mcp-auth";
import { MessageForm } from "@/components/MessageForm";
import { ConnectBot } from "@/components/ConnectBot";
import { McpPanel } from "@/components/McpPanel";
import { revokeAllConsentsAction, deleteAccountAction } from "../actions/account";
import { startCheckoutAction, openPortalAction } from "../actions/billing";
import { setNudgesAction } from "../actions/nudges";

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const [summary, billing] = await Promise.all([dataSummary(user.id), getBilling(user.id)]);
  const [nudgeOn, lastNudge, mcpToken] = billing.premium
    ? await Promise.all([nudgesEnabled(user.id), latestNudge(user.id), hasActiveMcpToken(user.id)])
    : [false, null, false];

  return (
    <div className="max-w-measure pt-10">
      <header className="animate-rise">
        <p className="eyebrow mb-4">Privacy & control</p>
        <h1 className="font-display text-title leading-tight text-fg">Your data</h1>
        <p className="mt-4 text-muted">
          Your readings and profile are private by default. Birth data is sensitive and protected
          by row-level security — owner-only — and nothing is ever shared without your active consent.
        </p>
      </header>

      <section className="mt-16">
        <p className="eyebrow mb-4">What we hold for you</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1" data-testid="data-summary">
          <span className="pill">{summary.charts} charts</span>
          <span className="pill">{summary.profiles} gift profiles</span>
          <span className="pill">{summary.activeConsents} active consents</span>
          <span className="pill">{summary.constellations} constellations</span>
        </div>
        <p className="mt-4 text-sm text-muted">Signed in as {user.email}</p>
      </section>

      <section className="mt-16" data-testid="membership">
        <p className="eyebrow mb-2">Membership</p>
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="kv">current plan:</span>
          <span className={billing.premium ? "pill pill-solar" : "pill"} data-testid="plan-badge" data-plan={billing.plan}>
            {billing.premium ? "Premium" : "Free"}
          </span>
        </div>
        {billing.premium ? (
          <div className="space-y-3">
            <p className="max-w-prose text-sm text-muted">
              You have the reflection bot and weekly dharma nudges. Thank you for sustaining this work.
            </p>
            {billing.stripeEnabled && billing.stripeCustomerId && (
              <MessageForm action={openPortalAction} submitLabel="Manage billing" pendingLabel="Opening…" className="btn-line" />
            )}
            <div className="mt-6 border-t border-rule/15 pt-6">
              <ConnectBot />
            </div>

            <div className="mt-6 border-t border-rule/15 pt-6">
              <McpPanel hasToken={mcpToken} />
            </div>

            <div className="mt-6 border-t border-rule/15 pt-6" data-testid="nudges">
              <p className="eyebrow mb-2">Weekly dharma nudge</p>
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="kv">status:</span>
                <span className={nudgeOn ? "pill pill-solar" : "pill"} data-testid="nudge-status" data-on={nudgeOn ? "yes" : "no"}>
                  {nudgeOn ? "On" : "Paused"}
                </span>
              </div>
              <MessageForm action={setNudgesAction} submitLabel={nudgeOn ? "Pause weekly nudges" : "Turn on weekly nudges"} pendingLabel="Saving…" className="btn-line">
                <input type="hidden" name="on" value={nudgeOn ? "false" : "true"} />
              </MessageForm>
              {lastNudge && (
                <div className="mt-4 border-l-2 border-accent pl-4">
                  <p className="kv mb-1">Your latest nudge</p>
                  <p className="whitespace-pre-line text-sm text-fg" data-testid="latest-nudge">{lastNudge.body}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="max-w-prose text-sm text-muted">
              Premium unlocks continuous reflection — talk to your profile any time via Telegram —
              and a weekly dharma nudge that plays to your strengths. Your initial reading stays free.
            </p>
            {billing.stripeEnabled ? (
              <MessageForm action={startCheckoutAction} submitLabel="Go premium" pendingLabel="Starting…" className="btn-solar" />
            ) : (
              <p className="text-sm text-muted/80" data-testid="premium-soon">Premium is opening soon.</p>
            )}
          </div>
        )}
      </section>

      <section className="mt-16">
        <p className="eyebrow mb-2">Export everything</p>
        <p className="mb-4 text-sm text-muted">Download a complete copy of your data as JSON.</p>
        <a href="/api/export" className="btn-line" data-testid="export-link" download>
          Export my data
        </a>
      </section>

      <section className="mt-16">
        <p className="eyebrow mb-2">Withdraw consent</p>
        <p className="mb-4 text-sm text-muted">
          Revoke every consent you&rsquo;ve granted, immediately, everywhere.
        </p>
        <MessageForm action={revokeAllConsentsAction} submitLabel="Revoke all consents" pendingLabel="Revoking…" className="btn-line" />
      </section>

      <section className="mt-20 border-t border-flag/40 pt-8">
        <p className="mb-2 font-mono text-2xs uppercase tracking-eyebrow text-flag">Delete your account</p>
        <p className="mb-4 text-sm text-muted">
          Permanent. Erases your birth data, charts, profiles, offerings, consents, and constellations.
          Type <strong>DELETE</strong> to confirm.
        </p>
        <MessageForm action={deleteAccountAction} submitLabel="Delete my account" pendingLabel="Deleting…" className="btn-line">
          <input name="confirm" className="input" placeholder="DELETE" aria-label="Type DELETE to confirm" />
        </MessageForm>
      </section>
    </div>
  );
}
