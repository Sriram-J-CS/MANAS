"""
load_test.py - High-Concurrency Distributed Load & Performance Testing for MANAS
─────────────────────────────────────────────────────────────────────────────────
Simulates concurrent user sessions against:
- /api/health
- /api/status
- /api/chat (SSE streaming)

Measures:
- Throughput (Requests Per Second - RPS)
- Latency percentiles: p50 (median), p95, p99, min, max
- Time To First Token (TTFT) on SSE streaming chat
- Rate limiter (HTTP 429) & daily budget responses
- Error rates & connection stability
"""

import sys
import os
import time
import asyncio
import statistics
import argparse
from typing import List, Dict, Any
import httpx

DEFAULT_BASE_URL = os.getenv("TEST_BASE_URL", "http://127.0.0.1:8008")

SAMPLE_PROMPTS = [
    {"message": "I had a productive day today and feeling calm.", "language": "en"},
    {"message": "எனக்கு வேலைப்பளு அதிகமாக உள்ளது, மன அமைதி தேவை.", "language": "ta"},
    {"message": "आज ऑफिस में काम बहुत ज्यादा था, थोड़ा तनाव महसूस हो रहा है।", "language": "hi"},
    {"message": "Can you guide me through a quick breathing exercise?", "language": "en"},
    {"message": "ఈ రోజు పరీక్ష బాగా రాశాను, చాలా సంతోషంగా ఉంది.", "language": "te"},
    {"message": "ನನಗೆ ಇಂದು ನಿದ್ರೆ ಸರಿಯಾಗಿ ಬರಲಿಲ್ಲ, ಆಯಾಸವಾಗಿದೆ.", "language": "kn"},
    {"message": "ഇന്ന് ജോലി കഴിഞ്ഞ് ക്ഷീണം തോന്നുന്നു.", "language": "ml"},
    {"message": "আজকের দিনটা বেশ ভালো কেটেছে।", "language": "bn"},
]

async def execute_request(
    client: httpx.AsyncClient,
    base_url: str,
    endpoint: str,
    user_id: str,
    prompt: Dict[str, str],
    is_stream: bool = False
) -> Dict[str, Any]:
    start_t = time.perf_counter()
    status_code = 0
    ttft = 0.0
    error_msg = None
    bytes_received = 0

    try:
        if endpoint == "/api/health" or endpoint == "/api/status":
            resp = await client.get(f"{base_url}{endpoint}")
            status_code = resp.status_code
            bytes_received = len(resp.content)
        else:
            payload = {
                "user_id": user_id,
                "user_name": f"User_{user_id[-4:]}",
                "message": prompt["message"],
                "language": prompt["language"],
                "age": 22,
                "tone": "gentle"
            }
            if is_stream:
                async with client.stream("POST", f"{base_url}/api/chat", json=payload) as resp:
                    status_code = resp.status_code
                    first_token_recorded = False
                    async for chunk in resp.aiter_bytes():
                        if not first_token_recorded and len(chunk) > 0:
                            ttft = (time.perf_counter() - start_t) * 1000
                            first_token_recorded = True
                        bytes_received += len(chunk)
            else:
                resp = await client.post(f"{base_url}/api/chat", json=payload)
                status_code = resp.status_code
                bytes_received = len(resp.content)
    except Exception as e:
        error_msg = str(e)

    duration_ms = (time.perf_counter() - start_t) * 1000
    return {
        "status_code": status_code,
        "duration_ms": duration_ms,
        "ttft_ms": ttft if is_stream else duration_ms,
        "bytes_received": bytes_received,
        "error": error_msg
    }

