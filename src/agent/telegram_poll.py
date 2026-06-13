from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from api import answer_question, health_report, read_dashboard, telegram_send_message


def telegram_request(method: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not set.")

    url = f"https://api.telegram.org/bot{token}/{method}"
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=35) as resp:
        return json.loads(resp.read().decode("utf-8"))


def answer_telegram_text(text: str) -> str:
    clean = text.strip()
    if clean.startswith("/start"):
        return (
            "StealthDetection is online. Ask any plant health question, or send /report "
            "for the current inverter health report."
        )
    if clean.startswith("/report"):
        return health_report(read_dashboard())
    return answer_question(clean)


def handle_update(update: dict[str, Any]) -> None:
    message = update.get("message") or update.get("edited_message") or {}
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    text = (message.get("text") or "").strip()

    if not chat_id or not text:
        return

    answer = answer_telegram_text(text)
    telegram_send_message(chat_id, answer)


def main() -> int:
    offset = 0
    print("StealthDetection Telegram bot polling started. Press Ctrl+C to stop.", flush=True)
    telegram_request("deleteWebhook", {"drop_pending_updates": False})

    while True:
        try:
            response = telegram_request(
                "getUpdates",
                {
                    "offset": offset,
                    "timeout": 25,
                    "allowed_updates": ["message", "edited_message"],
                },
            )
            for update in response.get("result", []):
                offset = max(offset, int(update["update_id"]) + 1)
                handle_update(update)
        except KeyboardInterrupt:
            print("Telegram bot polling stopped.", flush=True)
            return 0
        except (urllib.error.URLError, TimeoutError, RuntimeError, json.JSONDecodeError) as exc:
            print(f"Polling error: {exc}", flush=True)
            time.sleep(5)


if __name__ == "__main__":
    raise SystemExit(main())
