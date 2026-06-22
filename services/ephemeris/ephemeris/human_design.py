"""Human Design — structural computation from ephemeris positions ONLY.

No proprietary descriptive text (IP boundary). We return type, profile, authority,
defined centers, channels, and gate/line activations — all derived from the
publicly-known gate wheel + I-Ching mandala geometry.

Wheel anchors (verified): Gate 25 begins at 0deg Aries; Gate 41 begins at 2deg
Aquarius (302deg ecliptic longitude). Each gate spans 5.625deg; each line 0.9375deg.
"""
from __future__ import annotations

# Gate order around the zodiac, starting at 0deg Aries (Gate 25's span contains 0deg Aries).
GATE_WHEEL = [
    25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12,
    15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6,
    46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11,
    10, 58, 38, 54, 61, 60, 41, 19, 13, 49, 30, 55, 37, 63, 22, 36,
]
WHEEL_START = 358.25  # ecliptic longitude where Gate 25 begins (28deg15' Pisces)
GATE_SIZE = 360.0 / 64.0  # 5.625
LINE_SIZE = GATE_SIZE / 6.0  # 0.9375

# Each gate belongs to exactly one center (sums to 64).
GATE_CENTER = {}
def _assign(center, gates):
    for g in gates:
        GATE_CENTER[g] = center
_assign("Head", [64, 61, 63])
_assign("Ajna", [47, 24, 4, 17, 43, 11])
_assign("Throat", [62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16])
_assign("G", [1, 13, 25, 46, 2, 15, 10, 7])
_assign("Heart", [21, 40, 26, 51])
_assign("Spleen", [48, 57, 44, 50, 32, 28, 18])
_assign("Sacral", [5, 14, 29, 59, 9, 3, 42, 27, 34])
_assign("SolarPlexus", [6, 37, 22, 36, 30, 55, 49])
_assign("Root", [53, 60, 52, 19, 39, 41, 58, 38, 54])
assert len(GATE_CENTER) == 64, f"gate-center map has {len(GATE_CENTER)} gates"

# The 36 channels (gate pairs).
CHANNELS = [
    (1, 8), (2, 14), (3, 60), (4, 63), (5, 15), (6, 59), (7, 31), (9, 52),
    (10, 20), (10, 34), (10, 57), (11, 56), (12, 22), (13, 33), (16, 48),
    (17, 62), (18, 58), (19, 49), (20, 34), (20, 57), (21, 45), (23, 43),
    (24, 61), (25, 51), (26, 44), (27, 50), (28, 38), (29, 46), (30, 41),
    (32, 54), (34, 57), (35, 36), (37, 40), (39, 55), (42, 53), (47, 64),
]
assert len(CHANNELS) == 36, f"expected 36 channels, got {len(CHANNELS)}"

MOTORS = {"Sacral", "Heart", "SolarPlexus", "Root"}

# Activation bodies (personality = birth, design = 88deg solar-arc before birth).
HD_BODIES = [
    "Sun", "Earth", "Moon", "North_Node", "South_Node", "Mercury", "Venus",
    "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
]


def gate_line(lon: float) -> tuple[int, int]:
    offset = (lon - WHEEL_START) % 360.0
    idx = int(offset // GATE_SIZE)
    gate = GATE_WHEEL[idx]
    within = offset - idx * GATE_SIZE
    line = int(within // LINE_SIZE) + 1
    return gate, min(line, 6)


def _activations(lons: dict[str, float]) -> dict[str, dict]:
    """lons must already include Earth (Sun+180) and South_Node."""
    out = {}
    for body in HD_BODIES:
        if body not in lons:
            continue
        g, l = gate_line(lons[body])
        out[body] = {"gate": g, "line": l}
    return out


def _defined_centers_and_channels(active_gates: set[int]):
    channels = []
    for a, b in CHANNELS:
        if a in active_gates and b in active_gates:
            channels.append({
                "gates": [a, b],
                "centers": [GATE_CENTER[a], GATE_CENTER[b]],
            })
    defined = set()
    for ch in channels:
        defined.update(ch["centers"])
    return defined, channels


def _center_graph(channels):
    adj: dict[str, set] = {}
    for ch in channels:
        c1, c2 = ch["centers"]
        adj.setdefault(c1, set()).add(c2)
        adj.setdefault(c2, set()).add(c1)
    return adj


def _connected(adj, start, target) -> bool:
    if start not in adj:
        return False
    seen, stack = {start}, [start]
    while stack:
        node = stack.pop()
        if node == target:
            return True
        for nxt in adj.get(node, ()):
            if nxt not in seen:
                seen.add(nxt)
                stack.append(nxt)
    return False


def _motor_to_throat(adj, defined) -> bool:
    return any(_connected(adj, m, "Throat") for m in MOTORS if m in defined)


def _determine_type(defined, adj) -> str:
    if not defined:
        return "Reflector"
    sacral = "Sacral" in defined
    m2t = _motor_to_throat(adj, defined)
    if sacral:
        return "Manifesting Generator" if m2t else "Generator"
    if m2t:
        return "Manifestor"
    return "Projector"


def _determine_authority(defined, hd_type) -> str:
    if "SolarPlexus" in defined:
        return "Emotional"
    if "Sacral" in defined:
        return "Sacral"
    if "Spleen" in defined:
        return "Splenic"
    if "Heart" in defined:
        return "Ego" if hd_type in ("Manifestor", "Projector") else "Sacral"
    if hd_type == "Reflector":
        return "Lunar"
    if "G" in defined:
        return "Self-Projected"
    return "Mental"  # Projector/Manifestor sounding-board, no inner authority


def _definition(defined, channels) -> str:
    if not defined:
        return "none"
    adj = _center_graph(channels)
    seen, comps = set(), 0
    for c in defined:
        if c in seen:
            continue
        comps += 1
        stack = [c]
        while stack:
            n = stack.pop()
            if n in seen:
                continue
            seen.add(n)
            stack.extend(adj.get(n, ()))
    return {1: "single", 2: "split", 3: "triple-split", 4: "quadruple-split"}.get(comps, f"{comps}-part")


def human_design_chart(p_lons: dict[str, float], d_lons: dict[str, float], unknown_time: bool) -> dict:
    """p_lons/d_lons: longitude dicts for personality (birth) and design times.

    Both must already contain Earth and South_Node (opposites of Sun / North_Node).
    """
    personality = _activations(p_lons)
    design = _activations(d_lons)

    active_gates = {a["gate"] for a in personality.values()} | {a["gate"] for a in design.values()}
    defined, channels = _defined_centers_and_channels(active_gates)
    adj = _center_graph(channels)

    hd_type = _determine_type(defined, adj)
    authority = _determine_authority(defined, hd_type)
    profile = f"{personality['Sun']['line']}/{design['Sun']['line']}"

    all_centers = ["Head", "Ajna", "Throat", "G", "Heart", "Sacral", "SolarPlexus", "Spleen", "Root"]

    return {
        "type": hd_type,
        "profile": profile,
        "authority": authority,
        "definition": _definition(defined, channels),
        "defined_centers": [c for c in all_centers if c in defined],
        "open_centers": [c for c in all_centers if c not in defined],
        "channels": channels,
        "gates": {"personality": personality, "design": design},
        "incarnation_cross_gates": {
            "personality_sun": personality["Sun"]["gate"],
            "personality_earth": personality["Earth"]["gate"],
            "design_sun": design["Sun"]["gate"],
            "design_earth": design["Earth"]["gate"],
        },
        "low_confidence": unknown_time,  # gate/line is highly time-sensitive
    }
