"""Gene Keys — core sequences derived from the SAME gate math as Human Design.

Positions only. We never reproduce Richard Rudd's copyrighted Gene Keys text;
the interpretation engine generates original language and links out to genekeys.com
for canonical contemplation.
"""
from __future__ import annotations


def gene_keys_sequences(hd_personality: dict, hd_design: dict) -> dict:
    """hd_personality / hd_design: the {body: {gate, line}} maps from Human Design."""
    p, d = hd_personality, hd_design

    def gl(side, body):
        v = side.get(body)
        return {"gate": v["gate"], "line": v["line"]} if v else None

    return {
        # Activation Sequence — the four Prime Gifts.
        "activation_sequence": {
            "lifes_work": gl(p, "Sun"),
            "evolution": gl(p, "Earth"),
            "radiance": gl(d, "Sun"),
            "purpose": gl(d, "Earth"),
        },
        # Venus Sequence (relational) — best-effort sphere mapping; positions only.
        "venus_sequence": {
            "attraction": gl(d, "Moon"),
            "iq": gl(d, "Venus"),
            "eq": gl(p, "Venus"),
            "sq": gl(d, "Mars"),
        },
        # Pearl Sequence (prosperity).
        "pearl_sequence": {
            "vocation": gl(p, "Jupiter"),
            "culture": gl(d, "Jupiter"),
            "brand": gl(p, "Mars"),
        },
        "note": "Original positions only; canonical contemplation at genekeys.com.",
    }
