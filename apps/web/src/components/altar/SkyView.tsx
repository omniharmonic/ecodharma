"use client";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Snapshot } from "@/lib/altar/snapshot";
import { seeded, vitals, type Vital } from "@/lib/altar/becoming";
import { KIND_META } from "@/lib/altar/model";

// SKY — "a star of light". A 3D celestial sphere:
//   · the Prayer: a breathing star at the centre (fresnel-glow shader, halo)
//   · your NATAL SKY: the planets at their true ecliptic longitudes on a tilted
//     ecliptic ring with the twelve signs — the sky you were born under
//   · Gifts: the bright named stars of your personal constellation, linked
//   · Devotions: distant beacons the prayer is offered toward (light beams)
//   · Works: bodies in orbit — closer = truer to the prayer, brighter = alive
//   · Reflections: stardust nebulae around what they touched (warm = radiant,
//     violet = contracted)
// Drag to turn the heavens · scroll to approach · click a body to select it.

const OBLIQUITY = THREE.MathUtils.degToRad(23.44);
const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const PLANET_GLYPHS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇", North_Node: "☊", South_Node: "☋",
};

function cssColor(name: string, fallback: string): THREE.Color {
  if (typeof window === "undefined") return new THREE.Color(fallback);
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return new THREE.Color(fallback);
  const [r, g, b] = v.split(/\s+/).map(Number);
  return new THREE.Color(r / 255, g / 255, b / 255);
}

function usePalette() {
  return useMemo(() => ({
    warm: cssColor("--nebula-warm", "#f6b85c"),
    cool: cssColor("--nebula-cool", "#9684ec"),
    halo: cssColor("--halo", "#ffc878"),
    accent: cssColor("--accent", "#e8a13a"),
    line: cssColor("--console-grid", "#4fa3b8"),
    fg: cssColor("--fg", "#dce8e0"),
    live: cssColor("--live", "#9be8b0"),
  }), []);
}

function chargeColor(c: number, p: ReturnType<typeof usePalette>): THREE.Color {
  if (c > 0.25) return p.warm.clone().lerp(p.halo, Math.min(1, c / 2) * 0.4);
  if (c < -0.25) return p.cool.clone();
  return p.fg.clone().multiplyScalar(0.85);
}

