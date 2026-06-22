// Mock / sample constellation data so the constellation experience is visible
// without real test users. Voice: ecodharma-voice@2.0.0 — reflect the person,
// don't recite the framework; warm, plain, specific. Gift names/ids are the real
// framework gifts (see framework/framework.json). Positions named for texture are
// our own words — no proprietary descriptive text reproduced.

import type { ConstellationRead } from "./types";

// A member as shown in the sample roster. `archetype` is the human-readable gift
// name; `gift_id` matches the framework gift id.
export type SampleMember = {
  display_name: string;
  gift_id: string; // framework gift id, e.g. "the-weaver"
  archetype: string; // display name, e.g. "The Weaver"
  profile: string; // one warm line on how this person gives
  placements?: string; // optional mono texture, e.g. "Sun ♎ · Generator · 19/49"
};

export type SampleConstellation = {
  slug: string;
  name: string;
  tagline: string;
  members: SampleMember[];
  read: ConstellationRead;
};

const META = { engine: "sample", framework_version: "0.0.0-stub" } as const;

// ─────────────────────────────────────────────────────────────────────────────
// (a) Cascadia Weavers — 5 members
// ─────────────────────────────────────────────────────────────────────────────
const cascadiaWeavers: SampleConstellation = {
  slug: "cascadia-weavers",
  name: "Cascadia Weavers",
  tagline: "A bioregional cell turning watershed care into shared infrastructure.",
  members: [
    {
      display_name: "Maren",
      gift_id: "the-weaver",
      archetype: "The Weaver",
      profile: "Holds the relationships nobody else is tracking; introduces people a year before they know they need each other.",
      placements: "Sun ♎ · Generator · 19/49",
    },
    {
      display_name: "Tomas",
      gift_id: "the-builder",
      archetype: "The Builder",
      profile: "Turns a good conversation into a thing you can actually stand on by Friday.",
      placements: "Sun ♑ · Manifesting Generator · 3/60",
    },
    {
      display_name: "Priya",
      gift_id: "the-healer",
      archetype: "The Healer",
      profile: "Notices who's quietly carrying too much and makes it safe to put some of it down.",
      placements: "Moon ♋ · Projector · 25/46",
    },
    {
      display_name: "Wren",
      gift_id: "the-storyteller",
      archetype: "The Storyteller",
      profile: "Gives the group language for what it's doing, so the work can be loved and not just done.",
      placements: "Sun ♓ · Generator · 1/8",
    },
    {
      display_name: "Diego",
      gift_id: "the-toolmaker",
      archetype: "The Toolmaker",
      profile: "Builds the quiet rails — the spreadsheet, the agreement, the protocol — that let trust scale past memory.",
      placements: "Sun ♍ · Projector · 17/18",
    },
  ],
  read: {
    narrative:
      "What strikes you first about this group is how little it wastes. A relationship Maren tends becomes a project Tomas frames, becomes a story Wren can tell, becomes a tool Diego makes durable — and Priya keeps an eye on whether the people in the middle of all that are still okay. That's a rare loop. Most groups have one or two of these moves and improvise the rest; you have the whole circuit.\n\nThe lead energy here is relational, not technical. Maren is the reason the others found each other, and the group will keep working as long as it remembers that the connective tissue is real labor and not just a vibe. Tomas and Diego are the spine — between them, ideas become things and things become repeatable — but they need Maren's read on who's ready and Priya's read on who's tired, or they'll build past the group's actual capacity.\n\nWren is your translator to the wider watershed. When this cell wants to invite others in, it's Wren's framing that will make the work legible and worth joining. The risk is that the story gets ahead of the build — that you describe a commons you haven't yet made. Keep Wren close to Diego and the words stay honest.\n\nIf there's a soft spot, it's the long horizon. You are very good at the next season and less practiced at the next decade. None of you is naturally the one who asks 'and in twenty years?' — which is worth naming, because watershed work is generational by nature.",
    collective_gifts: [
      "A complete make-loop: relationship → frame → story → tool → care, with little lost between hands.",
      "Bioregional rootedness — this is a group that belongs to a specific place, not a movement in the abstract.",
      "The ability to turn trust into infrastructure that outlives any one person's attention.",
    ],
    complementarities: [
      "Maren senses who's ready; Diego makes readiness repeatable. Intuition and protocol covering for each other.",
      "Tomas ships fast; Priya watches the cost of speed. Pace and care in productive tension.",
      "Wren makes the work lovable; Diego makes it durable. Meaning and structure, side by side.",
    ],
    frictions: [
      "Tomas's Friday-deadline energy can roll over Priya's slower read on capacity. Name it before it becomes resentment.",
      "Wren's storytelling can outrun what's actually been built — exciting, but it writes checks Diego has to cash.",
      "Two builders (Tomas, Diego) can quietly compete over whose system is the real one.",
    ],
    gaps: [
      "No natural long-horizon voice — nobody here instinctively asks about the next generation, only the next season.",
      "Light on outward convening; you weave the people you already know better than you welcome strangers.",
    ],
    make_explicit: [
      "Whose call it is when speed and care disagree — decide this once, not every time.",
      "That Maren's relationship-tending is work, with time and rest budgeted for it, not an invisible donation.",
      "What 'done enough to tell the story' means, so Wren and Diego aren't negotiating it under pressure.",
    ],
    weaving_guidance:
      "Protect the loop and protect Maren. The thing that makes this group special is the unbroken handoff from relationship to durable tool, and the person holding the first link is the easiest to burn out. Give the connective work a name, a place on the calendar, and rest. Then, once a year, deliberately borrow a long-horizon voice from outside the cell — an elder, a kid, anyone who'll make you think past the next season.",
    pairwise: [
      { a: "Maren", b: "Diego", dynamic: "Intuition meets protocol. Maren feels who's ready; Diego encodes it so the group doesn't have to re-feel it every time. Their best work is turning her instinct into a rule others can use." },
      { a: "Tomas", b: "Priya", dynamic: "Pace versus care, in the good sense. Tomas wants it shipped; Priya wants the people shipping it intact. When they're talking, the group moves fast without leaving anyone behind." },
      { a: "Wren", b: "Diego", dynamic: "The story and the substance. Wren makes the work worth joining; Diego makes sure the work exists. Keep them in the same room and the narrative stays honest." },
      { a: "Maren", b: "Wren", dynamic: "The introducer and the narrator. Maren brings people in; Wren gives them a reason to stay. Together they're how this cell grows without losing its shape." },
    ],
    meta: META,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// (b) The Mutual-Credit Guild — 4 members
// ─────────────────────────────────────────────────────────────────────────────
const mutualCreditGuild: SampleConstellation = {
  slug: "mutual-credit-guild",
  name: "The Mutual-Credit Guild",
  tagline: "Designing a community currency that doesn't quietly recreate the old extractions.",
  members: [
    {
      display_name: "Aisha",
      gift_id: "the-convener",
      archetype: "The Convener",
      profile: "Gets the right people in the room and makes the room feel worth being in.",
      placements: "Sun ♌ · Projector · 7/31",
    },
    {
      display_name: "Jonah",
      gift_id: "the-toolmaker",
      archetype: "The Toolmaker",
      profile: "Designs the rules of the game so the fair thing is also the easy thing.",
      placements: "Sun ♒ · Generator · 16/9",
    },
    {
      display_name: "Lin",
      gift_id: "the-steward",
      archetype: "The Steward",
      profile: "Keeps the resources honest and the books real, long after the excitement fades.",
      placements: "Sun ♉ · Manifesting Generator · 59/6",
    },
    {
      display_name: "Bea",
      gift_id: "the-seer",
      archetype: "The Seer",
      profile: "Sees where a clever system will go wrong three moves before anyone else does.",
      placements: "Sun ♏ · Projector · 61/24",
    },
  ],
  read: {
    narrative:
      "This is a governance group disguised as a finance group, and that's its strength. Money systems usually fail not on the math but on the trust, and three of your four are fundamentally about trust — Aisha gathers it, Lin guards it, Bea protects it from clever self-deception. Jonah is the one turning all that into mechanism. It's a healthy ratio: one designer kept honest by three people who care more about the people than the protocol.\n\nAisha is the front door. The guild lives or dies on whether people feel safe putting their economic lives partly in each other's hands, and that feeling is Aisha's craft. But conveners can keep the welcome going past the point of decision; pair her with Lin, who is comfortable closing things, and the warmth gets a backbone.\n\nJonah and Bea are the real engine of the design. Jonah builds toward elegance; Bea stress-tests toward failure. Left alone, Jonah will make something beautiful that assumes good actors; Bea will make sure it survives the bad ones. This pairing is the most valuable and the most likely to grind — Bea's job is to find the flaw in Jonah's favorite idea, and that's a relationship that needs explicit permission to be hard.\n\nThe gap is voice outward. You can design something genuinely good and still fail to make anyone want it, because nobody here is a natural storyteller or builder-of-the-public-facing-thing. Borrow that, or grow it deliberately, before launch.",
    collective_gifts: [
      "A trust-first approach to economics — the people come before the protocol, which is exactly backwards from how these usually fail.",
      "Built-in adversarial review: a designer and a seer who will find the flaw before the public does.",
      "Stewardship that lasts past launch energy — Lin keeps it real when the novelty wears off.",
    ],
    complementarities: [
      "Aisha opens; Lin closes. Warmth that can still make a decision.",
      "Jonah designs for elegance; Bea designs for failure. Beauty and resilience checking each other.",
      "Lin's steady bookkeeping grounds Bea's pattern-sensing — gut feeling backed by ledger.",
    ],
    frictions: [
      "Bea's job is to puncture Jonah's best ideas; without explicit permission, that reads as obstruction instead of care.",
      "Aisha's instinct to keep the circle warm can stall the moment a hard call is due.",
      "Three trust-keepers can over-deliberate; the group may circle a decision Lin could just make.",
    ],
    gaps: [
      "No outward storyteller — you can build something good and fail to make it wanted.",
      "Thin on hands-on building of the public-facing thing; lots of design, less shipping.",
      "Light on healing — when trust frays inside the group, no one's natural role is to tend it.",
    ],
    make_explicit: [
      "That Bea's critique is the job, not disloyalty — say it out loud so it can be heard as a gift.",
      "When deliberation ends and Lin or Jonah just decides.",
      "Who carries the story to the wider community, since none of you will pick it up by default.",
    ],
    weaving_guidance:
      "Give Bea explicit license to be the loyal opposition, and give Jonah the grace to have his favorite idea broken without it being personal — that single relationship is where your design gets its strength. Then watch for over-deliberation: with three trust-keepers, you'll be tempted to consensus everything. Decide in advance which calls are Lin's alone. And before you launch, find your storyteller. A fair system nobody understands is just a private hobby.",
    pairwise: [
      { a: "Jonah", b: "Bea", dynamic: "Designer and stress-tester — the core of the whole guild. Jonah builds toward what should work; Bea hunts for how it breaks. Their friction is the feature, but only if it's blessed as such." },
      { a: "Aisha", b: "Lin", dynamic: "The welcome and the backbone. Aisha keeps the room open; Lin is willing to close the door when a decision is due. Together they're warmth that can still act." },
      { a: "Lin", b: "Bea", dynamic: "Ledger and intuition. Lin's hard numbers give Bea's pattern-sensing something to point at; Bea tells Lin which numbers are about to matter." },
      { a: "Aisha", b: "Jonah", dynamic: "The gatherer and the designer. Aisha knows what people will actually trust; Jonah translates that into rules. Keep them talking or the mechanism drifts from the humans." },
    ],
    meta: META,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// (c) Story & Soil — 3 members
// ─────────────────────────────────────────────────────────────────────────────
const storyAndSoil: SampleConstellation = {
  slug: "story-and-soil",
  name: "Story & Soil",
  tagline: "A small, tight cell pairing land work with the stories that make land work spread.",
  members: [
    {
      display_name: "Noor",
      gift_id: "the-storyteller",
      archetype: "The Storyteller",
      profile: "Finds the thread that makes a stranger care about a field they've never stood in.",
      placements: "Sun ♐ · Manifesting Generator · 1/8",
    },
    {
      display_name: "Sam",
      gift_id: "the-steward",
      archetype: "The Steward",
      profile: "Tends the actual ground, season after season, whether or not anyone's watching.",
      placements: "Sun ♉ · Generator · 27/50",
    },
    {
      display_name: "Kaya",
      gift_id: "the-weaver",
      archetype: "The Weaver",
      profile: "Keeps the small cell connected to the bigger web so the work doesn't stay a secret.",
      placements: "Sun ♎ · Projector · 19/49",
    },
  ],
  read: {
    narrative:
      "Three people is small enough that each of you matters completely, and you've chosen well: a maker of meaning, a keeper of the ground, and a connector between them and everyone else. Sam is the gravity here — the actual soil, the actual seasons, the work that's true whether or not it's ever a story. Noor and Kaya both orbit that truth, and that's the right order. Story and network in service of real ground, not the other way around.\n\nNoor is how the work travels. Without Noor, Sam's stewardship is real but invisible; with Noor, a field becomes a reason for someone three towns over to start their own. The danger in any storyteller-plus-steward pair is that the telling gets ahead of the doing — that Noor describes a thriving thing while Sam is still in year two of soil that doesn't get fixed in a season. Kaya is the natural referee there, the one who can feel when the story and the soil have drifted apart.\n\nKaya keeps you from being a closed loop. A cell this tight can become a lovely private world; Kaya's gift is the door. The thing to watch is that with only three, Kaya's connective work and Noor's outward work overlap, and they should agree on who carries what outward so the group doesn't speak with two voices.\n\nWhat you don't have is a builder or a toolmaker — someone to make the infrastructure that would let this scale past what three people can personally hold. That's fine at this size. Name it the moment you want to grow.",
    collective_gifts: [
      "Real ground under everything — Sam keeps the work honest, so the story always has something true to point at.",
      "Reach far beyond your numbers — Noor and Kaya together can make a three-person cell legible to a whole region.",
      "Intimacy. At this size every person is fully seen, and decisions can stay human.",
    ],
    complementarities: [
      "Sam does the slow, unwatched work; Noor makes it visible. Substance and story in the right order.",
      "Kaya connects outward; Sam roots downward. The cell reaches without floating off.",
      "Noor tells the story; Kaya feels when it's drifted from the soil. Narrative with a conscience.",
    ],
    frictions: [
      "Noor's telling can outrun Sam's seasons — describing a thriving thing while the ground is still mending.",
      "Kaya and Noor both face outward; without agreement, the cell can speak with two voices.",
      "With only three, one person's hard season is felt by everyone — there's little slack.",
    ],
    gaps: [
      "No builder or toolmaker — nothing here scales past what three people can personally carry.",
      "No dedicated healer or convener; when it's just you three, internal strain has nowhere to go but between you.",
    ],
    make_explicit: [
      "Who speaks for the cell outward — Noor, Kaya, or both with a shared line.",
      "How fast the story is allowed to get ahead of the soil, so Noor isn't guessing.",
      "What you'll do when you want to grow — that you'll need hands you don't currently have.",
    ],
    weaving_guidance:
      "Keep Sam at the center. The whole cell's integrity comes from the fact that there's real ground under the story; protect Sam's slow work from the pull to perform it before it's ready. Have Noor and Kaya settle, plainly, who carries the outward voice. And enjoy being three — but know that the day you want to scale, you'll need to bring in a builder, because reach without infrastructure eventually asks more of three people than three people have.",
    pairwise: [
      { a: "Noor", b: "Sam", dynamic: "Story and ground — the heart of this cell. Sam makes something true; Noor makes it travel. The work is keeping the telling honest to the slow reality of soil." },
      { a: "Kaya", b: "Sam", dynamic: "The connector and the keeper. Kaya links the rooted work to the wider web; Sam gives Kaya's network something real to be about. Reach anchored to ground." },
      { a: "Noor", b: "Kaya", dynamic: "Two outward faces. Both carry the work to the world — which is double the reach and double the risk of mixed messages. Their main task is agreeing who says what." },
    ],
    meta: META,
  },
};

export const SAMPLE_CONSTELLATIONS: SampleConstellation[] = [
  cascadiaWeavers,
  mutualCreditGuild,
  storyAndSoil,
];

// Return the sample constellation for a slug, or the first one as default.
export function getSampleConstellation(slug?: string): SampleConstellation {
  if (slug) {
    const found = SAMPLE_CONSTELLATIONS.find((c) => c.slug === slug);
    if (found) return found;
  }
  return SAMPLE_CONSTELLATIONS[0];
}
