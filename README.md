# StealthDetection

Enerparc Digital Twins of Solar Plants dashboard for the Energy x AI Hackathon.

## What It Shows

- 65 inverter-level `P_AC (kW)` digital twins trained on Year 1 monitoring data.
- Full-period expected-vs-actual inference across Plant A monitoring data.
- Loss attribution by `curtailment`, `downtime`, `degradation`, and `unclassified`.
- Configurable EUR impact using a flat tariff assumption.
- Technician-priority alerts and a 65-inverter status grid.
- Optional LLM chat grounded on generated analysis summaries.

## Analysis Outputs

Run from the parent `Enerparc` directory:

```powershell
& "C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" .\full_digital_twin_analysis.py
```

Generated files:

- `analysis_outputs/inverter_summary.json`
- `analysis_outputs/monthly_losses.csv`
- `analysis_outputs/loss_events.csv`
- `analysis_outputs/model_metrics.csv`
- `analysis_outputs/assumptions.json`
- `StealthDetection_ai_dashboard/src/data/inverter-dashboard.json`

Important assumption: EUR impact uses a configurable flat tariff, currently `0.075 EUR/kWh`, because no real tariff file is provided.

## Dashboard

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

## Agent, Chat, And Telegram

The chat page calls `POST /api/chat` through the Vite proxy and reads only generated dashboard summary data. It does not read raw `.xlsb` files at runtime.

Start the local agent backend:

```powershell
python -m uvicorn api:app --app-dir src/agent --host 127.0.0.1 --port 8000
```

Set these environment variables on the API server/deployment:

```text
AGENT_API_KEY=...
AGENT_MODEL=gpt-4o-mini
TELEGRAM_BOT_TOKEN=...
```

Telegram webhook endpoint:

```text
POST /api/telegram/webhook
```

For local development without a public webhook URL, run polling instead:

```powershell
$env:TELEGRAM_BOT_TOKEN = Read-Host "Telegram bot token"
python src/agent/telegram_poll.py
```

Or start backend and Telegram polling together:

```powershell
.\scripts\start-agent-and-telegram.ps1
```

Telegram behavior:

- Any normal message is treated as a StealthDetection prompt.
- `/report` returns the current inverter health report.
- `/start` explains how to use the bot.

If no LLM key is configured, chat and Telegram still return deterministic dashboard-summary answers. Never commit real bot tokens; keep them in environment variables.