/** A crisp text sprite (glyphs & labels) without extra deps. */
function useTextTexture(text: string, color: string, size = 64) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = size * 2;
    const g = c.getContext("2d")!;
    g.font = `${size}px "Segoe UI Symbol", "Noto Sans Symbols 2", "Apple Symbols", serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = color;
    g.shadowBlur = 16;
    g.fillStyle = color;
    g.fillText(text, size, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, color, size]);
}

function Glyph({ text, position, color, scale = 1.4 }: { text: string; position: [number, number, number]; color: string; scale?: number }) {
  const tex = useTextTexture(text, color);
  return (
    <sprite position={position} scale={[scale, scale, scale]}>
      <spriteMaterial map={tex} transparent depthWrite={false} />
    </sprite>
  );
}

const GLOW_TEX = (() => {
  let t: THREE.Texture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.2, "rgba(255,255,255,0.65)");
    grd.addColorStop(0.5, "rgba(255,255,255,0.14)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();

function Halo({ color, scale, opacity = 1, position = [0, 0, 0] as [number, number, number] }: { color: THREE.Color; scale: number; opacity?: number; position?: [number, number, number] }) {
  return (
    <sprite position={position} scale={[scale, scale, scale]}>
      <spriteMaterial map={GLOW_TEX()} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </sprite>
  );
}

/** A THREE.Line as a primitive (JSX <line> is claimed by SVG in TS). */
function Line3({ geometry, color, opacity }: { geometry: THREE.BufferGeometry; color: THREE.Color; opacity: number }) {
  const obj = useMemo(() => new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity })), [geometry, color, opacity]);
  return <primitive object={obj} />;
}

// --- the Prayer star --------------------------------------------------------
const starVert = `varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`;
const starFrag = `uniform vec3 uCore; uniform vec3 uRim; uniform float uTime; uniform float uPulse; varying vec3 vN; varying vec3 vV;
float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
  float g = 0.5 + 0.5*sin(uTime*1.1 + vN.y*6.0 + vN.x*4.0);
  float grain = (hash(vN*91.7 + floor(uTime*8.0)) - 0.5)*0.04;
  vec3 c = mix(uCore, uRim, f) * (1.0 + 0.25*g*uPulse) + grain;
  gl_FragColor = vec4(c, 1.0); }`;

function PrayerStar({ pulse, rings, p }: { pulse: number; rings: number; p: ReturnType<typeof usePalette> }) {
  const group = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: starVert, fragmentShader: starFrag,
    uniforms: { uCore: { value: p.halo.clone().multiplyScalar(1.1) }, uRim: { value: p.accent.clone() }, uTime: { value: 0 }, uPulse: { value: 0.4 + pulse } },
  }), [p, pulse]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    mat.uniforms.uTime.value = t;
    const s = 1 + 0.06 * Math.sin((t * 2 * Math.PI) / 5.5); // one breath every 5.5s
    group.current?.scale.setScalar(s);
  });
  return (
    <group ref={group}>
      <mesh material={mat}><sphereGeometry args={[1.25, 64, 64]} /></mesh>
      <Halo color={p.halo} scale={9} opacity={0.55 + pulse * 0.35} />
      <Halo color={p.accent} scale={22} opacity={0.18 + pulse * 0.12} />
      {/* tree rings of the prayer — one shell per version */}
      {Array.from({ length: rings }, (_, i) => (
        <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.7 + i * 0.22, 1.72 + i * 0.22, 96]} />
          <meshBasicMaterial color={p.accent} transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// --- background stars that twinkle -------------------------------------------
function Starfield({ count = 2400 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const { geo, mat } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = seeded(i * 3 + 1) * 2 - 1;
      const th = seeded(i * 3 + 2) * Math.PI * 2;
      const r = 90 + seeded(i * 3 + 3) * 40;
      const s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3);
      seed[i] = seeded(i * 7 + 5);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `attribute float seed; uniform float uTime; varying float vA;
        void main(){ vA = 0.35 + 0.65*abs(sin(uTime*(0.3+seed) + seed*40.0)); vec4 mv = modelViewMatrix*vec4(position,1.0);
        gl_PointSize = (1.0 + seed*2.2) * (300.0 / -mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); if(d>0.5) discard;
        gl_FragColor = vec4(vec3(0.85,0.9,1.0), vA*(1.0-d*2.0)); }`,
    });
    return { geo, mat };
  }, [count]);
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.getElapsedTime(); });
  return <points ref={ref} geometry={geo} material={mat} />;
}

// --- the natal ecliptic -------------------------------------------------------
function NatalEcliptic({ snap, p }: { snap: Snapshot; p: ReturnType<typeof usePalette> }) {
  const R = 30;
  const toVec = (lonDeg: number, r = R): [number, number, number] => {
    const a = THREE.MathUtils.degToRad(lonDeg);
    return [r * Math.cos(a), 0, -r * Math.sin(a)];
  };
  const ring = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 256; i++) { const a = (i / 256) * Math.PI * 2; pts.push(new THREE.Vector3(R * Math.cos(a), 0, R * Math.sin(a))); }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  const lineCol = `#${p.line.getHexString()}`;
  return (
    <group rotation={[OBLIQUITY, 0, 0]}>
      <lineLoop geometry={ring}><lineBasicMaterial color={p.line} transparent opacity={0.45} /></lineLoop>
      {SIGN_GLYPHS.map((g, i) => <Glyph key={g} text={g} position={toVec(i * 30 + 15, R + 3.2)} color={lineCol} scale={2.8} />)}
      {Array.from({ length: 12 }, (_, i) => {
        const [x, , z] = toVec(i * 30, R);
        const [x2, , z2] = toVec(i * 30, R + 1.4);
        const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, z), new THREE.Vector3(x2, 0, z2)]);
        return <lineSegments key={i} geometry={g}><lineBasicMaterial color={p.line} transparent opacity={0.6} /></lineSegments>;
      })}
      {snap.natal.map((b) => {
        const pos = toVec(b.lon, R);
        return (
          <group key={b.body}>
            <Halo color={b.body === "Sun" ? p.halo : p.fg} scale={b.body === "Sun" || b.body === "Moon" ? 3.4 : 2.2} opacity={0.7} position={pos} />
            <Glyph text={PLANET_GLYPHS[b.body] || "•"} position={[pos[0], 1.6, pos[2]]} color={b.body === "Sun" ? "#ffd27a" : "#e8f0ea"} scale={2.6} />
          </group>
        );
      })}
      {snap.ascendant != null && <Glyph text="AC" position={toVec(snap.ascendant, R - 2.4)} color="#e8a13a" scale={1.6} />}
    </group>
  );
}

