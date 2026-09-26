"""Run the durable notification outbox worker."""

import asyncio
import json
import logging
import signal
from datetime import datetime, timezone

from app.database import AsyncSessionLocal
from app.services.notification_outbox import get_outbox_metrics
from app.services.notification_outbox import run_outbox_batch


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("notification-worker")


def log_event(event: str, **fields) -> None:
    logger.info(json.dumps({
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **fields,
    }, default=str, separators=(",", ":")))


async def report_metrics() -> None:
    async with AsyncSessionLocal() as db:
        metrics = await get_outbox_metrics(db)
    log_event("worker_metrics", **metrics)


async def main() -> None:
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for signal_name in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(signal_name, stop.set)
        except (NotImplementedError, RuntimeError):
            pass

    log_event("worker_started")
    last_metrics_at = 0.0
    while not stop.is_set():
        try:
            processed = await run_outbox_batch()
            if processed:
                log_event("outbox_batch_processed", claimed_count=processed)
            now = loop.time()
            if now - last_metrics_at >= 60:
                await report_metrics()
                last_metrics_at = now
        except Exception as error:
            logger.exception(json.dumps({
                "event": "outbox_batch_failed",
                "error_type": type(error).__name__,
            }, separators=(",", ":")))
            processed = 0
        try:
            await asyncio.wait_for(stop.wait(), timeout=0.1 if processed else 5)
        except asyncio.TimeoutError:
            pass
    log_event("worker_stopped")


if __name__ == "__main__":
    asyncio.run(main())
