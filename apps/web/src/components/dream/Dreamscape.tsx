"use client";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { Snapshot } from "@/lib/altar/snapshot";
import { moonPhase, reflectionCharges, seeded, vitals } from "@/lib/altar/becoming";
import { PLANAR, solidEdges, toGeometry } from "./geometry";
import { POSES, onDream, type Place } from "./bus";

// THE DREAMSCAPE — one persistent world beneath every page.
//   above:   stars, nebula, sacred geometry turning in the dark, the natal ecliptic,
//            the constellation of the altar around the breathing Prayer-star, kin
//   surface: a still black lake that mirrors the sky; reflections drop in as light
//            and ripple outward (the journal, literally)
//   depths:  luminous roots descending beneath the water (the unconscious)

const LAKE_Y = -6;
const OBLIQUITY = THREE.MathUtils.degToRad(23.44);
const C = {
  abyss: new THREE.Color("#02070c"),
  star: new THREE.Color("#e8f0ff"),
  gold: new THREE.Color("#ffc878"),
  amber: new THREE.Color("#e8a13a"),
  warm: new THREE.Color("#f6b85c"),
  violet: new THREE.Color("#9684ec"),
  kin: new THREE.Color("#9be8b0"),
  glyph: new THREE.Color("#7fd3e6"),
  rose: new THREE.Color("#e58fb0"),
};
const chargeColor = (c: number) => (c > 0.25 ? C.warm : c < -0.25 ? C.violet : C.star);

export type DreamData = { snap: Snapshot | null; natal: { body: string; lon: number; sign: string }[] | null };

// ---------------------------------------------------------------- textures --
let glowTex: THREE.Texture | null = null;
function glow(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.18, "rgba(255,255,255,0.7)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.16)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

function textTexture(text: string, color: string, size = 96) {
  const c = document.createElement("canvas");
  c.width = c.height = size * 2;
  const g = c.getContext("2d")!;
  g.font = `${size}px "Segoe UI Symbol","Noto Sans Symbols 2","Noto Sans Symbols","Apple Symbols",serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = color;
  g.shadowBlur = 24;
  g.fillStyle = color;
  g.fillText(text, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Halo({ color, scale, opacity = 1, position = [0, 0, 0] }: { color: THREE.Color; scale: number; opacity?: number; position?: [number, number, number] }) {
  return (
    <sprite position={position} scale={[scale, scale, scale]}>
      <spriteMaterial map={glow()} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </sprite>
  );
}

function Glyph({ text, position, color, scale = 2, opacity = 1 }: { text: string; position: [number, number, number]; color: string; scale?: number; opacity?: number }) {
  const tex = useMemo(() => textTexture(text, color), [text, color]);
  return (
    <sprite position={position} scale={[scale, scale, scale]}>
      <spriteMaterial map={tex} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

function Line3({ geometry, color, opacity }: { geometry: THREE.BufferGeometry; color: THREE.Color; opacity: number }) {
  const obj = useMemo(() => new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })), [geometry, color, opacity]);
  return <primitive object={obj} />;
}

// --------------------------------------------------------------- the heavens --
function Stars({ count }: { count: number }) {
  const { geo, mat } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const tint = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = seeded(i * 3 + 1) * 1.1 - 0.1; // mostly the upper sky
      const th = seeded(i * 3 + 2) * Math.PI * 2;
      const r = 160 + seeded(i * 3 + 3) * 60;
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      pos.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3);
      seed[i] = seeded(i * 7 + 5);
      const t = seeded(i * 11);
      const col = t < 0.08 ? C.gold : t < 0.14 ? C.glyph : t < 0.17 ? C.rose : C.star;
      tint.set([col.r, col.g, col.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    geo.setAttribute("tint", new THREE.BufferAttribute(tint, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `attribute float seed; attribute vec3 tint; uniform float uTime; varying float vA; varying vec3 vC;
        void main(){ vC = tint; vA = 0.35 + 0.65*pow(abs(sin(uTime*(0.25+seed*0.9) + seed*50.0)), 2.0);
        vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = (0.8 + seed*seed*3.4) * (420.0 / -mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); if(d>0.5) discard;
        float core = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC, vA*core*core); }`,
    });
    return { geo, mat };
  }, [count]);
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.getElapsedTime(); });
  return <points geometry={geo} material={mat} />;
}

/** A vast faint nebula on the inside of the sky sphere (fbm noise). */
function Nebula() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; varying vec3 vP;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
      float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
      void main(){
        vec3 p = vP*2.4 + vec3(0.0, uTime*0.004, 0.0);
        float band = exp(-pow((vP.y - 0.18 - 0.25*vP.x)*3.2, 2.0)); // a milky river across the sky
        float f = fbm(p) * band;
        float g = fbm(p*1.7 + 3.1);
        vec3 col = mix(vec3(0.03,0.06,0.12), vec3(0.22,0.12,0.30), g) + vec3(0.30,0.18,0.08)*pow(f,2.0);
        float horizonFade = smoothstep(-0.15, 0.25, vP.y);
        gl_FragColor = vec4(col * (0.3 + 1.1*f), (0.32*f + 0.05) * horizonFade);
      }`,
  }), []);
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.getElapsedTime(); });
  return <mesh material={mat}><sphereGeometry args={[240, 48, 32]} /></mesh>;
}

