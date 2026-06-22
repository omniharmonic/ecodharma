"use client";
import { useEffect, useRef } from "react";

// An ACCURATE slowly-rotating Whole Earth in monospace ASCII — orthographic
// ray-sampling of a sphere against a REAL equirectangular land/ocean mask, shaded
// by a ramp with the sunlit limb in solar amber. Computed, not video.
// Mode-aware via CSS vars; reduced-motion safe; pauses offscreen / when tab hidden.

const RAMP = " .,:;ox%#@"; // dark -> bright
const DEG = Math.PI / 180;

// ── REAL WORLD LANDMASK ──────────────────────────────────────────────────────
// Equirectangular boolean grid, 72 cols × 36 rows (5° per cell), run-length
// encoded as inclusive [startCol,endCol] land spans per row ([] = all ocean).
//   col → lon = -180 + col*5 + 2.5   (col0 ≈ -177.5°, col36 ≈ 2.5°, col71 ≈ 177.5°)
//   row → lat =  90  - row*5 - 2.5   (row0 ≈  +87.5°, row18 ≈ -2.5°, row35 ≈ -87.5°)
// Hand-traced from real coastlines: recognizable N&S America, Greenland, Europe,
// Africa, Asia, India, SE-Asia islands, Australia, New Zealand, full Antarctica.
export const LANDMASK_RUNS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  /* 0  87.5N */ [],
  /* 1  82.5N */ [[16, 22], [27, 32]],
  /* 2  77.5N */ [[12, 32], [38, 41], [46, 48], [54, 58]],
  /* 3  72.5N */ [[4, 23], [25, 31], [39, 42], [47, 71]],
  /* 4  67.5N */ [[3, 23], [25, 33], [37, 71]],
  /* 5  62.5N */ [[3, 24], [26, 27], [31, 33], [37, 71]],
  /* 6  57.5N */ [[4, 16], [21, 25], [34, 71]],
  /* 7  52.5N */ [[3, 16], [21, 24], [34, 71]],
  /* 8  47.5N */ [[11, 25], [35, 71]],
  /* 9  42.5N */ [[11, 22], [34, 66]],
  /* 10 37.5N */ [[11, 20], [34, 64]],
  /* 11 32.5N */ [[12, 20], [34, 62]],
  /* 12 27.5N */ [[13, 19], [33, 60]],
  /* 13 22.5N */ [[14, 16], [32, 47], [49, 60]],
  /* 14 17.5N */ [[16, 18], [32, 46], [50, 53], [55, 58]],
  /* 15 12.5N */ [[18, 19], [32, 44], [51, 52], [55, 58], [60, 61]],
  /* 16  7.5N */ [[19, 24], [33, 45], [55, 61]],
  /* 17  2.5N */ [[20, 26], [37, 44], [55, 60]],
  /* 18  2.5S */ [[20, 26], [37, 44], [56, 66]],
  /* 19  7.5S */ [[20, 28], [38, 44], [57, 66]],
  /* 20 12.5S */ [[21, 29], [38, 44], [59, 65]],
  /* 21 17.5S */ [[21, 28], [38, 46], [58, 65]],
  /* 22 22.5S */ [[22, 28], [38, 46], [58, 66]],
  /* 23 27.5S */ [[21, 26], [39, 42], [44, 45], [58, 66]],
  /* 24 32.5S */ [[21, 25], [39, 42], [59, 66]],
  /* 25 37.5S */ [[21, 24], [39, 41], [59, 66]],
  /* 26 42.5S */ [[21, 23], [64, 65], [69, 70]],
  /* 27 47.5S */ [[21, 22], [69, 70]],
  /* 28 52.5S */ [[21, 22]],
  /* 29 57.5S */ [[22, 22]],
  /* 30 62.5S */ [[0, 6], [20, 27], [42, 71]],
  /* 31 67.5S */ [[0, 71]],
  /* 32 72.5S */ [[0, 71]],
  /* 33 77.5S */ [[0, 71]],
  /* 34 82.5S */ [[0, 71]],
  /* 35 87.5S */ [[0, 71]],
];

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// latDeg / lonDeg → land?  Normalizes lon to [-180,180), indexes the run table.
export function isLand(latDeg: number, lonDeg: number): boolean {
  const lon = ((lonDeg + 180) % 360 + 360) % 360 - 180;
  const col = clamp(Math.floor((lon + 180) / 5), 0, 71);
  const row = clamp(Math.floor((90 - latDeg) / 5), 0, 35);
  const runs = LANDMASK_RUNS[row];
  for (let k = 0; k < runs.length; k++) {
    if (col >= runs[k][0] && col <= runs[k][1]) return true;
  }
  return false;
}

