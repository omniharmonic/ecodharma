"use client";
import { useEffect } from "react";
import { dream } from "./bus";

/** Mount to refresh the world and drop a ripple into the lake (e.g. after a reflection is offered). */
export function DreamPulse({ strength = 1.6 }: { strength?: number }) {
  useEffect(() => {
    dream({ type: "refresh" });
    const t = setTimeout(() => dream({ type: "ripple", strength }), 600);
    return () => clearTimeout(t);
  }, [strength]);
  return null;
}
