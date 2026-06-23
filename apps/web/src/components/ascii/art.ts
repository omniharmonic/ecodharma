// Hand-set ASCII art for the EcoDharma terminal. Monospace-aligned; kept narrow
// enough to fit a phone column at small type. These are textual assets — the
// components render them in <pre>. Original work (no third-party banners).

// The boot / hero wordmark. Lines kept as an array to avoid escape ambiguity.
export const WORDMARK = [
  " ___  ___  ___    _ _ _ _  __ _ _ _ _ _  __ _ ",
  "/ -_)/ _|/ _ \\  / _` | ' \\/ _` | '_| '  \\/ _` |",
  "\\___|\\__|\\___/  \\__,_|_||_\\__,_|_| |_|_|_\\__,_|",
].join("\n");

// A compact emblem — a seed sprouting inside the whole earth.
export const SEED_EARTH = [
  "    .--\"\"--.",
  "  .'  .  .  '.",
  " / :  .::|::.  \\",
  ": :.::-- @ --.: :",
  " \\  '::.|.::'  /",
  "  '.   '  '   .'",
  "    '--..--'",
].join("\n");

// The trim-tab / rudder motif — the small surface that turns the whole ship.
export const TRIM_TAB = [
  "  ═══════════════╗",
  "   the whole ship ║▌",
  "  ═══════════════╝  ◂ trim-tab",
].join("\n");

// A spread of mycelial threads — used as a section ornament.
export const MYCELIUM = "·  ╶┬╴ ·  ╶┼╴ ·  ╶┬╴  ·  ╶┴╴ ·  ╶┼╴ ·  ╶┬╴ ·";

// Box-drawing dividers (rendered via CSS too, but handy inline).
export const DIV_HEAVY = "━".repeat(64);
export const DIV_LIGHT = "─".repeat(64);
export const DIV_DASH = "╌".repeat(64);

// A diamond node divider used between major sections.
export const NODE = "◇";

// Boot log lines, typed out during the cold-start sequence.
export const BOOT_LINES = (domains: number, gifts: number, trimtabs: number): string[] => [
  "ecodharma tty · ancient-future build",
  "mounting /framework ............... ok",
  `loading archetypes ............ ${gifts} gifts`,
  `loading domains ............... ${domains} domains`,
  `indexing trim-tab commons ..... ${trimtabs}+`,
  "calibrating ephemeris ............. ok",
  "establishing whole-earth uplink ... live",
  "",
  "welcome, fellow traveler.",
];
