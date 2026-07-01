"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Solarpunk terminal navigation: a ⌘K command palette + single-key "go" nav +
// a `?` shortcut legend. Layered over working links/mouse — progressive enhancement.
type Cmd = { key?: string; label: string; hint: string; run: (r: ReturnType<typeof useRouter>) => void };

const NAV: Cmd[] = [
  { key: "h", label: "Home", hint: "the whole earth", run: (r) => r.push("/") },
  { key: "g", label: "Begin a reading", hint: "compute your charts", run: (r) => r.push("/onboarding") },
  { key: "p", label: "Profile", hint: "your field manual", run: (r) => r.push("/profile") },
  { key: "c", label: "Constellations", hint: "weave with others", run: (r) => r.push("/constellations") },
  { key: "w", label: "Work", hint: "find aligned projects", run: (r) => r.push("/work") },
  { key: "u", label: "Curate", hint: "the trim-tab commons", run: (r) => r.push("/curate") },
  { key: "d", label: "Data", hint: "export · delete · consent", run: (r) => r.push("/settings") },
];
const ACTIONS: Cmd[] = [
  {
    label: "Toggle printing (Newsprint / Blueprint)",
    hint: "day / night",
    run: () => {
      const el = document.documentElement;
      const next = !el.classList.contains("mode-blueprint");
      el.classList.toggle("mode-blueprint", next);
      try { localStorage.setItem("eco-mode", next ? "blueprint" : "newsprint"); } catch {}
    },
  },
];
const ALL = [...NAV, ...ACTIONS];

function isEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function TerminalNav() {
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ALL;
    return ALL.filter((c) => (c.label + " " + c.hint).toLowerCase().includes(s));
  }, [q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Palette toggle works everywhere.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (e.key === "Escape") {
        setPalette(false);
        setHelp(false);
        return;
      }
      if (palette || help) return;
      if (isEditable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") { e.preventDefault(); setHelp(true); return; }
      const cmd = NAV.find((c) => c.key === e.key.toLowerCase());
      if (cmd) { e.preventDefault(); cmd.run(router); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [palette, help, router]);

  useEffect(() => {
    if (palette) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [palette]);
  useEffect(() => setSel(0), [q]);

  const choose = (c: Cmd) => {
    setPalette(false);
    c.run(router);
  };

  return (
    <>
      {/* desktop: a quiet command-palette affordance, bottom-right */}
      <button
        onClick={() => setPalette(true)}
        className="fixed bottom-4 right-4 z-30 hidden items-center gap-2 rounded-sm border border-rule/25 bg-bg/85 px-3 py-1.5 font-mono text-2xs uppercase tracking-eyebrow text-muted shadow-sm backdrop-blur transition hover:border-accent/40 hover:text-accent md:flex"
        aria-label="Open command palette"
      >
        <span className="text-accent">⌘K</span> menu
      </button>

      {/* mobile command menu — single tap target opening the full palette */}
      <button
        onClick={() => setPalette(true)}
        className="fixed bottom-4 right-4 z-30 flex items-center gap-2 border border-rule/30 bg-bg/90 px-3 py-2 font-mono text-2xs uppercase tracking-eyebrow text-muted shadow-sm backdrop-blur hover:text-accent md:hidden"
        aria-label="Open command menu"
      >
        <span className="text-accent">⌘</span> menu
      </button>

      {palette && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-bg/80 pt-[18vh] backdrop-blur-sm" onClick={() => setPalette(false)}>
          <div className="term-window w-[min(92vw,560px)]" onClick={(e) => e.stopPropagation()}>
            <div className="term-titlebar">
              <span className="term-title">Go to…</span>
              <span className="term-corner" aria-hidden>⌘K</span>
            </div>
            <div className="flex items-center gap-2 border-b border-rule/25 px-4 py-3 font-mono text-sm">
              <span className="text-muted/60" aria-hidden>↳</span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
                  if (e.key === "Enter" && results[sel]) { e.preventDefault(); choose(results[sel]); }
                }}
                placeholder="type a command…"
                className="w-full border-0 bg-transparent p-0 font-mono text-fg placeholder:text-muted/50 focus:outline-none focus:ring-0"
                aria-label="Command palette"
              />
            </div>
            <ul className="max-h-[50vh] overflow-auto py-1">
              {results.map((c, i) => (
                <li key={c.label}>
                  <button
                    onMouseEnter={() => setSel(i)}
                    onClick={() => choose(c)}
                    className={`flex w-full items-baseline justify-between px-4 py-2 text-left font-mono text-sm ${i === sel ? "bg-accent/15 text-fg" : "text-muted"}`}
                  >
                    <span>
                      <span className={`mr-2 ${i === sel ? "text-accent" : "text-transparent"}`} aria-hidden>▸</span>
                      {c.key && <span className="mr-2 text-accent">[{c.key}]</span>}{c.label}
                    </span>
                    <span className="text-2xs uppercase tracking-eyebrow text-muted/70">{c.hint}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 && <li className="px-4 py-3 font-mono text-sm text-muted">no match</li>}
            </ul>
          </div>
        </div>
      )}

      {help && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm" onClick={() => setHelp(false)}>
          <div className="w-[min(92vw,440px)] border border-rule/40 bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow mb-3">Fig. K · Keyboard legend</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-sm">
              {NAV.map((c) => (
                <div key={c.label} className="contents">
                  <dt className="text-accent">[{c.key}]</dt>
                  <dd className="text-muted">{c.label} — {c.hint}</dd>
                </div>
              ))}
              <div className="contents"><dt className="text-accent">[⌘k]</dt><dd className="text-muted">command palette</dd></div>
              <div className="contents"><dt className="text-accent">[?]</dt><dd className="text-muted">this legend</dd></div>
              <div className="contents"><dt className="text-accent">[esc]</dt><dd className="text-muted">close</dd></div>
            </dl>
            <p className="mt-4 font-sans text-xs text-muted/70">Keys work when not typing in a field.</p>
          </div>
        </div>
      )}
    </>
  );
}