// --- gifts, devotions, works, stardust -----------------------------------------
type Hoverable = { id: number | null; label: string; sub: string };

function Selectable({ children, id, label, sub, onHover, onSelect }: {
  children: React.ReactNode; id: number | null; label: string; sub: string;
  onHover: (h: Hoverable | null) => void; onSelect: (id: number | null) => void;
}) {
  return (
    <group
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover({ id, label, sub }); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { onHover(null); document.body.style.cursor = ""; }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(id); }}
    >
      {children}
    </group>
  );
}

function Orbiter({ index, total, v, title, id, p, onHover, onSelect }: {
  index: number; total: number; v: Vital; title: string; id: number; p: ReturnType<typeof usePalette>;
  onHover: (h: Hoverable | null) => void; onSelect: (id: number | null) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const fid = v.fidelity ?? 3;
  const radius = 15 - (fid - 1) * 1.5; // truer → closer (9..15)
  const tilt = (seeded(id) - 0.5) * 0.7;
  const speed = 0.05 + seeded(id * 5) * 0.05;
  const phase0 = (index / Math.max(1, total)) * Math.PI * 2;
  const color = chargeColor(v.charge, p);
  const size = 0.35 + Math.min(0.6, v.recentTouches * 0.08);
  const orbit = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(radius * Math.cos(a), 0, radius * Math.sin(a))); }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius]);
  useFrame(({ clock }) => {
    const a = phase0 + clock.getElapsedTime() * speed;
    ref.current?.position.set(radius * Math.cos(a), 0, radius * Math.sin(a));
  });
  return (
    <group rotation={[tilt, 0, tilt * 0.5]}>
      <lineLoop geometry={orbit}><lineBasicMaterial color={color} transparent opacity={0.16 + Math.min(0.3, v.recentTouches * 0.05)} /></lineLoop>
      <group ref={ref}>
        <Selectable id={id} label={title} sub={`work · charge ${v.charge.toFixed(1)} · ${v.recentTouches} touches (90d)`} onHover={onHover} onSelect={onSelect}>
          <mesh><sphereGeometry args={[size, 24, 24]} /><meshBasicMaterial color={color} /></mesh>
          <Halo color={color} scale={size * 8} opacity={0.35 + Math.min(0.5, v.recentTouches * 0.08)} />
        </Selectable>
      </group>
    </group>
  );
}

function Stardust({ snap, anchors, p }: { snap: Snapshot; anchors: Map<number, THREE.Vector3>; p: ReturnType<typeof usePalette> }) {
  const mat = useMemo(() => new THREE.PointsMaterial({ size: 0.28, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, map: GLOW_TEX() }), []);
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const now = Date.parse(snap.now);
    const pts: number[] = [];
    const cols: number[] = [];
    snap.strands.forEach((s, i) => {
      const a = anchors.get(s.lineage_id);
      if (!a) return;
      const age = (now - Date.parse(s.at)) / 86_400_000;
      const n = s.status === "confirmed" ? 14 : 5;
      const col = chargeColor(s.charge, p).multiplyScalar(Math.max(0.25, 1 - age / 365));
      for (let k = 0; k < n; k++) {
        const r = 0.6 + seeded(i * 31 + k) * 2.6;
        const u = seeded(i * 17 + k * 3) * 2 - 1;
        const th = seeded(i * 13 + k * 7) * Math.PI * 2;
        const sq = Math.sqrt(1 - u * u);
        pts.push(a.x + r * sq * Math.cos(th), a.y + r * u * 0.5, a.z + r * sq * Math.sin(th));
        cols.push(col.r, col.g, col.b);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    return g;
  }, [snap, anchors, p]);
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.01; });
  return <points ref={ref} geometry={geo} material={mat} />;
}

