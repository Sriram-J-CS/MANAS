"""
test_load_bench.py - In-Process Concurrency & Throughput Test for MANAS
───────────────────────────────────────────────────────────────────────
Uses httpx.AsyncClient with ASGITransport directly against FastAPI app.
Validates high concurrency without needing an external web server process.
"""

import pytest
import asyncio
import time
import httpx
from app.main import app

def test_asgi_concurrent_requests():
    """Simulates 20 concurrent requests against /api/status using ASGITransport."""
    async def _run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Warm-up
            res = await client.get("/api/status")
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "operational"

            # 2. 20 concurrent requests
            start_t = time.perf_counter()
            tasks = [client.get("/api/status") for _ in range(20)]
            responses = await asyncio.gather(*tasks)
            elapsed = time.perf_counter() - start_t

            assert len(responses) == 20
            for r in responses:
                assert r.status_code == 200

            rps = 20 / elapsed
            assert rps > 10, f"Expected >10 RPS in-process, got {rps:.1f}"

    asyncio.run(_run())

def test_status_page_html_rendering():
    """Validates that GET /status returns rich HTML dashboard when requested."""
    async def _run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.get("/status", headers={"Accept": "text/html"})
            assert res.status_code == 200
            assert "text/html" in res.headers.get("content-type", "")
            html = res.text
            assert "MANAS Platform Status" in html
            assert "Tele-MANAS" in html
            assert "All Systems Operational" in html

    asyncio.run(_run())
