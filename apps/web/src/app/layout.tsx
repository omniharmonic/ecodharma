import type { Metadata, Viewport } from "next";
import { Fraunces, Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { getUser } from "@/lib/auth";
import { logoutAction } from "./actions/auth";
import { TerminalNav } from "@/components/TerminalNav";
import { DreamLayer } from "@/components/dream/DreamLayer";
import { GlyphCompass } from "@/components/dream/GlyphCompass";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-fraunces",
  display: "swap",
});
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EcoDharma — the work that is only yours",
  description:
    "A field manual for your contribution to the regenerative transition — read through many lenses, mapped to the work that is only yours.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#02070c",
  width: "device-width",
  initialScale: 1,
};

// Blueprint (dark) is the default; only users who explicitly chose Newsprint get
// light. The class is server-rendered (below) so it's dark even before JS; this
// pre-paint script removes it for the Newsprint opt-outs (no flash).
// The dreamscape is always night.
const modeInit = `(function(){try{document.documentElement.classList.add('mode-blueprint');}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`mode-blueprint ${fraunces.variable} ${archivo.variable} ${plexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: modeInit }} />
      </head>
      <body>
        <DreamLayer />
        <div id="app-root" className="relative z-10">
          <GlyphCompass
            signedIn={!!user}
            logout={
              <form action={logoutAction}>
                <button className="font-mono text-2xs uppercase tracking-eyebrow text-muted hover:text-accent" type="submit">Sign out</button>
              </form>
            }
          />
          <main className="dream-main">{children}</main>
          <TerminalNav />
          <footer className="dream-footer">
            Mythopoetic, not predictive · lenses for reflection · offered toward the commons (CC BY-SA)
          </footer>
        </div>
      </body>
    </html>
  );
}
