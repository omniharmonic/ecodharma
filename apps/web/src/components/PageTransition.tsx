"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode, ElementType, CSSProperties } from "react";

/**
 * PageTransition — CSS-only 3D route reveal.
 *
 * Re-keys its subtree on pathname so the `.pt-stage` keyframe (defined in
 * globals.css: perspective + translateZ + rotateX) replays on every route
 * change. No JS animation, no deps. Reduced-motion safe (the keyframe is
 * nulled in the global prefers-reduced-motion block).
 *
 * Wrap layout.tsx's <main>:  <PageTransition><main>…</main></PageTransition>
 * (or put it inside <main> around {children}).
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={["pt-stage", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

/**
 * SectionReveal — staggered 3D entrance for a section/element.
 *
 * Applies `.sr-item` (sr-in keyframe) with a per-item stagger via the
 * `--i` CSS var. When `onView` is true it defers the reveal until the
 * element scrolls into view (IntersectionObserver, threshold 0.15);
 * otherwise it reveals immediately on mount. Use instead of ad-hoc
 * `.animate-rise` on hero / framework / constellation sections.
 *
 * Reduced-motion safe (keyframe nulled globally). Note: `delay` is an
 * alias for `index` for ergonomic call sites.
 */
export function SectionReveal({
  children,
  index = 0,
  delay,
  onView = false,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  index?: number;
  /** Alias for `index` — stagger position; multiplied by 70ms. */
  delay?: number;
  onView?: boolean;
  className?: string;
  as?: ElementType;
}) {
  const i = delay ?? index;

  // Immediate reveal: render with .sr-item from the start (server-safe).
  if (!onView) {
    return (
      <Tag
        className={["sr-item", className].filter(Boolean).join(" ")}
        style={{ "--i": i } as CSSProperties}
      >
        {children}
      </Tag>
    );
  }

  return (
    <ViewReveal as={Tag} index={i} className={className}>
      {children}
    </ViewReveal>
  );
}

// Client-only on-view variant, split out so the common path stays simple.
function ViewReveal({
  children,
  index,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  index: number;
  className?: string;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  const setRef = (el: HTMLElement | null) => {
    ref.current = el;
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No IO support → just show.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Comp = Tag as ElementType;
  return (
    <Comp
      ref={setRef}
      className={[shown ? "sr-item" : "", className].filter(Boolean).join(" ")}
      style={{ "--i": index } as CSSProperties}
    >
      {children}
    </Comp>
  );
}
