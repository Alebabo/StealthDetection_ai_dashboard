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

## LLM Chat

The chat page calls `POST /api/chat` and reads only the generated dashboard summary data. It does not read raw `.xlsb` files at runtime.

Set this environment variable on the API server/deployment:

```text
OPENAI_API_KEY=...
```

Optional:

```text
OPENAI_MODEL=gpt-4o-mini
```

If no API key is configured, the chat UI shows a disabled/fallback message.