async def run_load_benchmark(
    concurrency: int = 10,
    total_requests: int = 50,
    base_url: str = DEFAULT_BASE_URL,
    endpoint: str = "/api/status",
    is_stream: bool = False
) -> Dict[str, Any]:
    print(f"\n🚀 Initializing MANAS Load Benchmark...")
    print(f"Target URL:    {base_url}{endpoint}")
    print(f"Concurrency:   {concurrency} virtual workers")
    print(f"Total Runs:    {total_requests} requests")
    print(f"Streaming SSE: {'Enabled' if is_stream else 'Disabled'}")
    print("=" * 60)

    queue = asyncio.Queue()
    for i in range(total_requests):
        user_id = f"load_test_user_{i % concurrency:03d}"
        prompt = SAMPLE_PROMPTS[i % len(SAMPLE_PROMPTS)]
        queue.put_nowait((user_id, prompt))

    results: List[Dict[str, Any]] = []
    bench_start = time.perf_counter()

    async def worker(worker_id: int):
        limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
        async with httpx.AsyncClient(timeout=30.0, limits=limits) as client:
            while not queue.empty():
                try:
                    user_id, prompt = queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
                res = await execute_request(client, base_url, endpoint, user_id, prompt, is_stream)
                results.append(res)
                queue.task_done()

    workers = [asyncio.create_task(worker(i)) for i in range(concurrency)]
    await asyncio.gather(*workers)
    bench_total_sec = time.perf_counter() - bench_start

    # Metrics computation
    success_count = sum(1 for r in results if 200 <= r["status_code"] < 300)
    rate_limited_count = sum(1 for r in results if r["status_code"] == 429)
    error_count = sum(1 for r in results if r["status_code"] >= 500 or r["error"])
    latencies = [r["duration_ms"] for r in results if r["duration_ms"] > 0]
    ttfts = [r["ttft_ms"] for r in results if r["ttft_ms"] > 0]

    latencies.sort()
    p50 = statistics.median(latencies) if latencies else 0
    p90 = latencies[int(len(latencies) * 0.90)] if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
    p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0
    rps = len(results) / bench_total_sec if bench_total_sec > 0 else 0

    report = {
        "total_requests": len(results),
        "total_duration_sec": round(bench_total_sec, 2),
        "requests_per_second": round(rps, 2),
        "successful_2xx": success_count,
        "rate_limited_429": rate_limited_count,
        "server_errors_5xx": error_count,
        "latency_min_ms": round(min(latencies), 1) if latencies else 0,
        "latency_p50_ms": round(p50, 1),
        "latency_p90_ms": round(p90, 1),
        "latency_p95_ms": round(p95, 1),
        "latency_p99_ms": round(p99, 1),
        "latency_max_ms": round(max(latencies), 1) if latencies else 0,
        "ttft_p50_ms": round(statistics.median(ttfts), 1) if ttfts else 0,
    }

    print("\n📊 Benchmark Results Summary:")
    print(f"  Total Duration:     {report['total_duration_sec']}s")
    print(f"  Throughput (RPS):   {report['requests_per_second']} req/sec")
    print(f"  Successful (2xx):   {report['successful_2xx']} / {report['total_requests']}")
    print(f"  Rate Limited (429): {report['rate_limited_429']}")
    print(f"  Server Errors (5xx):{report['server_errors_5xx']}")
    print(f"  Latency p50:        {report['latency_p50_ms']} ms")
    print(f"  Latency p95:        {report['latency_p95_ms']} ms")
    print(f"  Latency p99:        {report['latency_p99_ms']} ms")
    if is_stream and ttfts:
        print(f"  TTFT p50:           {report['ttft_p50_ms']} ms")
    print("=" * 60)
    return report

def main():
    parser = argparse.ArgumentParser(description="MANAS Concurrent Load Benchmark")
    parser.add_argument("--concurrency", type=int, default=10, help="Number of concurrent virtual users")
    parser.add_argument("--requests", type=int, default=50, help="Total number of requests to execute")
    parser.add_argument("--base-url", type=str, default=DEFAULT_BASE_URL, help="Target backend URL")
    parser.add_argument("--endpoint", type=str, default="/api/status", help="Target API endpoint")
    parser.add_argument("--stream", action="store_true", help="Enable SSE token streaming measurement")
    args = parser.parse_args()

    asyncio.run(
        run_load_benchmark(
            concurrency=args.concurrency,
            total_requests=args.requests,
            base_url=args.base_url,
            endpoint=args.endpoint,
            is_stream=args.stream
        )
    )

if __name__ == "__main__":
    main()