/** Dust motes drifting through the near space — makes the dark feel inhabited. */
function Motes({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) pos.set([(seeded(i) - 0.5) * 120, LAKE_Y + 1 + seeded(i + 9) * 50, (seeded(i + 4) - 0.5) * 120], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]);
  const mat = useMemo(() => new THREE.PointsMaterial({ size: 0.16, color: C.gold, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, map: glow() }), []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.getElapsedTime() * 0.006;
    ref.current.position.y = Math.sin(clock.getElapsedTime() * 0.2) * 0.6;
  });
  return <points ref={ref} geometry={geo} material={mat} />;
}

// ---------------------------------------------------------- the prayer-star --
const starVert = `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`;
const starFrag = `uniform vec3 uCore; uniform vec3 uRim; uniform float uTime; varying vec3 vN; varying vec3 vV;
  float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
  void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.0);
    float flow = 0.5 + 0.5*sin(uTime*0.9 + vN.y*7.0 + sin(vN.x*5.0 + uTime*0.6)*2.0);
    vec3 c = mix(uCore, uRim, f) * (1.05 + 0.35*flow) + (h(vN*80.0 + floor(uTime*6.0)) - 0.5)*0.03;
    gl_FragColor = vec4(c, 1.0); }`;

function PrayerStar({ lit, rings, pulse }: { lit: boolean; rings: number; pulse: number }) {
  const group = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: starVert, fragmentShader: starFrag,
    uniforms: { uCore: { value: C.gold.clone().multiplyScalar(1.6) }, uRim: { value: C.amber.clone().multiplyScalar(1.2) }, uTime: { value: 0 } },
  }), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    mat.uniforms.uTime.value = t;
    const breath = 1 + (lit ? 0.07 : 0.03) * Math.sin((t * 2 * Math.PI) / 5.5);
    group.current?.scale.setScalar(breath * (lit ? 1 : 0.55));
  });
  return (
    <group ref={group}>
      <mesh material={mat}><sphereGeometry args={[1.25, 64, 64]} /></mesh>
      <Halo color={C.gold} scale={9} opacity={lit ? 0.7 : 0.3} />
      <Halo color={C.amber} scale={26} opacity={(lit ? 0.22 : 0.08) + pulse * 0.15} />
      <Halo color={C.rose} scale={48} opacity={0.05 + pulse * 0.05} />
      {Array.from({ length: rings }, (_, i) => (
        <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.9 + i * 0.28, 1.93 + i * 0.28, 128]} />
          <meshBasicMaterial color={C.amber} transparent opacity={0.45} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ----------------------------------------------------- sacred geometry field --
type GlyphSpec = { kind: keyof typeof PLANAR | "merkaba" | "icosa" | "dodeca" | "octa"; pos: [number, number, number]; scale: number; color: THREE.Color; opacity: number; spin: number; tilt: [number, number, number] };

const FIELD: GlyphSpec[] = [
  // the mandala of the Self behind the prayer-star
  { kind: "flowerOfLife", pos: [0, 1.5, -6], scale: 9, color: C.amber, opacity: 0.22, spin: 0.01, tilt: [0, 0, 0] },
  { kind: "metatronsCube", pos: [0, 1.5, -6.2], scale: 9.6, color: C.glyph, opacity: 0.12, spin: -0.006, tilt: [0, 0, 0] },
  { kind: "merkaba", pos: [0, 1.5, 0], scale: 3.4, color: C.gold, opacity: 0.35, spin: 0.08, tilt: [0.2, 0, 0] },
  // the great yantra in the sky
  { kind: "sriYantra", pos: [-70, 46, -110], scale: 26, color: C.gold, opacity: 0.2, spin: 0.002, tilt: [0.1, 0.5, 0] },
  { kind: "torusField", pos: [84, 38, -96], scale: 16, color: C.glyph, opacity: 0.16, spin: -0.004, tilt: [0.3, -0.6, 0] },
  { kind: "vesica", pos: [-96, 22, 20], scale: 14, color: C.rose, opacity: 0.18, spin: 0.003, tilt: [0, 1.2, 0] },
  { kind: "hexagram", pos: [96, 18, 34], scale: 11, color: C.glyph, opacity: 0.18, spin: -0.005, tilt: [0, -1.1, 0] },
  { kind: "seedOfLife", pos: [30, 58, -60], scale: 10, color: C.star, opacity: 0.14, spin: 0.004, tilt: [0.9, 0, 0] },
  { kind: "icosa", pos: [-46, 30, -40], scale: 4, color: C.glyph, opacity: 0.3, spin: 0.04, tilt: [0, 0, 0] },
  { kind: "dodeca", pos: [52, 26, -30], scale: 4.2, color: C.gold, opacity: 0.26, spin: -0.03, tilt: [0, 0, 0] },
  { kind: "octa", pos: [-24, 48, 40], scale: 3, color: C.rose, opacity: 0.3, spin: 0.05, tilt: [0, 0, 0] },
];

function SacredField() {
  const items = useMemo(() => FIELD.map((f) => {
    const geo = f.kind in PLANAR ? toGeometry(PLANAR[f.kind as keyof typeof PLANAR]()) : solidEdges(f.kind as "merkaba");
    const mat = new THREE.LineBasicMaterial({ color: f.color, transparent: true, opacity: f.opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const obj = new THREE.LineSegments(geo, mat);
    obj.position.set(...f.pos);
    obj.scale.setScalar(f.scale);
    obj.rotation.set(...f.tilt);
    return { obj, f };
  }), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    for (const { obj, f } of items) {
      if (f.kind in PLANAR) obj.rotation.z = f.tilt[2] + t * f.spin;
      else { obj.rotation.y = t * f.spin; obj.rotation.x = f.tilt[0] + t * f.spin * 0.6; }
      (obj.material as THREE.LineBasicMaterial).opacity = f.opacity * (0.75 + 0.25 * Math.sin(t * 0.3 + f.pos[0]));
    }
  });
  return <>{items.map(({ obj }, i) => <primitive key={i} object={obj} />)}</>;
}

const SKY_GLYPHS: { t: string; pos: [number, number, number]; color: string }[] = [
  { t: "☉", pos: [-30, 40, -80], color: "#ffd27a" }, { t: "☽", pos: [40, 50, -70], color: "#e8f0ff" },
  { t: "☿", pos: [-80, 30, -20], color: "#7fd3e6" }, { t: "♀", pos: [70, 34, 10], color: "#e58fb0" },
  { t: "△", pos: [-50, 60, 10], color: "#ffc878" }, { t: "▽", pos: [20, 64, 30], color: "#7fd3e6" },
  { t: "⊕", pos: [80, 52, -40], color: "#9be8b0" }, { t: "✶", pos: [-10, 70, -30], color: "#ffffff" },
  { t: "∞", pos: [-90, 44, 50], color: "#9684ec" }, { t: "☯", pos: [60, 40, 70], color: "#e8f0ff" },
];

function SkyGlyphs() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.004; });
  return (
    <group ref={ref}>
      {SKY_GLYPHS.map((g) => <Glyph key={g.t} text={g.t} position={g.pos} color={g.color} scale={6} opacity={0.55} />)}
    </group>
  );
}

