from __future__ import annotations

import argparse
import json
import logging
import signal

from .core import Settings, WorkerError, event, health_payload
from .runner import STOP, Worker


def on_signal(signum: int, _frame: object) -> None:
    event("signal_received", signal=signum)
    STOP.set()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("command", choices=["check", "ping", "once", "run"])
    args = parser.parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.DEBUG if args.verbose else logging.WARNING)
    signal.signal(signal.SIGTERM, on_signal)
    signal.signal(signal.SIGINT, on_signal)
    try:
        if args.command == "check":
            print(json.dumps(health_payload(), indent=2))
            return 0
        worker = Worker(Settings.load())
        try:
            if args.command == "ping":
                print(json.dumps(worker.api.ping(), indent=2))
            elif args.command == "once":
                print(json.dumps({"processed": worker.once()}, indent=2))
            else:
                worker.run()
            return 0
        finally:
            worker.close()
    except WorkerError as exc:
        event("command_failed", logging.ERROR, error_code=exc.code, message=exc.safe_message)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
