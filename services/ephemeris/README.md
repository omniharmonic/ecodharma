# EcoDharma Ephemeris Service

Birth data → structured chart JSON for every modality. **Positions / structural
facts only — no proprietary descriptive text** (the IP boundary lives here). Built
on [`pyswisseph`](https://pypi.org/project/pyswisseph/) with the Moshier ephemeris,
so it needs **no external data files** and is fully self-contained and auditable.

## Endpoints

| Route | Returns |
|---|---|
| `GET  /healthz` | liveness + engine version |
| `POST /charts/western` | tropical natal: positions, houses, aspects |
| `POST /charts/vedic` | sidereal (Lahiri) natal + ayanamsa |
| `POST /charts/human-design` | type, profile, authority, definition, centers, channels, gate/line activations |
| `POST /charts/gene-keys` | activation / venus / pearl sequences (positions only) |
| `POST /charts/synastry` | cross-aspects between two charts |

Request body (`BirthData`): `{year, month, day, hour?, minute?, lat, lng, tz_str, unknown_time?}`.
When `unknown_time` is true, noon is used and `time_dependent_fields` flags what to caveat
(ascendant, houses, Moon — and the entire HD/Gene-Keys output, which is highly time-sensitive).

## Run

```bash
# local (dev)
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn ephemeris.main:app --reload --port 8000

# tests
PYTHONPATH=. python -m pytest tests/ -q

# docker
docker build -t ecodharma-ephemeris .
docker run -p 8000:8000 -e EPHEMERIS_TOKEN=dev-secret ecodharma-ephemeris
```

Optional bearer auth: set `EPHEMERIS_TOKEN`; clients send `Authorization: Bearer <token>`.
If unset (local dev), auth is disabled.

## Human Design wheel — provenance & validation

The gate wheel is anchored on two independently-verified facts: **Gate 25 contains
0° Aries** and **Gate 41 begins at 2° Aquarius (302° ecliptic longitude)**. Each gate
spans 5.625°, each line 0.9375°. The 64-gate order, 9-center gate map (sums to 64), and
36 channels are encoded in `ephemeris/human_design.py` with asserts.

> ⚠️ **Golden Calf:** exact gate/line values should be locked against the reference
> charts from the Golden Calf repo once available (`tests/test_charts.py` has the
> structural + anchor tests; add value-level golden assertions there). The geometry
> is verified; absolute parity with a specific HD provider is pending reference data.