// ---------------------------------------------------------- natal ecliptic --
const SIGNS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const PLANETS: Record<string, string> = { Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇", North_Node: "☊", South_Node: "☋" };

function NatalSky({ natal }: { natal: { body: string; lon: number }[] }) {
  const R = 34;
  const ring = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 256; i++) { const a = (i / 256) * Math.PI * 2; pts.push(new THREE.Vector3(R * Math.cos(a), 0, R * Math.sin(a))); }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  const at = (lon: number, r = R): [number, number, number] => { const a = THREE.MathUtils.degToRad(lon); return [r * Math.cos(a), 0, -r * Math.sin(a)]; };
  return (
    <group rotation={[OBLIQUITY, 0, 0]} position={[0, 8, 0]}>
      <lineLoop geometry={ring}><lineBasicMaterial color={C.glyph} transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} /></lineLoop>
      {SIGNS.map((g, i) => <Glyph key={g} text={g} position={at(i * 30 + 15, R + 3.6)} color="#7fd3e6" scale={2.6} opacity={0.75} />)}
      {natal.map((b) => {
        const p = at(b.lon);
        return (
          <group key={b.body}>
            <Halo color={b.body === "Sun" ? C.gold : C.star} scale={b.body === "Sun" || b.body === "Moon" ? 4 : 2.6} opacity={0.85} position={p} />
            <Glyph text={PLANETS[b.body] || "•"} position={[p[0], 2, p[2]]} color={b.body === "Sun" ? "#ffd27a" : "#e8f0ff"} scale={2.4} />
          </group>
        );
      })}
    </group>
  );
}

