import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fraunces, Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { getUser } from "@/lib/auth";
import { loadFramework } from "@/lib/framework";
import { logoutAction } from "./actions/auth";
import { ModeToggle } from "@/components/ModeToggle";
import { TerminalNav } from "@/components/TerminalNav";
import Scanlines from "@/components/Scanlines";

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
  themeColor: "#EDEEE7",
  width: "device-width",
  initialScale: 1,
};

// Set the printing before paint (no flash).
const modeInit = `(function(){try{var m=localStorage.getItem('eco-mode');if(m==='blueprint')document.documentElement.classList.add('mode-blueprint');}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const fw = loadFramework();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${archivo.variable} ${plexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: modeInit }} />
      </head>
      <body>
        <Scanlines />
        <div id="app-root">
          {/* Masthead — a quiet wordmark + navigation. */}
          <header className="border-b border-rule/20">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
              <Link href="/" className="font-display text-lg lowercase tracking-tight text-fg">
                ecodharma
              </Link>
              <nav className="flex items-center gap-4 sm:gap-5">
                {user ? (
                  <>
                    {/* primary links — collapse into the command menu (⌘ menu) on phones */}
                    <span className="hidden items-center gap-4 md:flex">
                      <NavLink href="/profile">Profile</NavLink>
                      <NavLink href="/constellations">Constellations</NavLink>
                      <NavLink href="/curate">Curate</NavLink>
                      <NavLink href="/settings">Settings</NavLink>
                    </span>
                    <form action={logoutAction}>
                      <button className="font-mono text-2xs uppercase tracking-eyebrow text-muted hover:text-accent" type="submit">
                        Sign out
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <NavLink href="/login">Sign in</NavLink>
                    <Link href="/signup" className="btn-solar text-2xs">Begin</Link>
                  </>
                )}
                <ModeToggle />
              </nav>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-5 pb-12">{children}</main>
          <TerminalNav />

          <footer className="mx-auto max-w-6xl px-5 pt-10 pb-16">
            <hr className="rule-x mb-4" />
            <p className="font-mono text-2xs uppercase tracking-eyebrow text-muted">
              Mythopoetic, not predictive · lenses for reflection · offered toward the commons (CC BY-SA)
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-mono text-2xs uppercase tracking-eyebrow text-muted hover:text-accent">
      {children}
    </Link>
  );
}
