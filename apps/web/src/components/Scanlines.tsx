/**
 * Scanlines — CRT glass overlay (mount once, near the top of <body>).
 *
 * The heavy lifting (scanlines + vignette) already lives on `body::after`
 * in globals.css, which covers the whole viewport regardless of this
 * component. This element ADDS the optional opt-in treatments that should
 * not be global to avoid nausea:
 *   - `.crt-live`  : sub-perceptual phosphor flicker (7s, 1–3.5% jitter)
 *   - `.crt-grain` : slow-drifting fractal-noise film grain
 *
 * It is fixed, full-viewport, non-interactive (pointer-events:none), and
 * sits above content but below modals (z-index 2, matching body::after).
 * Pure CSS — no client JS needed, so this is a Server Component.
 *
 * Mount in layout.tsx inside <body> (e.g. first child of #app-root):
 *   <Scanlines />
 *
 * Reduced-motion users get a static veil: `.crt-live` / `.crt-grain::before`
 * animations are nulled by the global prefers-reduced-motion block.
 */
export function Scanlines() {
  return (
    <div
      aria-hidden="true"
      className="crt-live crt-grain pointer-events-none fixed inset-0 z-[2]"
    />
  );
}

export default Scanlines;
