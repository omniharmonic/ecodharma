"""Vercel Python serverless entrypoint for the EcoDharma ephemeris service.

The @vercel/python builder builds every `api/*.py`; this one re-exports the
FastAPI ASGI `app`. vercel.json rewrites all paths here so FastAPI does its own
routing (/charts/*, /healthz) against the original request path. pyswisseph runs
in Moshier mode (no ephemeris data files), so the function is self-contained.
"""
import os
import sys

# The sibling `ephemeris` package lives at the project root (one level above api/).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ephemeris.main import app  # noqa: E402,F401  (ASGI handler discovered by name)
