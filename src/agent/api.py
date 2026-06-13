from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse


ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "src" / "data" / "inverter-dashboard.json"

app = FastAPI(title="StealthDetection Agent API")


def read_dashboard() -> dict[str, Any]:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def metric(value: float | int | None, suffix: str = "") -> str:
    if value is None:
        return "n/a"
    return f"{float(value):,.1f}{suffix}" if abs(float(value)) < 1000 else f"{float(value):,.0f}{suffix}"


def compact_context(data: dict[str, Any]) -> dict[str, Any]:
    top_inverters = sorted(data["inverters"], key=lambda row: row.get("lossEUR", 0), reverse=True)[:12]
    return {
        "generatedFrom": data.get("generatedFrom"),
        "assumptions": data.get("assumptions"),
        "summary": data.get("summary"),
        "detection": data.get("detection"),
        "degradation": data.get("degradation"),
        "alerts": data.get("alerts", [])[:12],
        "topInverters": [
            {
                "id": row["id"],
                "status": row["status"],
                "lossEUR": row.get("lossEUR"),
                "lossKWh": row.get("lossKWh"),
                "availability": row.get("availability"),
                "moduleType": row.get("moduleType"),
                "degradationPctYr": row.get("degradationPctYr"),
                "action": row.get("lastAction"),
            }
            for row in top_inverters
        ],
    }


def health_report(data: dict[str, Any]) -> str:
    summary = data["summary"]
    alerts = data.get("alerts", [])
    top_alerts = alerts[:5]
    detection = data.get("detection", {})
    degradation = data.get("degradation", {})

    lines = [
        "StealthDetection health report",
        f"Fleet: {summary['totalInverters']} inverters",
        f"Status: {summary['healthy']} healthy / {summary['watch']} watch / {summary['maintenance']} maintenance",
        f"Revenue: EUR {metric(summary.get('actualRevenueEUR'))}",
        f"Identified losses: EUR {metric(summary.get('totalLossEUR'))} ({metric(summary.get('totalLossKWh', 0) / 1000)} MWh)",
        f"Model quality: {metric((summary.get('medianModelR2') or 0) * 100, '%')} median R2",
        f"Top priority: {summary.get('topPriorityInverter', 'n/a')}",
    ]

    if detection:
        lines.append(
            f"Detection: {detection.get('precision', 'n/a')} precision / {detection.get('recall', 'n/a')} recall"
        )
    if degradation:
        lines.append(f"Fleet degradation median: {degradation.get('fleetMedianPctYr', 'n/a')}%/yr")

    if top_alerts:
        lines.append("")
        lines.append("Top alerts:")
        for alert in top_alerts:
            lines.append(
                f"- {alert.get('timestamp', 'n/a')} | {alert['inverter']} | {alert['severity']} | {alert['message']}"
            )

    return "\n".join(lines)


def fallback_answer(question: str, data: dict[str, Any]) -> str:
    lower = question.lower()
    summary = data["summary"]
    alerts = data.get("alerts", [])

    if "/report" in lower or "report" in lower or "health" in lower:
        return health_report(data)
    if "technician" in lower or "send" in lower or "priority" in lower:
        first = alerts[0] if alerts else None
        if first:
            return (
                f"Send a technician first to {first['inverter']}. "
                f"Reason: {first['message']} Recommended action: {first['action']}"
            )
    if "loss" in lower or "revenue" in lower:
        return (
            f"Identified losses are EUR {metric(summary.get('totalLossEUR'))}, "
            f"equal to {metric(summary.get('totalLossKWh', 0) / 1000)} MWh. "
            f"Actual revenue is EUR {metric(summary.get('actualRevenueEUR'))}."
        )
    return (
        f"Fleet health: {summary['healthy']} healthy, {summary['watch']} watch, "
        f"{summary['maintenance']} maintenance. Top priority is {summary.get('topPriorityInverter', 'n/a')}."
    )


def call_openai(question: str, data: dict[str, Any]) -> str | None:
    api_key = os.getenv("AGENT_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    model = os.getenv("AGENT_MODEL") or os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
    payload = {
        "model": model,
        "input": [
            {
                "role": "system",
                "content": (
                    "You are the StealthDetection solar operations assistant. "
                    "Answer only from the supplied JSON context. Be concise, operational, and cite EUR/kWh/status figures."
                ),
            },
            {
                "role": "user",
                "content": f"Context JSON:\n{json.dumps(compact_context(data))}\n\nQuestion: {question}",
            },
        ],
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            response = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None

    if response.get("output_text"):
        return response["output_text"]
    parts: list[str] = []
    for item in response.get("output", []):
        for content in item.get("content", []):
            text = content.get("text")
            if text:
                parts.append(text)
    return "\n".join(parts) if parts else None


def answer_question(question: str) -> str:
    data = read_dashboard()
    if question.strip().lower().startswith("/report"):
        return health_report(data)
    return call_openai(question, data) or fallback_answer(question, data)


def telegram_send_message(chat_id: int | str, text: str) -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        return
    payload = {
        "chat_id": chat_id,
        "text": text[:3900],
        "disable_web_page_preview": True,
    }
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15):
        pass


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat")
async def chat(request: Request) -> JSONResponse:
    body = await request.json()
    question = (body.get("question") or "").strip()
    if not question:
        return JSONResponse({"answer": "Missing question."}, status_code=400)
    return JSONResponse({"answer": answer_question(question)})


@app.post("/api/telegram/webhook")
async def telegram_webhook(request: Request) -> JSONResponse:
    update = await request.json()
    message = update.get("message") or update.get("edited_message") or {}
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    text = (message.get("text") or "").strip()

    if not chat_id or not text:
        return JSONResponse({"ok": True, "ignored": True})

    if text.startswith("/start"):
        answer = (
            "StealthDetection is online. Ask any plant health question, or send /report "
            "for the current inverter health report."
        )
    elif text.startswith("/report"):
        answer = health_report(read_dashboard())
    else:
        answer = answer_question(text)

    try:
        telegram_send_message(chat_id, answer)
    except urllib.error.URLError as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)

    return JSONResponse({"ok": True})


@app.get("/api/telegram/report")
def telegram_report_preview() -> PlainTextResponse:
    return PlainTextResponse(health_report(read_dashboard()))
