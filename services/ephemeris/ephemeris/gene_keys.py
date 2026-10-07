"""Gene Keys — the Hologenetic Profile's sphere positions, derived from the SAME
gate math as Human Design.

Positions only. We never reproduce Richard Rudd's copyrighted Gene Keys text;
the interpretation engine writes original language and links out to genekeys.com
for canonical contemplation.

Sphere → activation map (P = Personality/natal/conscious, D = Design/pre-natal):

  Activation Sequence   Life's Work = P.Sun   Evolution = P.Earth
                        Radiance    = D.Sun   Purpose   = D.Earth
  Venus Sequence        Attraction  = D.Moon  IQ = P.Venus  EQ = P.Mars
                        SQ = D.Venus          Core = D.Mars
  Pearl Sequence        Vocation    = D.Mars (shares the Core's key)
                        Culture = D.Jupiter   Pearl = P.Jupiter
                        Brand = P.Sun (shares Life's Work's key)

v0.1 mis-mapped IQ/EQ/SQ/Vocation/Brand and omitted Core and Pearl; verified
against published sphere tables and an independent engine (oracle/).
"""
from __future__ import annotations

SPHERE_SOURCES: dict[str, dict[str, tuple[str, str]]] = {
    "activation_sequence": {
        "lifes_work": ("personality", "Sun"),
        "evolution": ("personality", "Earth"),
        "radiance": ("design", "Sun"),
        "purpose": ("design", "Earth"),
    },
    "venus_sequence": {
        "attraction": ("design", "Moon"),
        "iq": ("personality", "Venus"),
        "eq": ("personality", "Mars"),
        "sq": ("design", "Venus"),
        "core": ("design", "Mars"),
    },
    "pearl_sequence": {
        "vocation": ("design", "Mars"),
        "culture": ("design", "Jupiter"),
        "pearl": ("personality", "Jupiter"),
        "brand": ("personality", "Sun"),
    },
}


def gene_keys_sequences(hd_personality: dict, hd_design: dict) -> dict:
    """hd_personality / hd_design: the {body: {gate, line, ...}} maps from Human Design."""
    sides = {"personality": hd_personality, "design": hd_design}

    def gl(side: str, body: str):
        v = sides[side].get(body)
        if not v:
            return None
        out = {"gate": v["gate"], "line": v["line"], "source": f"{side}.{body}"}
        if "sensitive" in v:
            out["sensitive"] = v["sensitive"]
        return out

    result: dict = {
        seq: {sphere: gl(side, body) for sphere, (side, body) in spheres.items()}
        for seq, spheres in SPHERE_SOURCES.items()
    }
    result["note"] = "Original positions only; canonical contemplation at genekeys.com."
    return result