// -------------------------------------------------------------- the moon --
function Moon({ now }: { now: Date }) {
  const phase = moonPhase(now);
  const mat = useMemo(() => {
    const a = phase * Math.PI * 2; // light direction rotates with the phase
    return new THREE.ShaderMaterial({
      uniforms: { uL: { value: new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)) } },
      vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normal); vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uL; varying vec3 vN; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9,78.2,37.7)))*43758.5); }
        void main(){ float lit = smoothstep(-0.05, 0.15, dot(vN, uL)); float mare = 0.85 + 0.15*h(floor(vP*3.0));
          vec3 c = vec3(0.92,0.94,1.0)*mare*lit + vec3(0.02,0.03,0.05); gl_FragColor = vec4(c, 1.0); }`,
    });
  }, [phase]);
  return (
    <group position={[-60, 28, -70]}>
      <mesh material={mat} rotation={[0, 0.9, 0]}><sphereGeometry args={[3.2, 48, 48]} /></mesh>
      <Halo color={C.star} scale={22} opacity={0.18 + 0.5 * (1 - Math.abs(Math.cos(phase * Math.PI * 2))) / 2} />
    </group>
  );
}

// ------------------------------------------------- the constellation (altar) --
type Hover = { label: string; sub: string } | null;

function Hoverable({ children, label, sub, id, onHover }: { children: React.ReactNode; label: string; sub: string; id: number | null; onHover: (h: Hover, id: number | null) => void }) {
  return (
    <group
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover({ label, sub }, id); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { onHover(null, null); document.body.style.cursor = ""; }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("eco:dream-select", { detail: { id, label } })); }}
    >
      {children}
    </group>
  );
}

function Orbiter({ i, n, title, id, charge, touches, fidelity, onHover }: { i: number; n: number; title: string; id: number; charge: number; touches: number; fidelity: number | null; onHover: (h: Hover, id: number | null) => void }) {
  const ref = useRef<THREE.Group>(null);
  const radius = 15 - ((fidelity ?? 3) - 1) * 1.5;
  const tilt = (seeded(id) - 0.5) * 0.6;
  const speed = 0.04 + seeded(id * 5) * 0.04;
  const color = chargeColor(charge);
  const size = 0.35 + Math.min(0.55, touches * 0.08);
  const orbit = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 160; k++) { const a = (k / 160) * Math.PI * 2; pts.push(new THREE.Vector3(radius * Math.cos(a), 0, radius * Math.sin(a))); }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius]);
  useFrame(({ clock }) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + clock.getElapsedTime() * speed;
    ref.current?.position.set(radius * Math.cos(a), 0, radius * Math.sin(a));
  });
  return (
    <group rotation={[tilt, 0, tilt * 0.4]} position={[0, 1.5, 0]}>
      <lineLoop geometry={orbit}><lineBasicMaterial color={color} transparent opacity={0.14 + Math.min(0.25, touches * 0.04)} blending={THREE.AdditiveBlending} depthWrite={false} /></lineLoop>
      <group ref={ref}>
        <Hoverable label={title} sub={`work · ${touches} touches · charge ${charge >= 0 ? "+" : ""}${charge.toFixed(1)}`} id={id} onHover={onHover}>
          <mesh><sphereGeometry args={[size, 24, 24]} /><meshBasicMaterial color={color} /></mesh>
          <Halo color={color} scale={size * 9} opacity={0.4 + Math.min(0.4, touches * 0.08)} />
        </Hoverable>
      </group>
    </group>
  );
}

function Constellation({ snap, onHover }: { snap: Snapshot; onHover: (h: Hover, id: number | null) => void }) {
  const v = useMemo(() => vitals(snap.elements, snap.strands, snap.alignment, Date.parse(snap.now)), [snap]);
  const live = snap.elements.filter((e) => !e.retired);
  const works = live.filter((e) => e.kind === "work");
  const devotions = live.filter((e) => e.kind === "devotion");
  const practices = live.filter((e) => e.kind === "practice");
  const giftPos = snap.gifts.map((_, i) => {
    const a = (i / Math.max(1, snap.gifts.length)) * Math.PI * 2 - 0.3;
    return new THREE.Vector3(6.5 * Math.cos(a), 6 + seeded(i + 11) * 2, 6.5 * Math.sin(a));
  });
  const giftLine = useMemo(() => (giftPos.length > 1 ? new THREE.BufferGeometry().setFromPoints([...giftPos, giftPos[0]]) : null), [snap]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      {giftLine && <Line3 geometry={giftLine} color={C.gold} opacity={0.5} />}
      {snap.gifts.map((g, i) => (
        <Hoverable key={g.id} label={g.name} sub="gift · from your reading" id={null} onHover={onHover}>
          <Halo color={C.gold} scale={3.4 + g.prominence * 2} opacity={0.95} position={giftPos[i].toArray() as [number, number, number]} />
        </Hoverable>
      ))}
      {devotions.map((d, i) => {
        const a = (i / Math.max(1, devotions.length)) * Math.PI * 2 + 0.4;
        const pos = new THREE.Vector3(26 * Math.cos(a), 12 + seeded(d.lineage_id) * 7, 26 * Math.sin(a));
        const beam = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.5, 0), pos]);
        const vt = v.get(d.lineage_id)!;
        return (
          <group key={d.lineage_id}>
            <Line3 geometry={beam} color={C.kin} opacity={0.12 + Math.min(0.3, vt.recentTouches * 0.06)} />
            <Hoverable label={d.title} sub={`devotion · ${vt.touches} strands`} id={d.lineage_id} onHover={onHover}>
              <Halo color={C.kin} scale={5} opacity={0.8} position={pos.toArray() as [number, number, number]} />
              <mesh position={pos}><octahedronGeometry args={[0.6, 0]} /><meshBasicMaterial color={C.kin} wireframe /></mesh>
            </Hoverable>
          </group>
        );
      })}
      {practices.map((d, i) => {
        const a = (i / Math.max(1, practices.length)) * Math.PI * 2 + 1.1;
        const pos = new THREE.Vector3(7.5 * Math.cos(a), -2.4, 7.5 * Math.sin(a));
        const vt = v.get(d.lineage_id)!;
        return (
          <Hoverable key={d.lineage_id} label={d.title} sub={`practice · ${vt.recentTouches} touches`} id={d.lineage_id} onHover={onHover}>
            <Halo color={chargeColor(vt.charge)} scale={3} opacity={0.7} position={pos.toArray() as [number, number, number]} />
            <mesh position={pos} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.5, 0.05, 8, 48]} /><meshBasicMaterial color={chargeColor(vt.charge)} /></mesh>
          </Hoverable>
        );
      })}
      {works.map((w, i) => {
        const vt = v.get(w.lineage_id)!;
        return <Orbiter key={w.lineage_id} i={i} n={works.length} title={w.title} id={w.lineage_id} charge={vt.charge} touches={vt.recentTouches} fidelity={vt.fidelity} onHover={onHover} />;
      })}
      {snap.kin.map((k, i) => {
        const a = (i / Math.max(1, snap.kin.length)) * Math.PI * 2 + 0.9;
        const pos = new THREE.Vector3(48 * Math.cos(a), 10 + seeded(i + 99) * 10, 48 * Math.sin(a));
        const thread = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.5, 0), pos]);
        return (
          <group key={k.id}>
            <Line3 geometry={thread} color={C.kin} opacity={0.2} />
            <Hoverable label={`${k.name}${k.gifts.length ? ` — ${k.gifts.join(", ")}` : ""}`} sub="kin · your Dharma Constellation" id={null} onHover={onHover}>
              <Halo color={C.kin} scale={8} opacity={0.85} position={pos.toArray() as [number, number, number]} />
              <mesh position={pos}><sphereGeometry args={[0.6, 16, 16]} /><meshBasicMaterial color={C.kin} /></mesh>
            </Hoverable>
          </group>
        );
      })}
    </group>
  );
}

// ------------------------------------------------------------ the dark lake --
const MAX_RIPPLES = 10;

function Lake({ snap, quality }: { snap: Snapshot | null; quality: "high" | "low" }) {
  const { size } = useThree();
  const reflector = useMemo(() => {
    const res = quality === "high" ? 1 : 0.5;
    const r = new Reflector(new THREE.PlaneGeometry(600, 600), {
      textureWidth: Math.max(256, Math.floor(window.innerWidth * res)),
      textureHeight: Math.max(256, Math.floor(window.innerHeight * res)),
      color: 0x0a1218,
      shader: {
        name: "DreamLake",
        uniforms: {
          color: { value: null },
          tDiffuse: { value: null },
          textureMatrix: { value: null },
          uTime: { value: 0 },
          uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0)) },
        },
        vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
          void main(){ vUv = textureMatrix*vec4(position,1.0); vW = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float uTime; uniform vec4 uRipples[${MAX_RIPPLES}];
          varying vec4 vUv; varying vec3 vW;
          void main(){
            vec2 p = vW.xz;
            // slow swell
            float sw = sin(p.x*0.18 + uTime*0.35)*0.5 + sin(p.y*0.23 - uTime*0.27)*0.5 + sin((p.x+p.y)*0.41 + uTime*0.5)*0.25;
            vec2 d = vec2(cos(p.y*0.2 + uTime*0.3), sin(p.x*0.21 - uTime*0.25)) * 0.012 * (0.6 + 0.4*sw);
            // ripples — reflections dropping into the water
            float ringGlow = 0.0;
            for (int i=0;i<${MAX_RIPPLES};i++){
              vec4 r = uRipples[i];
              float age = uTime - r.z;
              if (age < 0.0 || age > 9.0) continue;
              float dist = distance(p, r.xy);
              float front = age * 3.2;
              float w = exp(-pow((dist - front)*1.1, 2.0)) * exp(-age*0.38) * r.w;
              d += normalize(p - r.xy + 0.0001) * w * 0.05;
              ringGlow += w;
            }
            vec4 uv = vUv; uv.xy += d * uv.w;
            vec3 refl = texture2DProj(tDiffuse, uv).rgb;
            float far = smoothstep(40.0, 260.0, length(vW.xz - cameraPosition.xz));
            float fres = pow(1.0 - clamp(abs(normalize(cameraPosition - vW).y), 0.0, 1.0), 3.0);
            vec3 base = vec3(0.004, 0.012, 0.02);
            vec3 col = mix(base, refl, 0.4 + 0.35*fres) * (1.0 - far*0.8) + vec3(1.0,0.78,0.45)*ringGlow*0.35;
            gl_FragColor = vec4(col, 0.94);
          }`,
      } as any,
    });
    r.rotation.x = -Math.PI / 2;
    r.position.y = LAKE_Y;
    (r.material as THREE.ShaderMaterial).transparent = true;
    return r;
  }, [quality]);
  useEffect(() => () => { reflector.getRenderTarget().dispose(); (reflector.material as THREE.Material).dispose(); }, [reflector]);
  useEffect(() => {
    const res = quality === "high" ? 1 : 0.5;
    reflector.getRenderTarget().setSize(Math.max(256, size.width * res), Math.max(256, size.height * res));
  }, [size, reflector, quality]);

  // Each reflection is a point of light on the water; the recent ones keep rippling.
  const points = useMemo(() => {
    if (!snap) return [];
    const ch = reflectionCharges(snap.strands);
    return snap.reflections.map((r, i) => {
      const a = i * 2.399963; // golden angle spiral, oldest at the centre
      const rad = 9 + Math.sqrt(i) * 3.4;
      return { id: r.id, x: rad * Math.cos(a), z: rad * Math.sin(a), charge: ch.get(r.id) ?? 0, depth: r.depth, at: Date.parse(r.at) };
    });
  }, [snap]);
  const extra = useRef<{ x: number; z: number; t: number; s: number }[]>([]);
  useEffect(() => onDream((ev) => {
    if (ev.type === "ripple") extra.current.push({ x: 0, z: 0, t: -1, s: ev.strength ?? 1.4 });
  }), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const m = reflector.material as THREE.ShaderMaterial;
    m.uniforms.uTime.value = t;
    const arr = m.uniforms.uRipples.value as THREE.Vector4[];
    const recent = points.slice(-6);
    let k = 0;
    // staggered, ever-recurring ripples from the most recent reflections
    recent.forEach((p, i) => {
      const period = 9;
      const start = Math.floor((t + i * 1.7) / period) * period - i * 1.7;
      arr[k++].set(p.x, p.z, start, 0.5 + 0.2 * p.depth);
    });
    for (const e of extra.current) { if (e.t < 0) e.t = t; }
    extra.current = extra.current.filter((e) => t - e.t < 9);
    for (const e of extra.current) if (k < MAX_RIPPLES) arr[k++].set(e.x, e.z, e.t, e.s);
    for (; k < MAX_RIPPLES; k++) arr[k].set(0, 0, -100, 0);
  });
  return (
    <>
      <primitive object={reflector} />
      {points.map((p) => (
        <Halo key={p.id} color={chargeColor(p.charge)} scale={1.2 + p.depth * 0.6} opacity={0.75} position={[p.x, LAKE_Y + 0.05, p.z]} />
      ))}
    </>
  );
}

