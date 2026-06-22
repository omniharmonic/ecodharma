"use client";
// Back-compat shim. The crude blob-continent globe has been replaced by AsciiGlobe,
// an accurate rotating ASCII Earth ray-sampled against a real world landmask.
// Existing imports of { AsciiEarth } keep working via this re-export.
export { AsciiGlobe as AsciiEarth, AsciiGlobe, LANDMASK_RUNS, isLand } from "./AsciiGlobe";
