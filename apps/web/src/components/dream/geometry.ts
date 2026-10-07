// Sacred geometry as luminous line geometry for the dreamscape. Each generator
// returns flat [x,y,z, x,y,z, …] segment pairs (for THREE.LineSegments) in the
// XY plane (or 3D for solids), unit-scaled; place/scale/rotate in the scene.
import * as THREE from "three";

type Seg = number[];

function circle(out: Seg, cx: number, cy: number, r: number, n = 64, z = 0) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    out.push(cx + r * Math.cos(a0), cy + r * Math.sin(a0), z, cx + r * Math.cos(a1), cy + r * Math.sin(a1), z);
  }
}
function line(out: Seg, x0: number, y0: number, x1: number, y1: number, z = 0) {
  out.push(x0, y0, z, x1, y1, z);
}
function poly(out: Seg, pts: [number, number][], closed = true) {
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    line(out, a[0], a[1], b[0], b[1]);
  }
}

/** Flower of Life: 19 circles in hexagonal packing + bounding circle. */
export function flowerOfLife(): Seg {
  const out: Seg = [];
  const r = 1 / 3;
  const centers: [number, number][] = [[0, 0]];
  for (let ring = 1; ring <= 2; ring++) {
    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < ring; step++) {
        const a0 = (Math.PI / 3) * side + Math.PI / 6;
        const a1 = (Math.PI / 3) * (side + 1) + Math.PI / 6;
        centers.push([
          ring * r * Math.cos(a0) + step * r * (Math.cos(a1) - Math.cos(a0)),
          ring * r * Math.sin(a0) + step * r * (Math.sin(a1) - Math.sin(a0)),
        ]);
      }
    }
  }
  for (const [x, y] of centers) circle(out, x, y, r, 48);
  circle(out, 0, 0, 1, 96);
  circle(out, 0, 0, 1.04, 96);
  return out;
}

/** Seed of Life: 7 circles. */
export function seedOfLife(): Seg {
  const out: Seg = [];
  const r = 0.5;
  circle(out, 0, 0, r);
  for (let i = 0; i < 6; i++) circle(out, r * Math.cos((i * Math.PI) / 3), r * Math.sin((i * Math.PI) / 3), r);
  circle(out, 0, 0, 1, 96);
  return out;
}

/** Metatron's Cube: 13 circles joined every-to-every. */
export function metatronsCube(): Seg {
  const out: Seg = [];
  const nodes: [number, number][] = [[0, 0]];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 2;
    nodes.push([0.42 * Math.cos(a), 0.42 * Math.sin(a)]);
    nodes.push([0.84 * Math.cos(a), 0.84 * Math.sin(a)]);
  }
  for (const [x, y] of nodes) circle(out, x, y, 0.14, 32);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) line(out, nodes[i][0], nodes[i][1], nodes[j][0], nodes[j][1]);
  return out;
}

/** Sri Yantra (stylised): 4 upward + 5 downward interlocking triangles, lotus rings, bhupura gate. */
export function sriYantra(): Seg {
  const out: Seg = [];
  const tri = (apexUp: boolean, base: number, height: number, cy: number) => {
    const s = apexUp ? 1 : -1;
    poly(out, [[-base, cy - (s * height) / 2], [base, cy - (s * height) / 2], [0, cy + (s * height) / 2]]);
  };
  // downward (Shakti) and upward (Shiva) triangles of varying scale
  tri(false, 0.62, 0.95, 0.06); tri(false, 0.52, 0.74, 0.14); tri(false, 0.4, 0.56, 0.02); tri(false, 0.28, 0.4, -0.06); tri(false, 0.16, 0.2, -0.02);
  tri(true, 0.6, 0.92, -0.08); tri(true, 0.46, 0.66, -0.14); tri(true, 0.32, 0.46, 0.02); tri(true, 0.2, 0.28, 0.06);
  circle(out, 0, 0, 0.72, 96);
  circle(out, 0, 0, 0.8, 96);
  // 8 and 16 petal lotus as arcs
  for (const [n, r0, r1] of [[8, 0.72, 0.86], [16, 0.86, 0.98]] as const) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const p0: [number, number] = [r0 * Math.cos(a0), r0 * Math.sin(a0)];
      const tip: [number, number] = [r1 * Math.cos(am), r1 * Math.sin(am)];
      const p1: [number, number] = [r0 * Math.cos(a1), r0 * Math.sin(a1)];
      line(out, p0[0], p0[1], tip[0], tip[1]);
      line(out, tip[0], tip[1], p1[0], p1[1]);
    }
  }
  // bhupura (square with four gates)
  const s = 1.08;
  const g = 0.16;
  for (const [ax, ay] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
    const px = -ay;
    const py = ax;
    line(out, ax * s + px * s, ay * s + py * s, ax * s + px * g, ay * s + py * g);
    line(out, ax * s - px * g, ay * s - py * g, ax * s - px * s, ay * s - py * s);
    line(out, ax * s + px * g, ay * s + py * g, (ax * s + px * g) + ax * 0.08, (ay * s + py * g) + ay * 0.08);
    line(out, ax * s - px * g, ay * s - py * g, (ax * s - px * g) + ax * 0.08, (ay * s - py * g) + ay * 0.08);
  }
  return out;
}

/** Vesica piscis with its mandorla axis. */
export function vesica(): Seg {
  const out: Seg = [];
  circle(out, -0.25, 0, 0.5, 64);
  circle(out, 0.25, 0, 0.5, 64);
  line(out, 0, -0.433, 0, 0.433);
  line(out, -0.75, 0, 0.75, 0);
  return out;
}

/** Hexagram in a circle. */
export function hexagram(): Seg {
  const out: Seg = [];
  const pts = (rot: number) => Array.from({ length: 3 }, (_, i) => [Math.cos(rot + (i * 2 * Math.PI) / 3), Math.sin(rot + (i * 2 * Math.PI) / 3)] as [number, number]);
  poly(out, pts(Math.PI / 2));
  poly(out, pts(-Math.PI / 2));
  circle(out, 0, 0, 1, 96);
  return out;
}

/** Torus of nested circles (the self-referencing field). */
export function torusField(): Seg {
  const out: Seg = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    circle(out, 0.5 * Math.cos(a), 0.5 * Math.sin(a), 0.5, 48);
  }
  return out;
}

/** 3D solids as edge geometry. */
export function solidEdges(kind: "merkaba" | "icosa" | "dodeca" | "octa" | "cube"): THREE.BufferGeometry {
  if (kind === "merkaba") {
    const t1 = new THREE.EdgesGeometry(new THREE.TetrahedronGeometry(1));
    const t2 = new THREE.EdgesGeometry(new THREE.TetrahedronGeometry(1));
    t2.rotateX(Math.PI);
    t2.rotateY(Math.PI / 2);
    const a = t1.getAttribute("position").array as Float32Array;
    const b = t2.getAttribute("position").array as Float32Array;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b], 3));
    return g;
  }
  const geo = kind === "icosa" ? new THREE.IcosahedronGeometry(1) : kind === "dodeca" ? new THREE.DodecahedronGeometry(1) : kind === "octa" ? new THREE.OctahedronGeometry(1) : new THREE.BoxGeometry(1.4, 1.4, 1.4);
  return new THREE.EdgesGeometry(geo);
}

export function toGeometry(seg: Seg): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  return g;
}

export const PLANAR = { flowerOfLife, seedOfLife, metatronsCube, sriYantra, vesica, hexagram, torusField };