// ------------------------------------------------------------- the depths --
function Depths({ snap }: { snap: Snapshot | null }) {
  const roots = (snap?.elements || []).filter((e) => e.kind === "root");
  const list = roots.length ? roots : Array.from({ length: 5 }, (_, i) => ({ lineage_id: -i - 1, status: "held", retired: false, title: "" }));
  const curves = useMemo(() => list.map((r, i) => {
    const n = list.length;
    const spread = n > 1 ? (i / (n - 1) - 0.5) * 2 : 0;
    const end = new THREE.Vector3(spread * 30, LAKE_Y - 18 - seeded(Math.abs(r.lineage_id)) * 10, (seeded(Math.abs(r.lineage_id) * 3) - 0.5) * 20);
    const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(0, LAKE_Y - 0.2, 0), new THREE.Vector3(spread * 6, LAKE_Y - 6, 0), new THREE.Vector3(end.x * 0.7, end.y + 6, end.z), end);
    const color = r.retired || r.status === "composting" ? new THREE.Color("#8a7a68") : r.status === "questioning" ? C.violet : r.status === "renewed" ? C.kin : C.amber;
    return { curve, color, geo: new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), ghost: r.lineage_id < 0 };
  }), [snap]); // eslint-disable-line react-hooks/exhaustive-deps
  const pulses = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    pulses.current?.children.forEach((c, i) => {
      const cv = curves[i % curves.length];
      const p = cv.curve.getPoint(((t * 0.08 + i * 0.37) % 1));
      c.position.copy(p);
    });
  });
  return (
    <group>
      {curves.map((c, i) => <Line3 key={i} geometry={c.geo} color={c.color} opacity={c.ghost ? 0.08 : 0.5} />)}
      <group ref={pulses}>
        {curves.map((c, i) => <Halo key={i} color={c.color} scale={c.ghost ? 1 : 1.8} opacity={c.ghost ? 0.2 : 0.8} />)}
      </group>
    </group>
  );
}

