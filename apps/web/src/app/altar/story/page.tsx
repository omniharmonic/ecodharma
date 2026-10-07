import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { canUseAltar } from "@/lib/altar/access";
import { assembleStory } from "@/lib/altar/story";
import { SacredGeometry } from "@/components/altar/SacredGeometry";
import { PageTransition } from "@/components/PageTransition";

export const dynamic = "force-dynamic";

const PRESETS: { id: string; label: string; days: number }[] = [
  { id: "season", label: "This season", days: 91 },
  { id: "half", label: "Half a year", days: 182 },
  { id: "year", label: "This year", days: 365 },
];

/** A tiny, safe renderer for the story markdown (headings, quotes, lists, paragraphs). */
function Story({ md }: { md: string }) {
  const lines = md.split("\n");
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((p, i) =>
      p.startsWith("**") ? <strong key={i} className="text-fg">{p.slice(2, -2)}</strong> : p.startsWith("*") ? <em key={i} className="text-muted">{p.slice(1, -1)}</em> : p);
  return (
    <div className="space-y-2">
      {lines.map((l, i) => {
        if (l.startsWith("# ")) return <h1 key={i} className="font-display text-[2.2rem] leading-tight text-fg">{l.slice(2)}</h1>;
        if (l.startsWith("## ")) return <h2 key={i} className="pt-6 font-mono text-2xs uppercase tracking-eyebrow text-accent">{l.slice(3)}</h2>;
        if (l.startsWith("> ")) return <blockquote key={i} className="border-l-2 border-accent/60 pl-4 font-display text-lg leading-snug text-fg">{inline(l.slice(2))}</blockquote>;
        if (l.startsWith("- ")) return <p key={i} className="pl-4 text-sm text-fg">· {inline(l.slice(2))}</p>;
        if (!l.trim()) return null;
        return <p key={i} className="text-sm text-muted">{inline(l)}</p>;
      })}
    </div>
  );
}

export default async function StoryPage({ searchParams }: { searchParams: { p?: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  const preset = PRESETS.find((x) => x.id === searchParams.p) || PRESETS[0];
  const until = new Date().toISOString();
  const since = new Date(Date.now() - preset.days * 86_400_000).toISOString();
  const story = await assembleStory(user!.id, since, until);
  return (
    <PageTransition>
      <section className="relative mx-auto mt-10 max-w-2xl">
        <div className="pointer-events-none absolute -right-24 -top-16 opacity-70"><SacredGeometry size={360} variant="seed" opacity={0.14} /></div>
        <div className="relative flex flex-wrap gap-2">
          {PRESETS.map((x) => (
            <Link key={x.id} href={`/altar/story?p=${x.id}`} className={`font-mono text-2xs uppercase tracking-eyebrow border px-2.5 py-1 ${x.id === preset.id ? "border-accent text-accent" : "border-rule/20 text-muted"}`}>{x.label}</Link>
          ))}
          <Link href="/altar" className="ml-auto telemetry hover:text-accent">← the altar</Link>
        </div>
        <article className="relative mt-8" data-testid="story">
          {story.counts.reflections === 0 ? (
            <p className="text-muted">No reflections in this span yet. The story writes itself as you return.</p>
          ) : (
            <Story md={story.markdown} />
          )}
        </article>
        <p className="mt-10 text-2xs text-muted">
          Every quote here is yours. In Claude, ask it to <span className="text-fg">assemble_story</span> and reflect on it with you.
        </p>
      </section>
    </PageTransition>
  );
}
