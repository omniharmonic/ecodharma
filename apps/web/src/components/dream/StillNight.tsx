import { SacredGeometry } from "@/components/altar/SacredGeometry";

/** The still dreamscape: for reduced motion, no WebGL, and the first paint. */
export function StillNight() {
  return (
    <div className="dreamscape dreamscape-still" aria-hidden data-testid="dreamscape-still">
      <div className="still-stars" />
      <div className="still-lake" />
      <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 opacity-70">
        <SacredGeometry size={560} variant="metatron" opacity={0.18} spin={false} />
      </div>
      <div className="still-star" />
    </div>
  );
}
