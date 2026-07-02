// Render the share card at many text lengths and write PNGs for visual review.
// Run from apps/web:  npx tsx scripts/og-fit-test.mts
import { mkdirSync, writeFileSync } from "node:fs";
import { renderCard, fitTitle, SIZES, type SizeKey } from "../src/lib/og-card.tsx";

const OUT = "scripts/.og-out";
mkdirSync(OUT, { recursive: true });

const word = "purpose";
function make(len: number): string {
  if (len === 0) return "";
  // realistic-ish prose so word-wrapping behaves like real recognition text
  const base =
    "You are the one who holds the thread when others let go, tending what is unseen so the whole can move; your gift is to feel the field and name what it needs before it breaks. ";
  let s = "";
  while (s.length < len) s += base;
  return s.slice(0, len).trim();
}

const LENGTHS = [0, 40, 120, 200, 320, 500, 800, 1200];
const SIZE_KEYS = Object.keys(SIZES) as SizeKey[];
const archetypes = ["The Weaver", "Quiet Steward", "Pattern Seer"];

let worst = 100;
for (const size of SIZE_KEYS) {
  for (const len of LENGTHS) {
    const recognition = make(len);
    const fs = fitTitle(recognition || "A field manual for the work that is only yours.", archetypes, size);
    worst = Math.min(worst, fs);
    const img = renderCard({ size, recognition, archetypes });
    const buf = Buffer.from(await img.arrayBuffer());
    const name = `${size}-len${String(len).padStart(4, "0")}-fs${fs}.png`;
    writeFileSync(`${OUT}/${name}`, buf);
    console.log(`${size.padEnd(6)} len=${String(len).padStart(4)}  ->  fontSize=${fs}px  (${buf.length} bytes)  ${name}`);
  }
}
console.log(`\nAll ${SIZE_KEYS.length * LENGTHS.length} cards rendered. Smallest font chosen: ${worst}px.`);
console.log(`PNGs in apps/web/${OUT}/`);
