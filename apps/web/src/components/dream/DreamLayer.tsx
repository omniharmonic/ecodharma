"use client";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IMMERSIVE, onDream, placeFor, type Place } from "./bus";
import type { DreamData } from "./Dreamscape";
import { StillNight } from "./StillNight";

const Dreamscape = dynamic(() => import("./Dreamscape"), { ssr: false, loading: () => <StillNight /> });

function webglOK(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** The persistent world behind every page. */
export function DreamLayer() {
  const pathname = usePathname() || "/";
  const [data, setData] = useState<DreamData>({ snap: null, natal: null });
  const [mode, setMode] = useState<"pending" | "live" | "still">("pending");
  const [placeOverride, setPlaceOverride] = useState<Place | null>(null);

  useEffect(() => {
    let forced: string | null = null;
    try { forced = localStorage.getItem("eco-dream"); } catch { /* storage blocked */ }
    // Automated browsers (tests, crawlers) get the still night unless explicitly asked for the live world.
    const automated = (navigator as Navigator & { webdriver?: boolean }).webdriver && forced !== "live";
    const still = forced === "still" || automated || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !webglOK();
    setMode(still ? "still" : "live");
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/altar/snapshot", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (alive) setData({ snap: j.snap ?? null, natal: j.natal ?? null }); }).catch(() => {});
    load();
    const off = onDream((ev) => {
      if (ev.type === "refresh") load();
      if (ev.type === "focus") setPlaceOverride(ev.place);
    });
    return () => { alive = false; off(); };
  }, [pathname]);
  useEffect(() => setPlaceOverride(null), [pathname]);

  useEffect(() => {
    document.documentElement.dataset.immersive = IMMERSIVE(pathname) ? "1" : "0";
  }, [pathname]);

  const place = placeOverride || placeFor(pathname);
  if (mode === "pending") return <StillNight />;
  if (mode === "still") return <StillNight />;
  return <Dreamscape data={data} place={place} interactive={IMMERSIVE(pathname)} />;
}