// --- camera: drag to turn, wheel to approach, gentle auto-drift ---------------
function OrbitRig() {
  const { camera, gl } = useThree();
  const st = useRef({ theta: 0.6, phi: 1.15, r: 46, drag: false, x: 0, y: 0, idle: 0 });
  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => { st.current.drag = true; st.current.x = e.clientX; st.current.y = e.clientY; st.current.idle = 0; };
    const up = () => { st.current.drag = false; };
    const move = (e: PointerEvent) => {
      if (!st.current.drag) return;
      st.current.theta -= (e.clientX - st.current.x) * 0.005;
      st.current.phi = Math.min(2.8, Math.max(0.2, st.current.phi - (e.clientY - st.current.y) * 0.005));
      st.current.x = e.clientX; st.current.y = e.clientY;
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); st.current.r = Math.min(110, Math.max(14, st.current.r * (1 + e.deltaY * 0.001))); };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointermove", move);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up);
      window.removeEventListener("pointermove", move); el.removeEventListener("wheel", wheel);
    };
  }, [gl]);
  useFrame((_, dt) => {
    const s = st.current;
    if (!s.drag) { s.idle += dt; if (s.idle > 2) s.theta += dt * 0.025; }
    camera.position.set(s.r * Math.sin(s.phi) * Math.cos(s.theta), s.r * Math.cos(s.phi), s.r * Math.sin(s.phi) * Math.sin(s.theta));
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Scene({ snap, onSelect, onHover }: { snap: Snapshot; onSelect: (id: number | null) => void; onHover: (h: Hoverable | null) => void }) {
  const p = usePalette();
  const v = useMemo(() => vitals(snap.elements, snap.strands, snap.alignment, Date.parse(snap.now)), [snap]);
  const live = snap.elements.filter((e) => !e.retired);
  const works = live.filter((e) => e.kind === "work");
  const devotions = live.filter((e) => e.kind === "devotion");
  const practices = live.filter((e) => e.kind === "practice");
  const pulse = Math.min(1, snap.reflections.filter((r) => Date.parse(snap.now) - Date.parse(r.at) < 30 * 86_400_000).length / 6);

  // Fixed anchor positions (gifts on an inner shell, devotions as far beacons, practices low).
  const anchors = useMemo(() => {
    const m = new Map<number, THREE.Vector3>();
    devotions.forEach((d, i) => {
      const a = (i / Math.max(1, devotions.length)) * Math.PI * 2 + 0.4;
      m.set(d.lineage_id, new THREE.Vector3(24 * Math.cos(a), 9 + seeded(d.lineage_id) * 6, 24 * Math.sin(a)));
    });
    practices.forEach((d, i) => {
      const a = (i / Math.max(1, practices.length)) * Math.PI * 2 + 1.1;
      m.set(d.lineage_id, new THREE.Vector3(7 * Math.cos(a), -5 - seeded(d.lineage_id) * 2, 7 * Math.sin(a)));
    });
    works.forEach((w, i) => {
      const fid = v.get(w.lineage_id)?.fidelity ?? 3;
      const r = 15 - (fid - 1) * 1.5;
      const a = (i / Math.max(1, works.length)) * Math.PI * 2;
      m.set(w.lineage_id, new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
    });
    snap.elements.filter((e) => ["root", "measure", "inquiry", "prayer", "thread"].includes(e.kind)).forEach((e) => m.set(e.lineage_id, new THREE.Vector3(0, e.kind === "root" ? -4 : 0, 0)));
    return m;
  }, [snap, v]); // eslint-disable-line react-hooks/exhaustive-deps

  const giftPositions = snap.gifts.map((g, i) => {
    const a = (i / Math.max(1, snap.gifts.length)) * Math.PI * 2 - 0.3;
    return new THREE.Vector3(6.5 * Math.cos(a), 4.5 + seeded(i + 11) * 2, 6.5 * Math.sin(a));
  });
  const giftLines = useMemo(() => {
    if (giftPositions.length < 2) return null;
    return new THREE.BufferGeometry().setFromPoints([...giftPositions, giftPositions[0]]);
  }, [snap]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <color attach="background" args={["#03121a"]} />
      <fog attach="fog" args={["#03121a", 80, 170]} />
      <OrbitRig />
      <Starfield />
      <NatalEcliptic snap={snap} p={p} />
      <PrayerStar pulse={pulse} rings={snap.rings.length} p={p} />

      {/* the gift constellation */}
      {giftLines && <Line3 geometry={giftLines} color={p.accent} opacity={0.55} />}
      {snap.gifts.map((g, i) => (
        <Selectable key={g.id} id={null} label={g.name} sub="gift · from your reading" onHover={onHover} onSelect={onSelect}>
          <Halo color={p.halo} scale={3 + g.prominence * 2} opacity={0.9} position={giftPositions[i].toArray() as [number, number, number]} />
          <mesh position={giftPositions[i]}><sphereGeometry args={[0.22, 16, 16]} /><meshBasicMaterial color={p.halo} /></mesh>
        </Selectable>
      ))}

      {/* devotions — beacons the prayer is offered toward, joined by beams */}
      {devotions.map((d) => {
        const pos = anchors.get(d.lineage_id)!;
        const beam = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), pos]);
        const vt = v.get(d.lineage_id)!;
        return (
          <group key={d.lineage_id}>
            <Line3 geometry={beam} color={p.halo} opacity={0.12 + Math.min(0.3, vt.recentTouches * 0.06)} />
            <Selectable id={d.lineage_id} label={d.title} sub={`devotion · ${vt.touches} strands`} onHover={onHover} onSelect={onSelect}>
              <Halo color={p.live} scale={4.5} opacity={0.75} position={pos.toArray() as [number, number, number]} />
              <mesh position={pos}><octahedronGeometry args={[0.5, 0]} /><meshBasicMaterial color={p.live} wireframe /></mesh>
            </Selectable>
          </group>
        );
      })}

      {/* practices — the low steady lamps beneath the star */}
      {practices.map((d) => {
        const pos = anchors.get(d.lineage_id)!;
        const vt = v.get(d.lineage_id)!;
        return (
          <Selectable key={d.lineage_id} id={d.lineage_id} label={d.title} sub={`practice · ${vt.recentTouches} touches (90d)`} onHover={onHover} onSelect={onSelect}>
            <Halo color={chargeColor(vt.charge, p)} scale={2.6} opacity={0.6} position={pos.toArray() as [number, number, number]} />
            <mesh position={pos}><torusGeometry args={[0.45, 0.06, 8, 32]} /><meshBasicMaterial color={chargeColor(vt.charge, p)} /></mesh>
          </Selectable>
        );
      })}

      {/* Dharma Constellation — kin as neighbouring stars, threads of light to you */}
      {snap.kin.map((k, i) => {
        const a = (i / Math.max(1, snap.kin.length)) * Math.PI * 2 + 0.9;
        const pos = new THREE.Vector3(44 * Math.cos(a), 6 + seeded(i + 99) * 10 - 5, 44 * Math.sin(a));
        const thread = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), pos]);
        return (
          <group key={k.id}>
            <Line3 geometry={thread} color={p.live} opacity={0.22} />
            <Selectable id={null} label={`${k.name}${k.gifts.length ? ` — ${k.gifts.join(", ")}` : ""}`} sub="kin · your Dharma Constellation" onHover={onHover} onSelect={onSelect}>
              <Halo color={p.live} scale={7} opacity={0.8} position={pos.toArray() as [number, number, number]} />
              <mesh position={pos}><sphereGeometry args={[0.55, 16, 16]} /><meshBasicMaterial color={p.live} /></mesh>
            </Selectable>
          </group>
        );
      })}

      {works.map((w, i) => (
        <Orbiter key={w.lineage_id} index={i} total={works.length} v={v.get(w.lineage_id)!} title={w.title} id={w.lineage_id} p={p} onHover={onHover} onSelect={onSelect} />
      ))}
      <Stardust snap={snap} anchors={anchors} p={p} />
    </>
  );
}

export function SkyView({ snap, onSelect }: { snap: Snapshot; onSelect: (id: number | null) => void }) {
  const [hover, setHover] = useState<Hoverable | null>(null);
  return (
    <div className="relative aspect-square w-full sm:aspect-[4/3]" data-testid="sky-view">
      <Canvas camera={{ fov: 50, near: 0.1, far: 400, position: [30, 20, 30] }} dpr={[1, 2]} gl={{ antialias: true }}>
        <Scene snap={snap} onSelect={onSelect} onHover={setHover} />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 telemetry">
        <div>☉ prayer · ✶ gifts · ◇ devotions · ○ practices · ● works in orbit{snap.kin.length ? " · ✦ kin" : ""}</div>
        <div className="mt-1 opacity-70">drag to turn the heavens · scroll to approach</div>
      </div>
      {hover && (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-sm border border-accent/50 bg-bg/90 px-3 py-2">
          <div className="telemetry text-accent">{hover.sub}</div>
          <div className="text-sm text-fg">{hover.label}</div>
        </div>
      )}
    </div>
  );
}

export { KIND_META };
