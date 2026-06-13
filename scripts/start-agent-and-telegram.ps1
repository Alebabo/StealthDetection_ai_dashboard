$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not $env:TELEGRAM_BOT_TOKEN) {
  $env:TELEGRAM_BOT_TOKEN = Read-Host "Telegram bot token"
}

if (-not $env:AGENT_API_KEY) {
  $agentKey = Read-Host "Agent API key (optional, press Enter for dashboard-only fallback)"
  if ($agentKey) {
    $env:AGENT_API_KEY = $agentKey
  }
}

$backendOut = Join-Path $PWD "agent-backend.out.log"
$backendErr = Join-Path $PWD "agent-backend.err.log"
$telegramOut = Join-Path $PWD "telegram-poll.out.log"
$telegramErr = Join-Path $PWD "telegram-poll.err.log"

$backend = Start-Process -FilePath python -ArgumentList @(
  "-m", "uvicorn", "api:app",
  "--app-dir", "src/agent",
  "--host", "127.0.0.1",
  "--port", "8000"
) -PassThru -WindowStyle Hidden -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr

Start-Sleep -Seconds 2

$poller = Start-Process -FilePath python -ArgumentList @(
  "src/agent/telegram_poll.py"
) -PassThru -WindowStyle Hidden -RedirectStandardOutput $telegramOut -RedirectStandardError $telegramErr

Write-Host "StealthDetection backend started: http://127.0.0.1:8000 (PID $($backend.Id))"
Write-Host "Telegram polling started (PID $($poller.Id))"
Write-Host "Logs: $backendErr, $telegramErr"
