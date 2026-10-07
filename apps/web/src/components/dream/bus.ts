// A tiny event bus between pages (veils) and the persistent dreamscape world.
// Pages can focus the camera on a place, make the world interactive, or drop a
// ripple into the lake (e.g. when a reflection is offered).

export type Place = "home" | "altar" | "journal" | "reading" | "constellations" | "inquiry" | "journey" | "ritual" | "threshold" | "default";

export type Pose = { pos: [number, number, number]; target: [number, number, number]; drift: number };

export const POSES: Record<Place, Pose> = {
  home: { pos: [0, 2, 92], target: [0, -12, 0], drift: 0.02 },
  altar: { pos: [34, 13, 40], target: [0, 2, 0], drift: 0.025 },
  journal: { pos: [6, -2.6, 36], target: [0, -6, 0], drift: 0.012 },
  reading: { pos: [14, 30, 34], target: [0, 9, 0], drift: 0.02 },
  constellations: { pos: [0, 34, 118], target: [0, 2, 0], drift: 0.015 },
  inquiry: { pos: [0, 3.5, 17], target: [0, 1.5, 0], drift: 0.01 },
  journey: { pos: [-30, 9, 32], target: [0, 3, 0], drift: 0.015 },
  ritual: { pos: [-14, 5, 44], target: [-60, 28, -70], drift: 0.008 },
  threshold: { pos: [0, 1, 120], target: [0, 6, 0], drift: 0.01 },
  default: { pos: [40, 12, 52], target: [0, 2, 0], drift: 0.02 },
};

export function placeFor(pathname: string): Place {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/altar/story")) return "journey";
  if (pathname.startsWith("/altar")) return "altar";
  if (pathname.startsWith("/journal")) return "journal";
  if (pathname.startsWith("/profile") || pathname.startsWith("/r/")) return "reading";
  if (pathname.startsWith("/constellations") || pathname.startsWith("/invite")) return "constellations";
  if (pathname.startsWith("/inquiry")) return "inquiry";
  if (pathname.startsWith("/journey")) return "journey";
  if (pathname.startsWith("/ritual")) return "ritual";
  if (pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/onboarding")) return "threshold";
  return "default";
}

/** Routes where the world itself is the interface (drag to turn the heavens). */
export const IMMERSIVE = (pathname: string) => pathname === "/" || pathname === "/altar" || pathname.startsWith("/inquiry");

type DreamEvent = { type: "focus"; place: Place } | { type: "ripple"; strength?: number } | { type: "refresh" } | { type: "select"; id: number | null };

export function dream(ev: DreamEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("eco:dream", { detail: ev }));
}

export function onDream(fn: (ev: DreamEvent) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent).detail as DreamEvent);
  window.addEventListener("eco:dream", h);
  return () => window.removeEventListener("eco:dream", h);
}
