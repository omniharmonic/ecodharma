"""Astronomy core — tropical & sidereal positions, houses, aspects, synastry.

Backend: Swiss Ephemeris data files (FLG_SWIEPH) when SE_EPHE_PATH points at a
directory holding them; otherwise the built-in Moshier ephemeris (FLG_MOSEPH),
which needs no files and agrees with SE to arc-seconds for 1800–2200.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import swisseph as swe


def _select_backend() -> tuple[int, str]:
    path = os.environ.get("SE_EPHE_PATH")
    if path and os.path.isdir(path) and any(f.startswith("sepl") for f in os.listdir(path)):
        swe.set_ephe_path(path)
        return swe.FLG_SWIEPH, "swisseph-files"
    return swe.FLG_MOSEPH, "moshier"


_BACKEND_FLAG, BACKEND = _select_backend()
FLAGS = _BACKEND_FLAG | swe.FLG_SPEED

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


def resolve_time(year: int, month: int, day: int, hour: int, minute: int, tz_str: str) -> dict:
    """Local civil time -> UTC, with honest warnings about clock anomalies.

    - "dst_gap": the local time never existed (clocks sprang forward over it).
      We interpret it with the pre-transition offset (fold=0) and say so.
    - "dst_fold": the local time happened twice (clocks fell back). We take the
      FIRST occurrence (fold=0) and say so — the person may need to confirm.
    """
    tz = ZoneInfo(tz_str)
    local0 = datetime(year, month, day, hour, minute, tzinfo=tz, fold=0)
    local1 = local0.replace(fold=1)
    warnings: list[str] = []
    if local0.utcoffset() != local1.utcoffset():
        # Ambiguous or non-existent: distinguish by round-tripping through UTC.
        roundtrip = local0.astimezone(ZoneInfo("UTC")).astimezone(tz)
        if (roundtrip.hour, roundtrip.minute) != (hour, minute):
            warnings.append("dst_gap")
        else:
            warnings.append("dst_fold")
    utc = local0.astimezone(ZoneInfo("UTC"))
    offset = local0.utcoffset() or timedelta(0)
    return {
        "utc": utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "utc_offset_hours": round(offset.total_seconds() / 3600.0, 4),
        "warnings": warnings,
        "_utc": utc,
    }


def julday_ut(year: int, month: int, day: int, hour: int, minute: int, tz_str: str) -> float:
    """Local civil time -> Julian Day (UT)."""
    utc = resolve_time(year, month, day, hour, minute, tz_str)["_utc"]
    ut_hours = utc.hour + utc.minute / 60.0 + utc.second / 3600.0
    return swe.julday(utc.year, utc.month, utc.day, ut_hours)


def sign_of(lon: float) -> tuple[str, float]:
    lon = lon % 360.0
    idx = int(lon // 30)
    return SIGNS[idx], round(lon - idx * 30, 4)


def _calc(jd: float, body: int, sidereal: bool) -> float:
    flags = FLAGS | (swe.FLG_SIDEREAL if sidereal else 0)
    if sidereal:
        swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
    res, _ = swe.calc_ut(jd, body, flags)
    return res[0] % 360.0


def sun_longitude(jd: float) -> float:
    return _calc(jd, swe.SUN, False)


def moon_longitude(jd: float) -> float:
    return _calc(jd, swe.MOON, False)


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
    system = "placidus"
    try:
        cusps, ascmc = swe.houses_ex(jd, lat, lng, b"P", flag)
    except swe.Error:
        # Placidus is undefined inside the polar circles — fall back honestly.
        cusps, ascmc = swe.houses_ex(jd, lat, lng, b"O", flag)
        system = "porphyry"
    asc, mc = ascmc[0] % 360.0, ascmc[1] % 360.0
    asc_sign, asc_deg = sign_of(asc)
    mc_sign, mc_deg = sign_of(mc)
    return {
        "ascendant": {"lon": round(asc, 4), "sign": asc_sign, "deg_in_sign": asc_deg},
        "midheaven": {"lon": round(mc, 4), "sign": mc_sign, "deg_in_sign": mc_deg},
        "cusps": [round(c % 360.0, 4) for c in cusps[:12]],
        "system": system,
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