// ------------------------------------------------------- camera choreography --
function Rig({ place, interactive }: { place: Place; interactive: boolean }) {
  const { camera, gl } = useThree();
  const st = useRef({ dTheta: 0, dPhi: 0, zoom: 1, drag: false, x: 0, y: 0, idle: 10, look: new THREE.Vector3(0, 2, 0) });
  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    const down = (e: PointerEvent) => { st.current.drag = true; st.current.x = e.clientX; st.current.y = e.clientY; st.current.idle = 0; };
    const up = () => { st.current.drag = false; };
    const move = (e: PointerEvent) => {
      if (!st.current.drag) return;
      st.current.dTheta -= (e.clientX - st.current.x) * 0.004;
      st.current.dPhi = Math.max(-0.5, Math.min(0.7, st.current.dPhi - (e.clientY - st.current.y) * 0.003));
      st.current.x = e.clientX; st.current.y = e.clientY;
    };
    // Pinch (ctrl/⌘ + wheel) approaches; plain wheel stays page scroll.
    const wheel = (e: WheelEvent) => { if (!(e.ctrlKey || e.metaKey)) return; st.current.zoom = Math.max(0.45, Math.min(1.8, st.current.zoom * (1 + e.deltaY * 0.004))); st.current.idle = 0; };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointermove", move);
    el.addEventListener("wheel", wheel, { passive: true });
    return () => { el.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up); window.removeEventListener("pointermove", move); el.removeEventListener("wheel", wheel); };
  }, [gl, interactive]);
  useEffect(() => { st.current.dTheta = 0; st.current.dPhi = 0; st.current.zoom = 1; }, [place]);
  useFrame(({ clock }, dt) => {
    const s = st.current;
    const pose = POSES[place];
    s.idle += dt;
    const target = new THREE.Vector3(...pose.target);
    const base = new THREE.Vector3(...pose.pos).sub(target);
    const sph = new THREE.Spherical().setFromVector3(base);
    sph.theta += s.dTheta + Math.sin(clock.getElapsedTime() * pose.drift * 3) * 0.08 + (s.idle > 4 ? clock.getElapsedTime() * pose.drift * 0.15 : 0);
    sph.phi = Math.min(Math.PI / 2 + 0.06, Math.max(0.15, sph.phi + s.dPhi));
    sph.radius *= s.zoom;
    const want = new THREE.Vector3().setFromSpherical(sph).add(target);
    want.y = Math.max(LAKE_Y + 0.8, want.y);
    camera.position.lerp(want, 1 - Math.pow(0.0015, dt));
    s.look.lerp(target, 1 - Math.pow(0.002, dt));
    camera.lookAt(s.look);
  });
  return null;
}

