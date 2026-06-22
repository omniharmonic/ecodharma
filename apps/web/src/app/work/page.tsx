import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { MessageForm } from "@/components/MessageForm";
import { isDiscoverable, matchProjectsForUser } from "@/lib/marketplace";
import { setDiscoverableAction } from "../actions/marketplace";

export default async function WorkPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const discoverable = await isDiscoverable(user.id);
  const matches = discoverable ? await matchProjectsForUser(user.id) : [];

  return (
    <div className="max-w-measure pt-10">
      <header className="animate-rise">
        <p className="eyebrow mb-4">Aligned work</p>
        <h1 className="font-display text-title leading-tight text-fg">Find your work</h1>
        <p className="mt-4 text-muted">
          Projects whose needs match your gifts — surfaced as invitations, not job listings.
        </p>
      </header>

      <section className="mt-16">
        <p className="eyebrow mb-3">Marketplace discovery {discoverable ? "is on" : "is off"}</p>
        <p className="mb-4 text-sm text-muted">
          Opt in to let projects discover your gifts. Only your display name, gift names, and offerings are
          shared — never your birth data or charts. This is your marketplace consent; revoke it anytime.
        </p>
        <MessageForm action={setDiscoverableAction} submitLabel={discoverable ? "Update" : "Make me discoverable"} pendingLabel="Saving…" className="btn-line">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="discoverable" defaultChecked={discoverable} />
            I consent to being surfaced in gift-aligned project matches
          </label>
        </MessageForm>
      </section>

      {discoverable && (
        <section className="mt-16">
          <p className="eyebrow mb-4">Aligned with your gifts ({matches.length})</p>
          {matches.length === 0 && (
            <p className="text-muted/70">No matches yet — as projects are named, the fitting ones will surface here.</p>
          )}
          <div className="divide-y divide-rule/12">
            {matches.map((m) => (
              <Link key={m.project.id} href={`/projects/${m.project.id}`} className="group block py-5" data-testid="work-match">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-display text-fig text-fg group-hover:text-accent">{m.project.title}</h3>
                  <span className="pill shrink-0">fit {m.score}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{m.project.description}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {m.shared_gifts.map((g) => <span key={g} className="pill">{g}</span>)}
                  {m.shared_domains.map((d) => <span key={d} className="pill">{d}</span>)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
