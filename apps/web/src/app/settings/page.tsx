import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { dataSummary } from "@/lib/account";
import { MessageForm } from "@/components/MessageForm";
import { revokeAllConsentsAction, deleteAccountAction } from "../actions/account";

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const summary = await dataSummary(user.id);

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