function Bloom({ strength }: { strength: number }) {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), strength, 0.55, 0.32));
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { composer.setSize(size.width, size.height); }, [composer, size]);
  useFrame((_, dt) => composer.render(dt), 1);
  return null;
}

function World({ data, place, interactive, quality, onHover }: { data: DreamData; place: Place; interactive: boolean; quality: "high" | "low"; onHover: (h: Hover, id: number | null) => void }) {
  const snap = data.snap;
  const natal = snap?.natal?.length ? snap.natal : data.natal || [];
  const pulse = snap ? Math.min(1, snap.reflections.filter((r) => Date.parse(snap.now) - Date.parse(r.at) < 30 * 86_400_000).length / 6) : 0;
  const lit = !!snap?.elements.some((e) => e.kind === "prayer" && !e.retired);
  return (
    <>
      <color attach="background" args={[C.abyss]} />
      <fogExp2 attach="fog" args={[C.abyss, 0.0042]} />
      <Rig place={place} interactive={interactive} />
      <Nebula />
      <Stars count={quality === "high" ? 4200 : 1800} />
      <Motes count={quality === "high" ? 500 : 180} />
      <SacredField />
      <SkyGlyphs />
      <Moon now={new Date(snap?.now || Date.now())} />
      {natal.length > 0 && <NatalSky natal={natal} />}
      <group position={[0, 1.5, 0]}><PrayerStar lit={lit} rings={snap?.rings.length || 0} pulse={pulse} /></group>
      {snap && <Constellation snap={snap} onHover={onHover} />}
      <Lake snap={snap} quality={quality} />
      <Depths snap={snap} />
      <Bloom strength={quality === "high" ? 0.72 : 0.55} />
    </>
  );
}

export default function Dreamscape({ data, place, interactive }: { data: DreamData; place: Place; interactive: boolean }) {
  const [hover, setHover] = useState<Hover>(null);
  const quality: "high" | "low" = typeof window !== "undefined" && (window.innerWidth < 760 || (navigator as any).deviceMemory < 4) ? "low" : "high";
  return (
    <div className="dreamscape" data-testid="dreamscape" data-place={place}>
      <Canvas
        dpr={quality === "high" ? [1, 1.75] : [1, 1.25]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 52, near: 0.1, far: 900, position: [0, 10, 120] }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 0.92; }}
        style={{ pointerEvents: interactive ? "auto" : "none" }}
      >
        <World data={data} place={place} interactive={interactive} quality={quality} onHover={(h) => setHover(h)} />
      </Canvas>
      {hover && interactive && (
        <div className="dream-tooltip">
          <div className="telemetry text-accent">{hover.sub}</div>
          <div className="font-display text-lg text-fg">{hover.label}</div>
        </div>
      )}
    </div>
  );
}
