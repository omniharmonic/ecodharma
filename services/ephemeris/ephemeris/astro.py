"""Astronomy core — tropical & sidereal positions, houses, aspects, synastry.

Uses pyswisseph with the Moshier ephemeris (FLG_MOSEPH) so no Swiss Ephemeris
data files are needed — keeps the container self-contained and fully auditable.
"""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import swisseph as swe

FLAGS = swe.FLG_MOSEPH | swe.FLG_SPEED

# Bodies we compute. (Earth and South Node are derived as opposites downstream.)
PLANETS: dict[str, int] = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mercury": swe.MERCURY,
    "Venus": swe.VENUS,
    "Mars": swe.MARS,
    "Jupiter": swe.JUPITER,
    "Saturn": swe.SATURN,
    "Uranus": swe.URANUS,
    "Neptune": swe.NEPTUNE,
    "Pluto": swe.PLUTO,
    # TRUE node (the oscillating node), matching Human Design software and modern
    # astrology. The mean node can differ by up to ~1.8° (≈2 gate-lines), which
    # shifts nodal gates/lines and can add spurious HD channels — the miss that
    # gave a tester a wrong 17-62 channel and a wrong line distribution.
    "North_Node": swe.TRUE_NODE,
}

SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

ASPECTS = {
    "conjunction": 0.0,
    "sextile": 60.0,
    "square": 90.0,
    "trine": 120.0,
    "opposition": 180.0,
}


def julday_ut(year: int, month: int, day: int, hour: int, minute: int, tz_str: str) -> float:
    """Local civil time -> Julian Day (UT)."""
    local = datetime(year, month, day, hour, minute, tzinfo=ZoneInfo(tz_str))
    utc = local.astimezone(ZoneInfo("UTC"))
    ut_hours = utc.hour + utc.minute / 60.0 + utc.second / 3600.0
    return swe.julday(utc.year, utc.month, utc.day, ut_hours)


def sign_of(lon: float) -> tuple[str, float]:
    lon = lon % 360.0
    idx = int(lon // 30)
    return SIGNS[idx], round(lon - idx * 30, 4)


def _calc(jd: float, body: int, sidereal: bool) -> float:
    flags = FLAGS | (swe.FLG_SIDEREAL if sidereal else 0)
    res, _ = swe.calc_ut(jd, body, flags)
    return res[0] % 360.0


def planet_longitudes(jd: float, sidereal: bool = False) -> dict[str, float]:
    if sidereal:
        swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
    out: dict[str, float] = {}
    for name, code in PLANETS.items():
        out[name] = round(_calc(jd, code, sidereal), 6)
    # Derived points
    out["South_Node"] = round((out["North_Node"] + 180.0) % 360.0, 6)
    return out


def positions_payload(lons: dict[str, float]) -> dict[str, dict]:
    payload = {}
    for name, lon in lons.items():
        sign, deg = sign_of(lon)
        payload[name] = {"lon": round(lon, 4), "sign": sign, "deg_in_sign": deg}
    return payload


def houses(jd: float, lat: float, lng: float, sidereal: bool = False) -> dict:
    flag = swe.FLG_SIDEREAL if sidereal else 0
    if sidereal:
        swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
    cusps, ascmc = swe.houses_ex(jd, lat, lng, b"P", flag)
    asc, mc = ascmc[0] % 360.0, ascmc[1] % 360.0
    asc_sign, asc_deg = sign_of(asc)
    mc_sign, mc_deg = sign_of(mc)
    return {
        "ascendant": {"lon": round(asc, 4), "sign": asc_sign, "deg_in_sign": asc_deg},
        "midheaven": {"lon": round(mc, 4), "sign": mc_sign, "deg_in_sign": mc_deg},
        "cusps": [round(c % 360.0, 4) for c in cusps[:12]],
    }


def _orb(a: float, b: float) -> float:
    d = abs((a - b) % 360.0)
    return min(d, 360.0 - d)


def aspects_within(lons: dict[str, float]) -> list[dict]:
    names = list(lons.keys())
    out = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = names[i], names[j]
            sep = _orb(lons[a], lons[b])
            for asp, angle in ASPECTS.items():
                orb_limit = 8.0 if {"Sun", "Moon"} & {a, b} else 6.0
                if abs(sep - angle) <= orb_limit:
                    out.append({
                        "p1": a, "p2": b, "aspect": asp,
                        "angle": angle, "orb": round(abs(sep - angle), 3),
                    })
                    break
    return out


def cross_aspects(lons_a: dict[str, float], lons_b: dict[str, float]) -> list[dict]:
    """Synastry: aspects between person A's bodies and person B's bodies."""
    out = []
    for a, la in lons_a.items():
        for b, lb in lons_b.items():
            sep = _orb(la, lb)
            for asp, angle in ASPECTS.items():
                orb_limit = 8.0 if {"Sun", "Moon"} & {a, b} else 6.0
                if abs(sep - angle) <= orb_limit:
                    out.append({
                        "p1_name": a, "p2_name": b, "aspect": asp,
                        "angle": angle, "orb": round(abs(sep - angle), 3),
                    })
                    break
    return out


def find_design_jd(birth_jd: float) -> float:
    """Human Design 'design' time: when the Sun was 88 degrees of arc before birth.

    Solve for the JD ~88 days earlier where Sun longitude == birth_sun_lon - 88 deg.
    """
    birth_sun = _calc(birth_jd, swe.SUN, False)
    target = (birth_sun - 88.0) % 360.0
    # Start ~88 days before; Newton-ish refine using mean solar motion ~0.9856 deg/day.
    jd = birth_jd - 88.0
    for _ in range(12):
        cur = _calc(jd, swe.SUN, False)
        diff = ((cur - target + 180.0) % 360.0) - 180.0  # signed shortest delta
        if abs(diff) < 1e-7:
            break
        jd -= diff / 0.9856
    return jd
