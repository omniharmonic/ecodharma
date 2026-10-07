"""Jyotish (Vedic) structure — sidereal (Lahiri) rashi, nakshatra + pada + lord,
whole-sign houses from the lagna, and Rahu/Ketu on the MEAN node (the classical
Jyotish convention; Western/HD use the true node).

v0.1 computed none of this, yet the interpreter was asked to "name nakshatras" —
so Claude invented them. Now they're computed, and the guard only lets the prose
name nakshatras that appear here.
"""
from __future__ import annotations

import swisseph as swe

from .astro import FLAGS, SIGNS, sign_of

NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu",
    "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta",
    "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha",
    "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
    "Uttara Bhadrapada", "Revati",
]
# Vimshottari lords cycle Ketu→Venus→Sun→Moon→Mars→Rahu→Jupiter→Saturn→Mercury.
LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
NAK_SIZE = 360.0 / 27.0  # 13°20'
PADA_SIZE = NAK_SIZE / 4.0  # 3°20'

GRAHAS = {
    "Sun": swe.SUN, "Moon": swe.MOON, "Mars": swe.MARS, "Mercury": swe.MERCURY,
    "Jupiter": swe.JUPITER, "Venus": swe.VENUS, "Saturn": swe.SATURN,
    # Outer planets aren't classical grahas but people expect to see them.
    "Uranus": swe.URANUS, "Neptune": swe.NEPTUNE, "Pluto": swe.PLUTO,
}


def nakshatra(lon: float) -> dict:
    lon = lon % 360.0
    # Multiply rather than divide by 13.333…: 40° * 27/360 is exactly 3.0, so a
    # longitude exactly on a nakshatra/pada edge lands in the one that BEGINS there.
    quarter = int(lon * 108.0 / 360.0 + 1e-12)  # 108 padas around the zodiac
    idx = min(quarter // 4, 26)
    pada = quarter % 4 + 1
    return {"name": NAKSHATRAS[idx], "index": idx + 1, "pada": pada, "lord": LORDS[idx % 9]}


def _sid(jd: float, body: int) -> float:
    swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
    res, _ = swe.calc_ut(jd, body, FLAGS | swe.FLG_SIDEREAL)
    return res[0] % 360.0


def vedic_chart(jd: float, lat: float, lng: float) -> dict:
    swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
    # Sidereal ascendant (lagna). House system doesn't affect the ascendant degree.
    _, ascmc = swe.houses_ex(jd, lat, lng, b"O", swe.FLG_SIDEREAL)
    lagna = ascmc[0] % 360.0
    lagna_sign_idx = int(lagna // 30)

    lons = {name: _sid(jd, code) for name, code in GRAHAS.items()}
    lons["Rahu"] = _sid(jd, swe.MEAN_NODE)
    lons["Ketu"] = (lons["Rahu"] + 180.0) % 360.0

    def place(lon: float) -> dict:
        sign, deg = sign_of(lon)
        house = ((int(lon // 30) - lagna_sign_idx) % 12) + 1  # whole-sign
        return {"lon": round(lon, 4), "sign": sign, "deg_in_sign": deg, "house": house, "nakshatra": nakshatra(lon)}

    lsign, ldeg = sign_of(lagna)
    return {
        "lagna": {"lon": round(lagna, 4), "sign": lsign, "deg_in_sign": ldeg, "nakshatra": nakshatra(lagna)},
        "grahas": {name: place(lon) for name, lon in lons.items()},
        "houses": {"system": "whole_sign", "signs": [SIGNS[(lagna_sign_idx + i) % 12] for i in range(12)]},
        "ayanamsa": {"name": "Lahiri", "value": round(swe.get_ayanamsa_ut(jd), 6)},
        "node": "mean",
    }
