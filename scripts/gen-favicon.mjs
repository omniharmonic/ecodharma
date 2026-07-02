// Generate apps/web/public/icon.svg — a single, static frame of the AsciiGlobe
// (the app's rotating monospace Whole Earth) baked into an SVG favicon.
//
// Mirrors the orthographic sphere-sampling + land-mask + shading in
// apps/web/src/components/AsciiGlobe.tsx. If that land-mask ever changes, re-run:
//   node scripts/gen-favicon.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAMP = " .,:;ox%#@";
const DEG = Math.PI / 180;

// Equirectangular land-mask, 72×36 (5°/cell), run-length encoded — copied from
// AsciiGlobe.tsx (LANDMASK_RUNS). Plain data; kept in sync by hand.
const LANDMASK_RUNS = [
  [], [[16,22],[27,32]], [[12,32],[38,41],[46,48],[54,58]],
  [[4,23],[25,31],[39,42],[47,71]], [[3,23],[25,33],[37,71]],
  [[3,24],[26,27],[31,33],[37,71]], [[4,16],[21,25],[34,71]],
  [[3,16],[21,24],[34,71]], [[11,25],[35,71]], [[11,22],[34,66]],
  [[11,20],[34,64]], [[12,20],[34,62]], [[13,19],[33,60]],
  [[14,16],[32,47],[49,60]], [[16,18],[32,46],[50,53],[55,58]],
  [[18,19],[32,44],[51,52],[55,58],[60,61]], [[19,24],[33,45],[55,61]],
  [[20,26],[37,44],[55,60]], [[20,26],[37,44],[56,66]], [[20,28],[38,44],[57,66]],
  [[21,29],[38,44],[59,65]], [[21,28],[38,46],[58,65]], [[22,28],[38,46],[58,66]],
  [[21,26],[39,42],[44,45],[58,66]], [[21,25],[39,42],[59,66]], [[21,24],[39,41],[59,66]],
  [[21,23],[64,65],[69,70]], [[21,22],[69,70]], [[21,22]], [[22,22]],
  [[0,6],[20,27],[42,71]], [[0,71]], [[0,71]], [[0,71]], [[0,71]], [[0,71]],
];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
function isLand(latDeg, lonDeg) {
  const lon = ((lonDeg + 180) % 360 + 360) % 360 - 180;
  const col = clamp(Math.floor((lon + 180) / 5), 0, 71);
  const row = clamp(Math.floor((90 - latDeg) / 5), 0, 35);
  for (const [a, b] of LANDMASK_RUNS[row]) if (col >= a && col <= b) return true;
  return false;
}

// Sample the lit sphere on an N×N grid → { ch, tier } per cell (tier: 0 space,
// 1 sea, 2 land, 3 sunlit limb). Same math as AsciiGlobe.computeFrame.
function sample(N, angle) {
  const lx = 0.82, ly = 0.32, lz = 0.48;
  const grid = [];
  for (let j = 0; j < N; j++) {
    const y = (j / (N - 1)) * 2 - 1;
    const row = [];
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 2 - 1;
      const r2 = x * x + y * y;
      if (r2 > 1) { row.push({ ch: " ", tier: 0 }); continue; }
      const z = Math.sqrt(1 - r2);
      const ill = x * lx + y * ly + z * lz;
      const lat = Math.asin(clamp(-y, -1, 1)) / DEG;
      const lon = (Math.atan2(x, z) + angle) / DEG;
      const land = isLand(lat, lon);
      if (ill > 0 && ill < 0.06) { row.push({ ch: "·", tier: 1 }); continue; }
      let b = 0.16 + 0.84 * Math.max(0, ill);
      if (!land) b *= 0.52;
      const idx = clamp(Math.round(b * (RAMP.length - 1)), 0, RAMP.length - 1);
      const ch = RAMP[idx] === " " ? "·" : RAMP[idx];
      row.push({ ch, tier: ill > 0.74 ? 3 : land ? 2 : 1 });
    }
    grid.push(row);
  }
  return grid;
}

const N = 19;
const ANGLE = 2.5; // shows the Americas + Atlantic, sun on the eastern limb
const SIZE = 64, MARGIN = 5;
const inner = SIZE - MARGIN * 2;
const pitch = inner / N;
const fontSize = pitch * 1.28;
// tier → colour (space, sea, land, sunlit) — the app's ocean/live/solar palette.
const FILL = { 1: "#3f6b52", 2: "#5c8a6a", 3: "#e9c46a" };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const grid = sample(N, ANGLE);
const lines = [];
for (let j = 0; j < N; j++) {
  const yPos = (MARGIN + (j + 0.82) * pitch).toFixed(2);
  // group the row into runs of equal tier so each colour is one tspan
  let spans = "", run = "", runTier = -1;
  const flush = () => {
    if (!run) return;
    spans += runTier === 0
      ? esc(run)
      : `<tspan fill="${FILL[runTier]}">${esc(run)}</tspan>`;
    run = "";
  };
  for (const cell of grid[j]) {
    if (cell.tier !== runTier) { flush(); runTier = cell.tier; }
    run += cell.ch;
  }
  flush();
  lines.push(
    `<text x="${MARGIN}" y="${yPos}" textLength="${inner}" lengthAdjust="spacing" ` +
    `font-size="${fontSize.toFixed(2)}">${spans}</text>`,
  );
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="14" fill="#0e1311"/>
  <g font-family="ui-monospace, SFMono-Regular, Menlo, monospace" xml:space="preserve" style="white-space:pre">
    ${lines.join("\n    ")}
  </g>
</svg>
`;

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "apps", "web", "public", "icon.svg");
writeFileSync(out, svg);

// Print an ASCII preview so the land shapes are eyeball-checkable from the terminal.
console.log(grid.map((r) => r.map((c) => c.ch).join("")).join("\n"));
console.log(`\nwrote ${out}`);
