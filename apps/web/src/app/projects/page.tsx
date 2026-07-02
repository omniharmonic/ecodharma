import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { loadFramework } from "@/lib/framework";
import { MessageForm } from "@/components/MessageForm";
import { createProjectAction } from "../actions/marketplace";
import type { ProjectRow } from "@/lib/marketplace";

// Marketplace disabled for launch (see /work). Set to true to re-enable.
const WORK_ENABLED = false;

export default async function ProjectsPage() {
  if (!WORK_ENABLED) redirect("/profile");
  const user = await getUser();
  if (!user) redirect("/login");
  const fw = loadFramework();

  const projects = await withUser(user.id, async (c) => {
    const { rows } = await c.query<ProjectRow>(
      "select * from projects where status='open' order by created_at desc limit 50",
    );
    return rows;
  });
  const giftName = (id: string) => fw.gifts.find((g) => g.id === id)?.name || id;
  const domainName = (id: string) => fw.domains.find((d) => d.id === id)?.name || id;

  return (
    <div className="max-w-measure pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4 animate-rise">
        <div>
          <p className="eyebrow mb-4">The work</p>
          <h1 className="font-display text-title leading-tight text-fg">Projects</h1>
          <p className="mt-4 text-muted">
            Work expressed in the language of gifts. Projects name what they need; the framework
            surfaces the people whose medicine fits.
          </p>
        </div>
        <Link href="/work" className="btn-line">find work for my gifts</Link>
      </header>

      <section className="mt-16">
        <p className="eyebrow mb-4">Open projects ({projects.length})</p>
        {projects.length === 0 && <p className="text-muted/70">None yet — be the first to name a need.</p>}
        <div className="divide-y divide-rule/12">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group block py-5" data-testid="project-card">
              <h3 className="font-display text-fig text-fg group-hover:text-accent">{p.title}</h3>
              {p.place && <p className="mt-0.5 kv">{p.place}</p>}
              <p className="mt-1 text-sm text-muted">{p.description}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {p.needed_gifts.map((g) => <span key={g} className="pill">{giftName(g)}</span>)}
                {p.needed_domains.map((d) => <span key={d} className="pill">{domainName(d)}</span>)}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-20 border-t border-rule/15 pt-8">
        <p className="eyebrow mb-4">Name a project need</p>
        <MessageForm action={createProjectAction} submitLabel="Create project" pendingLabel="Creating…">
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" className="input" required placeholder="e.g. Watershed council for the lower river" />
          </div>
          <div>
            <label className="label" htmlFor="description">What is it, and what does it need?</label>
            <textarea id="description" name="description" rows={3} className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="place">Place (optional)</label>
            <input id="place" name="place" className="input" placeholder="bioregion / city" />
          </div>
          <fieldset>
            <legend className="label">Gifts this needs</legend>
            <div className="flex flex-wrap gap-2">
              {fw.gifts.map((g) => (
                <label key={g.id} className="pill cursor-pointer">
                  <input type="checkbox" name="needed_gifts" value={g.id} className="mr-1.5" />{g.name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Domains this serves</legend>
            <div className="flex flex-wrap gap-2">
              {fw.domains.map((d) => (
                <label key={d.id} className="pill cursor-pointer">
                  <input type="checkbox" name="needed_domains" value={d.id} className="mr-1.5" />{d.name}
                </label>
              ))}
            </div>
          </fieldset>
        </MessageForm>
      </section>
    </div>
  );
}
