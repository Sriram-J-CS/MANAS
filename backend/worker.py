"""
worker.py - Standalone Asynchronous Background Worker Service for MANAS
─────────────────────────────────────────────────────────────────────────────
Runs independently in a Docker container or background process:
- Consumes jobs from Redis queue (`manas:job_queue`).
- Executes Gemini function calling extraction.
- Dispatches Web Push notifications and executes scheduled tasks.
"""

import sys
import os
import signal
import asyncio
import logging

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.job_queue import run_worker_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (worker) %(name)s: %(message)s"
)
logger = logging.getLogger("manas.worker")

def main():
    logger.info("Initializing standalone MANAS Background Worker...")
    stop_event = asyncio.Event()

    def handle_signal(sig, frame):
        logger.info("Received termination signal %s, shutting down worker...", sig)
        stop_event.set()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        asyncio.run(run_worker_loop(stop_event))
    except (KeyboardInterrupt, SystemExit):
        logger.info("Worker gracefully stopped.")

if __name__ == "__main__":
    main()