type Tier = 0 | 1 | 2 | 3; // 0 space, 1 sea, 2 land, 3 sunlit limb

function computeFrame(angle: number, cols: number, rows: number): string {
  // Light from upper-right; the sunlit limb gets the solar tier.
  const lx = 0.82, ly = 0.32, lz = 0.48;
  let html = "";
  for (let j = 0; j < rows; j++) {
    const y = (j / (rows - 1)) * 2 - 1;
    let runTier = -1;
    let run = "";
    const flush = () => {
      if (run === "") return;
      if (runTier === 0) html += run;
      else html += `<span class="e${runTier}">${run}</span>`;
      run = "";
    };
    for (let i = 0; i < cols; i++) {
      const x = (i / (cols - 1)) * 2 - 1;
      const r2 = x * x + y * y;
      let ch = " ";
      let tier: Tier = 0;
      if (r2 <= 1) {
        const z = Math.sqrt(1 - r2);
        const ill = x * lx + y * ly + z * lz; // -1..1
        const lat = Math.asin(clamp(-y, -1, 1)) / DEG; // -y → north is up
        const lon = (Math.atan2(x, z) + angle) / DEG;
        const land = isLand(lat, lon);
        if (ill > 0 && ill < 0.06) {
          // terminator shimmer
          ch = "·";
          tier = 1;
        } else {
          let b = 0.16 + 0.84 * Math.max(0, ill);
          if (!land) b *= 0.52;
          const idx = clamp(Math.round(b * (RAMP.length - 1)), 0, RAMP.length - 1);
          ch = RAMP[idx] === " " ? "·" : RAMP[idx];
          tier = ill > 0.74 ? 3 : land ? 2 : 1;
        }
      }
      if (tier !== runTier) {
        flush();
        runTier = tier;
      }
      run += ch;
    }
    flush();
    html += "\n";
  }
  return html;
}

export function AsciiGlobe({
  cols = 56,
  rows = 30,
  className = "",
  speed = 0.18,
  fit = false,
}: {
  cols?: number;
  rows?: number;
  className?: string;
  speed?: number;
  /** when true, size the grid to the element's width (responsive, never overflows). */
  fit?: boolean;
}) {
  const ref = useRef<HTMLPreElement>(null);
  const dims = useRef<{ cols: number; rows: number }>({ cols, rows });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // measure the available width → character grid (monospace advance ≈ 0.6em)
    const recomputeDims = () => {
      if (!fit) {
        dims.current = { cols, rows };
        return;
      }
      const fontPx = parseFloat(getComputedStyle(el).fontSize) || 10;
      const w = el.clientWidth || el.parentElement?.clientWidth || 320;
      const c = Math.max(28, Math.min(110, Math.floor(w / (fontPx * 0.6))));
      dims.current = { cols: c, rows: Math.round(c * 0.55) };
    };
    recomputeDims();
    const drawStatic = () => (el.innerHTML = computeFrame(0.6, dims.current.cols, dims.current.rows));

    // re-fit on container resize (both motion + reduced-motion paths)
    const ro = new ResizeObserver(() => {
      recomputeDims();
      if (reduce) drawStatic();
    });
    ro.observe(el);

    if (reduce) {
      drawStatic();
      return () => ro.disconnect();
    }

    let angle = 0;
    let last = 0;
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.01 });
    io.observe(el);

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      if (t - last < 55) return; // ~18fps — computed, not frantic
      angle += speed * ((t - last) / 1000) * 6;
      last = t;
      el.innerHTML = computeFrame(angle, dims.current.cols, dims.current.rows);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, [cols, rows, speed, fit]);

  return (
    <pre
      ref={ref}
      aria-hidden
      className={`block max-w-full overflow-hidden select-none font-mono leading-[0.95] text-[0.62rem] sm:text-[0.7rem] [&_.e1]:text-live/45 [&_.e2]:text-live [&_.e3]:text-accent ${className}`}
    >
      {/* drawn on mount */}
    </pre>
  );
}

export default AsciiGlobe;
