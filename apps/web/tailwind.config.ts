import type { Config } from "tailwindcss";

// Solarpunk design-science retrofuturism. Two "printings of the same press":
// Newsprint (day) and Blueprint (night). Raw inks are fixed; semantic tokens
// (var-driven) re-ink per mode via the .mode-blueprint class on <html>.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Fixed inks (the press's plates)
        paper: "#E4DCC6",
        ink: "#1A1C16",
        solar: "#E8A13A",
        pine: "#1F4733",
        ferro: "#18556E",
        clay: "#B5482E",
        bp: { bg: "#0C2A2E", line: "#4FA3B8", chalk: "#DCE8E0", phosphor: "#9BE8B0" },
        // Semantic, mode-swapping tokens
        bg: v("--bg"),
        surface: v("--surface"),
        fg: v("--fg"),
        muted: v("--muted"),
        rule: v("--rule"),
        accent: v("--accent"), // solar — constant across modes
        "solar-ink": v("--solar-ink"), // darkened marigold for small warm text (AA)
        link: v("--link"),
        live: v("--live"),
        flag: v("--flag"), // oxblood — rare, load-bearing
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-archivo)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Deliberate scale with real jumps
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
        xs: ["0.75rem", { lineHeight: "1.1rem" }],
        sm: ["0.875rem", { lineHeight: "1.4rem" }],
        base: ["1rem", { lineHeight: "1.6rem" }],
        lg: ["1.125rem", { lineHeight: "1.7rem" }],
        fig: ["1.5rem", { lineHeight: "1.9rem" }],
        title: ["3rem", { lineHeight: "3rem", letterSpacing: "-0.01em" }],
        hero: ["clamp(3rem, 7vw, 5.5rem)", { lineHeight: "1.0", letterSpacing: "-0.015em" }],
        mega: ["clamp(3.5rem, 11vw, 8rem)", { lineHeight: "0.95", letterSpacing: "-0.02em" }],
      },
      borderRadius: { cell: "2px", plate: "2px" },
      maxWidth: { measure: "66ch" },
      letterSpacing: { eyebrow: "0.18em" },
      keyframes: {
        draft: { to: { strokeDashoffset: "0" } },
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        draft: "draft 1.2s ease-out forwards",
        rise: "rise 0.6s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
