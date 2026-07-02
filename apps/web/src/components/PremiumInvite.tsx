import Link from "next/link";

// A quiet, in-voice invitation to the membership — never a hard sell. For free
// members it opens a door ("go deeper"); for members it just points them at their
// tools. Placed at the foot of the reading and the constellations pages.
type Context = "reading" | "constellation";

const INVITE: Record<Context, { eyebrow: string; headline: string; body: string }> = {
  reading: {
    eyebrow: "Keep the conversation going",
    headline: "A reading is a beginning, not a verdict.",
    body:
      "Members keep reflecting with their profile between sittings — over Telegram, or their own AI tool — receive a weekly nudge that plays to their strengths, and can re-draft the whole reading as they grow into it.",
  },
  constellation: {
    eyebrow: "Tend the relating",
    headline: "The real weaving is meeting each particular person well.",
    body:
      "Members can ask their companion how to move toward someone they're woven with — “how do I meet Maya where she is right now?” — grounded in both of your gifts and the Human Design between you.",
  },
};

const MEMBER_POINTER: Record<Context, string> = {
  reading:
    "Reflect on any of this with your companion — over Telegram or your own AI tool.",
  constellation:
    "Ask your companion how to relate to someone here — it can read from the people you're woven with.",
};

export function PremiumInvite({ premium, context }: { premium: boolean; context: Context }) {
  if (premium) {
    return (
      <aside className="mt-16 max-w-measure border-t border-rule/15 pt-6" data-testid="member-pointer">
        <p className="text-sm text-muted">
          {MEMBER_POINTER[context]}{" "}
          <Link href="/settings" className="text-link underline-offset-4 hover:text-accent hover:underline">
            Open your companion →
          </Link>
        </p>
      </aside>
    );
  }

  const { eyebrow, headline, body } = INVITE[context];
  return (
    <aside className="mt-16 max-w-measure border-t border-rule/15 pt-8" data-testid="premium-invite">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <p className="font-display text-fig leading-snug text-fg">{headline}</p>
      <p className="mt-2 max-w-prose font-sans text-sm text-muted">{body}</p>
      <Link href="/settings" className="btn-line mt-5 inline-block">
        Go deeper with membership
      </Link>
    </aside>
  );
}
