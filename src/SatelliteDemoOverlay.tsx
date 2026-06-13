import { useEffect, useMemo, useState } from "react"
import { Pause, Play, RotateCcw, X, Zap } from "lucide-react"

import dashboardData from "@/data/inverter-dashboard.json"

type InverterStatus = "Healthy" | "Watch" | "Maintenance Required"

interface InverterRow {
  id: string
  status: InverterStatus
  availability: number
  anomalyRate: number
}

interface DemoEvent {
  timestamp: string
  irradiance: number | null
  blinking: string[]
}

const data = dashboardData as unknown as {
  generatedFrom: { periodStart: string; periodEnd: string }
  inverters: InverterRow[]
  demoTimeline: DemoEvent[]
}

const DEMO_CSS = `
@keyframes inverter-blink {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.65); transform: scale(1); }
  50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); transform: scale(1.04); }
}
.inverter-blink { animation: inverter-blink 850ms ease-in-out infinite; }
`

const DOT: Record<InverterStatus, string> = {
  Healthy: "bg-emerald-500",
  Watch: "bg-amber-500",
  "Maintenance Required": "bg-red-500",
}

function shortInverter(id: string) {
  return `#${id.slice(-3)}`
}

function inverterSortId(id: string) {
  return id.replace("INV ", "").split(".").map((part) => Number(part))
}

function compareInverters(a: InverterRow, b: InverterRow) {
  const left = inverterSortId(a.id)
  const right = inverterSortId(b.id)
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i]
  }
  return 0
}

function DemoScene({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const event = data.demoTimeline[index] ?? data.demoTimeline[0]
  const blinking = new Set(event.blinking)
  const inverters = useMemo(() => [...data.inverters].sort(compareInverters), [])
  const activeRows = inverters.filter((inv) => blinking.has(inv.id))
  const irradianceLabel = event.irradiance == null ? "n/a" : `${event.irradiance} W/m2`

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setIndex((value) => (value + 1) % data.demoTimeline.length)
    }, 900)
    return () => window.clearInterval(id)
  }, [playing])

  return (
    <div className="flex h-full w-full flex-col bg-[#f4f8fb] text-zinc-900">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200/80 bg-white/95 px-5 shadow-sm shadow-zinc-200/50">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#003A70]/10 text-[#003A70] ring-1 ring-[#003A70]/10">
          <Zap className="size-5" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-950">stealthdetection.ml demo replay</h2>
          <p className="text-xs font-medium text-zinc-400">
            Full-period digital twin events: {data.generatedFrom.periodStart} to {data.generatedFrom.periodEnd}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setPlaying((value) => !value)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-600 hover:border-[#003A70] hover:text-zinc-900"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => setIndex(0)}
            className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:border-[#003A70] hover:text-zinc-900"
            aria-label="Restart demo"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:border-[#003A70] hover:text-zinc-900"
            aria-label="Close demo"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-0">
        <div className="min-w-0 overflow-y-auto p-6">
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-zinc-200/80 bg-white/95 p-4 shadow-sm shadow-zinc-200/70">
              <p className="text-xs text-zinc-400">Replay timestamp</p>
              <p className="mt-1 text-xl font-semibold text-zinc-950">{event.timestamp}</p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-white/95 p-4 shadow-sm shadow-zinc-200/70">
              <p className="text-xs text-zinc-400">Irradiance</p>
              <p className="mt-1 text-xl font-semibold text-zinc-950">{irradianceLabel}</p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-white/95 p-4 shadow-sm shadow-zinc-200/70">
              <p className="text-xs text-zinc-400">Blinking inverters</p>
              <p className="mt-1 text-xl font-semibold text-zinc-950">{event.blinking.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10 xl:grid-cols-[repeat(13,minmax(0,1fr))]">
            {inverters.map((inv) => {
              const active = blinking.has(inv.id)
              return (
                <div
                  key={inv.id}
                  className={`rounded-lg border p-2.5 transition-all ${
                    active
                      ? "inverter-blink border-red-300 bg-red-50"
                      : inv.status === "Maintenance Required"
                        ? "border-red-100 bg-red-50/60"
                        : inv.status === "Watch"
                          ? "border-amber-100 bg-amber-50/60"
                          : "border-zinc-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold">{shortInverter(inv.id)}</span>
                    <span className={`size-2 shrink-0 rounded-full ${active ? "bg-red-600" : DOT[inv.status]}`} />
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">{inv.availability}% avail.</p>
                </div>
              )
            })}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col border-l border-zinc-200/80 bg-white/95">
          <div className="border-b border-zinc-200 p-4">
            <h3 className="text-sm font-bold">Detected at this moment</h3>
            <p className="text-xs text-zinc-400">Blinking cells mark high-loss digital twin events.</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {activeRows.map((inv) => (
                <div key={inv.id} className="rounded-lg border border-red-100 bg-red-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">{inv.id}</p>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Blinking</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    {inv.anomalyRate}% loss rate. Maintenance relevance should be checked against tickets and error codes.
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-zinc-200 p-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-[#003A70] transition-all"
                style={{ width: `${((index + 1) / data.demoTimeline.length) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Step {index + 1} of {data.demoTimeline.length}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default function SatelliteDemoOverlay() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <style>{DEMO_CSS}</style>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 right-4 z-50 flex items-center gap-1.5 rounded-lg border border-[#003A70] bg-[#003A70] px-3 py-1.5 text-sm font-semibold text-white shadow-sm shadow-[#003A70]/20 transition-all duration-200 hover:bg-[#002B55] hover:shadow-lg hover:shadow-[#003A70]/25"
      >
        <Zap className="size-4 text-white" />
        Demo
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <DemoScene onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  )
}
