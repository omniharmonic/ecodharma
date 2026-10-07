"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import type { Snapshot } from "@/lib/altar/snapshot";
import { reflectionCharges, seeded, strainedRoots, vitals } from "@/lib/altar/becoming";
import { KIND_META, type ElementKind } from "@/lib/altar/model";

// SOIL — "a node in the mycelial web". Below the horizon:
//   · the trunk of the Prayer descends into the soil
//   · Roots (the a prioris) are taproots, styled by state — held (strong amber),
//     questioning (shimmering violet filaments), composting (dissolving, shedding
//     particles that drift to feed neighbours), renewed (bright, ringed)
//   · Practices, Works, Measures, Devotions are fungal nodes in the network
//   · every Reflection is a spore; its strands are hyphae, and light PULSES along
//     them from the reflection into what it touched — recent ones brightest
//   · Inquiries fruit as glowing mushroom caps at the points of strain
// Canvas 2D + d3-force. A still frame when motion is reduced.

type N = SimulationNodeDatum & {
  key: string; kind: ElementKind | "reflection" | "trunk"; label: string; status?: string; retired?: boolean;
  charge: number; weight: number; lineage?: number; age?: number;
};
type L = SimulationLinkDatum<N> & { kind: "strand" | "link" | "trunk"; charge: number; recency: number };

const H = 640;

function rgb(name: string, a = 1): string {
  if (typeof window === "undefined") return `rgba(200,200,200,${a})`;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).join(",");
  return `rgba(${v},${a})`;
}

