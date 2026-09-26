"""Run the durable notification outbox worker."""

import asyncio
import logging

from app.services.notification_outbox import run_outbox_batch


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("notification-worker")


async def main() -> None:
    logger.info("Notification outbox worker started")
    while True:
        try:
            processed = await run_outbox_batch()
        except Exception:
            logger.exception("Notification outbox batch failed")
            processed = 0
        await asyncio.sleep(0 if processed else 5)


if __name__ == "__main__":
    asyncio.run(main())