export function SoilView({ snap, onSelect, still }: { snap: Snapshot; onSelect: (id: number | null) => void; still?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<N | null>(null);
  const [width, setWidth] = useState(720);

  const { nodes, links } = useMemo(() => {
    const now = Date.parse(snap.now);
    const v = vitals(snap.elements, snap.strands, snap.alignment, now);
    const strained = new Set(strainedRoots(snap.elements, snap.strands, now));
    const rc = reflectionCharges(snap.strands);
    const nodes: N[] = [{ key: "trunk", kind: "trunk", label: snap.elements.find((e) => e.kind === "prayer" && !e.retired)?.title || "Your prayer", charge: 1, weight: 1, fx: 0, fy: 62 }];
    const byLineage = new Map<number, N>();
    for (const e of snap.elements) {
      if (e.kind === "prayer" || (e.kind === "thread" && e.status !== "accepted")) continue;
      const vt = v.get(e.lineage_id)!;
      const n: N = {
        key: `e${e.lineage_id}`, kind: e.kind, label: e.title, status: strained.has(e.lineage_id) ? "strained" : e.status, retired: e.retired,
        charge: vt.charge, weight: 1 + Math.min(4, vt.touches * 0.5), lineage: e.lineage_id,
        x: (seeded(e.lineage_id) - 0.5) * 300, y: e.kind === "root" ? 380 : 160 + seeded(e.lineage_id * 2) * 200,
      };
      nodes.push(n);
      byLineage.set(e.lineage_id, n);
    }
    const links: L[] = [];
    for (const n of nodes) if (n.kind === "root" || n.kind === "practice") links.push({ source: "trunk", target: n.key, kind: "trunk", charge: 0, recency: 0 });
    for (const l of snap.links) {
      const a = byLineage.get(l.from);
      const b = byLineage.get(l.to);
      if (a && b) links.push({ source: a.key, target: b.key, kind: "link", charge: 0, recency: 0 });
      else if (a && !b) links.push({ source: a.key, target: "trunk", kind: "link", charge: 0, recency: 0 });
    }
    // The last 60 reflections as spores.
    const recent = snap.reflections.slice(-60);
    for (const r of recent) {
      const age = (now - Date.parse(r.at)) / 86_400_000;
      const n: N = { key: `r${r.id}`, kind: "reflection", label: `${r.cadence} reflection · ${new Date(r.at).toLocaleDateString()}`, charge: rc.get(r.id) ?? 0, weight: r.depth, age, x: (seeded(r.id) - 0.5) * 500, y: 120 + seeded(r.id * 7) * 380 };
      nodes.push(n);
      for (const s of snap.strands.filter((s) => s.reflection_id === r.id)) {
        const t = byLineage.get(s.lineage_id);
        if (t) links.push({ source: n.key, target: t.key, kind: "strand", charge: s.charge, recency: Math.max(0, 1 - age / 120) });
      }
    }
    return { nodes, links };
  }, [snap]);

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, e.contentRect.width)));
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = width * dpr;
    cv.height = H * dpr;
    const g = cv.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = width / 2;

    const sim = forceSimulation<N>(nodes)
      .force("link", forceLink<N, L>(links).id((d) => d.key).distance((l) => (l.kind === "strand" ? 80 : l.kind === "trunk" ? ((l.target as N).kind === "root" ? 420 : 180) : 110)).strength((l) => (l.kind === "strand" ? 0.25 : 0.5)))
      .force("charge", forceManyBody<N>().strength((d) => (d.kind === "reflection" ? -45 : -320)).distanceMax(420))
      .force("collide", forceCollide<N>().radius((d) => (d.kind === "reflection" ? 6 : 16 + d.weight * 2)))
      .force("x", forceX<N>(0).strength(0.02))
      .force("y", forceY<N>((d) => ({ devotion: 150, work: 210, measure: 250, practice: 300, reflection: 350, inquiry: 430, root: 540, trunk: 62 } as Record<string, number>)[d.kind] ?? 260)
        .strength((d) => (d.kind === "root" ? 0.7 : d.kind === "reflection" ? 0.03 : 0.12)))
      .stop();
    for (let i = 0; i < 260; i++) sim.tick();
    // Keep everything in the soil band, below the horizon and above the floor.
    for (const n of nodes) {
      if (n.kind === "trunk") continue;
      n.y = Math.max(80, Math.min(H - 40, n.y || 0));
      n.x = Math.max(-width / 2 + 24, Math.min(width / 2 - 24, n.x || 0));
    }

    const col = {
      bgTop: rgb("--sky-deep", 1), hypha: rgb("--hypha", 0.35), warm: (a: number) => rgb("--nebula-warm", a), cool: (a: number) => rgb("--nebula-cool", a),
      fg: (a: number) => rgb("--fg", a), accent: (a: number) => rgb("--accent", a), root: (s: string, a: number) => rgb(`--root-${s === "strained" ? "questioning" : s}`, a),
      live: (a: number) => rgb("--live", a), hyphaA: (a: number) => rgb("--hypha", a),
    };
    const chargeCol = (c: number, a: number) => (c > 0.25 ? col.warm(a) : c < -0.25 ? col.cool(a) : col.fg(a * 0.7));

    // Composting particles + pulses along strands.
    const debris = nodes.filter((n) => n.kind === "root" && (n.retired || n.status === "composting")).flatMap((n) =>
      Array.from({ length: 24 }, (_, i) => ({ n, dx: (seeded(i + (n.lineage || 0)) - 0.5) * 40, dy: seeded(i * 3 + (n.lineage || 0)) * 60, sp: 0.2 + seeded(i * 9) * 0.4 })));
    const strandLinks = links.filter((l) => l.kind === "strand");

    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      g.clearRect(0, 0, width, H);
      // soil
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, col.hyphaA(0.02));
      grd.addColorStop(0.08, col.hyphaA(0.1));
      grd.addColorStop(1, col.hyphaA(0.2));
      g.fillStyle = grd;
      g.fillRect(0, 0, width, H);
      // strata lines
      g.strokeStyle = col.hyphaA(0.08);
      for (let y = 80; y < H; y += 46) {
        g.beginPath();
        for (let x = 0; x <= width; x += 12) g.lineTo(x, y + Math.sin(x * 0.02 + y) * 3);
        g.stroke();
      }
      // horizon
      g.strokeStyle = col.accent(0.6);
      g.setLineDash([2, 4]);
      g.beginPath(); g.moveTo(0, 40); g.lineTo(width, 40); g.stroke();
      g.setLineDash([]);

      const P = (n: N) => [cx + (n.x || 0), n.y || 0] as const;
      // hyphae
      for (const l of links) {
        const a = l.source as N;
        const b = l.target as N;
        const [x1, y1] = P(a);
        const [x2, y2] = P(b);
        const mx = (x1 + x2) / 2 + Math.sin(t * 0.3 + x1 * 0.01) * 6 + (seeded(x1 + y2) - 0.5) * 30;
        const my = (y1 + y2) / 2 + Math.cos(t * 0.25 + y1 * 0.01) * 6;
        g.beginPath();
        g.moveTo(x1, y1);
        g.quadraticCurveTo(mx, my, x2, y2);
        if (l.kind === "trunk") { g.strokeStyle = col.hyphaA(0.55); g.lineWidth = 2.2; }
        else if (l.kind === "link") { g.strokeStyle = col.hyphaA(0.3); g.lineWidth = 1; }
        else { g.strokeStyle = chargeCol(l.charge, 0.12 + l.recency * 0.35); g.lineWidth = 0.8; }
        g.stroke();
      }
      // pulses: light travelling from each reflection into what it touched
      if (!still) {
        for (const [i, l] of strandLinks.entries()) {
          if (l.recency <= 0.02) continue;
          const a = l.source as N;
          const b = l.target as N;
          const [x1, y1] = P(a);
          const [x2, y2] = P(b);
          const speed = 0.12 + l.recency * 0.25;
          const ph = (t * speed + seeded(i)) % 1;
          const x = x1 + (x2 - x1) * ph;
          const y = y1 + (y2 - y1) * ph;
          g.fillStyle = chargeCol(l.charge, 0.35 + l.recency * 0.6);
          g.beginPath(); g.arc(x, y, 1.6 + l.recency * 2, 0, Math.PI * 2); g.fill();
        }
      }
      // compost drift
      for (const d of debris) {
        const [x, y] = P(d.n);
        const yy = y + ((t * d.sp * 20 + d.dy) % 70);
        g.fillStyle = col.root("composting", Math.max(0, 0.7 - ((t * d.sp * 20 + d.dy) % 70) / 100));
        g.fillRect(x + d.dx, yy, 1.6, 1.6);
      }
      // nodes
      for (const n of nodes) {
        const [x, y] = P(n);
        const breath = still ? 1 : 1 + 0.08 * Math.sin(t * (2 * Math.PI / 5.5) + (n.lineage || 0));
        if (n.kind === "trunk") {
          const r = 16 * breath;
          const gr = g.createRadialGradient(x, y, 0, x, y, r * 3);
          gr.addColorStop(0, col.accent(0.95)); gr.addColorStop(0.4, col.accent(0.35)); gr.addColorStop(1, col.accent(0));
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 3, 0, Math.PI * 2); g.fill();
          continue;
        }
        if (n.kind === "reflection") {
          const a = Math.max(0.2, 1 - (n.age || 0) / 200);
          g.fillStyle = chargeCol(n.charge, a);
          g.beginPath(); g.arc(x, y, 1.5 + n.weight, 0, Math.PI * 2); g.fill();
          continue;
        }
        if (n.kind === "inquiry") {
          const r = 9 * breath;
          g.fillStyle = col.root("questioning", 0.75);
          g.beginPath(); g.ellipse(x, y - 4, r, r * 0.6, 0, Math.PI, 0); g.fill();
          g.strokeStyle = col.root("questioning", 0.9); g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x, y + 8); g.stroke();
          continue;
        }
        const r = (6 + n.weight * 1.8) * (n.kind === "root" ? 1.1 : 1);
        let stroke = chargeCol(n.charge, 0.95);
        if (n.kind === "root") stroke = col.root(n.retired ? "composting" : n.status || "held", n.status === "questioning" || n.status === "strained" ? 0.55 + 0.4 * Math.abs(Math.sin(t * 1.3)) : 0.95);
        if (n.kind === "devotion") stroke = col.live(0.9);
        const halo = g.createRadialGradient(x, y, 0, x, y, r * 2.6);
        halo.addColorStop(0, stroke.replace(/,[\d.]+\)$/, ",0.35)"));
        halo.addColorStop(1, stroke.replace(/,[\d.]+\)$/, ",0)"));
        g.fillStyle = halo; g.beginPath(); g.arc(x, y, r * 2.6, 0, Math.PI * 2); g.fill();
        g.fillStyle = col.bgTop; g.strokeStyle = stroke; g.lineWidth = n.kind === "root" ? 2.2 : 1.4;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
        if (n.status === "renewed") { g.beginPath(); g.arc(x, y, r + 4, 0, Math.PI * 2); g.stroke(); }
        g.fillStyle = stroke; g.font = `${Math.round(r)}px "Segoe UI Symbol","Noto Sans Symbols 2",serif`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(KIND_META[n.kind as ElementKind]?.glyph || "•", x, y + 0.5);
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    draw(performance.now());

    const pick = (ev: MouseEvent): N | null => {
      const rect = cv.getBoundingClientRect();
      const mx = ev.clientX - rect.left - cx;
      const my = ev.clientY - rect.top;
      let best: N | null = null;
      let bd = 18 * 18;
      for (const n of nodes) {
        const dx = (n.x || 0) - mx;
        const dy = (n.y || 0) - my;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = n; }
      }
      return best;
    };
    const onMove = (e: MouseEvent) => setHover(pick(e));
    const onClick = (e: MouseEvent) => { const n = pick(e); onSelect(n?.lineage ?? null); };
    cv.addEventListener("mousemove", onMove);
    cv.addEventListener("click", onClick);
    return () => { cancelAnimationFrame(raf); cv.removeEventListener("mousemove", onMove); cv.removeEventListener("click", onClick); sim.stop(); };
  }, [nodes, links, width, still, onSelect]);

  return (
    <div ref={wrap} className="relative w-full" data-testid="soil-view">
      <canvas ref={canvas} style={{ width: "100%", height: H }} className="block cursor-crosshair" />
      <div className="pointer-events-none absolute bottom-3 right-3 text-right telemetry">
        <div>⟟ roots · ∿ practices · ◈ works · ◎ measures · ✶ devotions · ? inquiries · · reflections</div>
        <div className="mt-1 opacity-70">light travels from each reflection into what it touched</div>
      </div>
      {hover && hover.kind !== "trunk" && (
        <div className="pointer-events-none absolute left-3 top-3 max-w-sm border border-accent/50 bg-bg/90 px-3 py-2">
          <div className="telemetry text-accent">
            {hover.kind === "reflection" ? "spore" : KIND_META[hover.kind as ElementKind].label}
            {hover.status && hover.kind === "root" ? ` · ${hover.status}` : ""} · charge {hover.charge > 0 ? "+" : ""}{hover.charge.toFixed(1)}
          </div>
          <div className="text-sm text-fg">{hover.label}</div>
        </div>
      )}
    </div>
  );
}
