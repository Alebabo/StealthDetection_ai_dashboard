import { useMemo, useState, type ElementType } from "react"
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Grid3X3,
  LayoutDashboard,
  LineChart as LineChartIcon,
  Loader2,
  MessageSquare,
  Plug,
  Send,
  Settings,
  Zap,
} from "lucide-react"
import { FaSlack, FaTelegram } from "react-icons/fa"
import { SiClaude, SiGmail, SiOpenai } from "react-icons/si"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import dashboardData from "@/data/inverter-dashboard.json"
import stealthDetectionLogo from "@/assets/stealthdetection-logo.png"

type Page = "Overview" | "Inverter Grid" | "Alerts" | "Analytics" | "Chat" | "Connectors" | "Settings"
type ConnectorId = "telegram" | "gmail" | "slack" | "claude" | "codex"
type InverterStatus = "Healthy" | "Watch" | "Maintenance Required"
type AlertSeverity = "Critical" | "Warning"
type GridFilter = "All" | InverterStatus
type AlertFilter = "All" | AlertSeverity

interface InverterRow {
  id: string
  status: InverterStatus
  availability: number
  energyMWh: number
  expectedMWh: number
  lossKWh: number
  lossEUR: number
  anomalyRate: number
  curtailmentKWh: number
  downtimeKWh: number
  degradationKWh: number
  unclassifiedKWh: number
  nonzeroErrors: number
  state6Events: number
  lastAction: string
  moduleType?: string
  degradationPctYr?: number | null
}

interface AlertRow {
  inverter: string
  timestamp: string
  severity: AlertSeverity
  title: string
  message: string
  action: string
}

const data = dashboardData as {
  generatedFrom: { periodStart: string; periodEnd: string }
  summary: {
    totalInverters: number
    healthy: number
    watch: number
    maintenance: number
    lastYearEnergyMWh: number
    actualRevenueEUR: number
    totalLossKWh: number
    totalLossEUR: number
    topPriorityInverter: string
    alerts: number
    medianModelR2: number | null
    medianModelMAE: number | null
    baseline: string
  }
  detection: {
    detectedBeforeTicket: number
    ticketsMatched: number
    medianLeadDays: number | null
    ticketsNotYieldRelevant: number
    ticketsAudited: number
    unticketedLossEUR: number
  }
  degradation: {
    fleetMedianPctYr: number
    sensorTrendPctYr: number
    caveat: string
    byModuleType: { moduleType: string; nInverters: number; slopePctYr: number; ciLo: number; ciHi: number }[]
  }
  inverters: InverterRow[]
  alerts: AlertRow[]
  monthly: {
    month: string
    energyMWh: number
    actualMWh?: number
    expectedMWh?: number
    actualRevenueEUR?: number
    lossMWh?: number
    lossEUR?: number
    anomalyEvents: number
  }[]
  pr: { month: string; pr: number; prTempCorrected: number; lossEUR: number; lowCoverage: boolean }[]
}

const NAV_ITEMS: { page: Page; icon: ElementType }[] = [
  { page: "Overview", icon: LayoutDashboard },
  { page: "Inverter Grid", icon: Grid3X3 },
  { page: "Alerts", icon: BellRing },
  { page: "Analytics", icon: LineChartIcon },
  { page: "Chat", icon: MessageSquare },
  { page: "Connectors", icon: Plug },
  { page: "Settings", icon: Settings },
]

const STATUS_STYLES: Record<InverterStatus, string> = {
  Healthy: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  Watch: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  "Maintenance Required": "border-red-500/30 bg-red-500/10 text-red-700",
}

const STATUS_DOT: Record<InverterStatus, string> = {
  Healthy: "bg-emerald-500",
  Watch: "bg-amber-500",
  "Maintenance Required": "bg-red-500",
}

function StatusBadge({ status }: { status: InverterStatus }) {
  return (
    <Badge variant="outline" className={`gap-1.5 ${STATUS_STYLES[status]}`}>
      <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
      {status}
    </Badge>
  )
}

interface ConnectorDef {
  id: ConnectorId
  name: string
  description: string
  icon: React.ReactNode
}

const CONNECTOR_DEFS: ConnectorDef[] = [
  {
    id: "telegram",
    name: "Telegram",
    description: "Receive inverter alerts and daily reports; configure with TELEGRAM_BOT_TOKEN on the server",
    icon: <FaTelegram className="size-7 text-[#229ED9]" />,
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Email automated performance and loss reports to stakeholders",
    icon: <SiGmail className="size-7 text-[#EA4335]" />,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Post yield summaries and anomaly alerts to Slack channels",
    icon: <FaSlack className="size-7 text-[#E01E5A]" />,
  },
  {
    id: "claude",
    name: "Claude",
    description: "Power analysis chat and report generation via Claude",
    icon: <SiClaude className="size-7 text-[#D97757]" />,
  },
  {
    id: "codex",
    name: "Codex",
    description: "Let agents write and run inverter optimization scripts",
    icon: <SiOpenai className="size-7 text-zinc-900" />,
  },
]
function metricLabel(value: number, suffix = "") {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}${suffix}`
}

function shortInverter(id: string) {
  return `#${id.slice(-3)}`
}

function Sparkline({ data, color }: { data: { v: number }[]; color: string }) {
  const gradientId = `spark-${color.replace("#", "")}`
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.75}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  trend,
  trendColor = "#003A70",
}: {
  label: string
  value: string
  helper: string
  icon: ElementType
  trend: { v: number }[]
  trendColor?: string
}) {
  return (
    <Card className="gap-2 border-zinc-200/80 bg-white/95 p-3.5 shadow-sm shadow-zinc-200/70">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        <Icon className="size-3.5 text-zinc-400" />
        {label}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-xl leading-tight font-semibold text-zinc-950">{value}</p>
        <div className="h-9 w-16 shrink-0">
          <Sparkline data={trend} color={trendColor} />
        </div>
      </div>
      <p className="truncate text-[11px] text-zinc-400">{helper}</p>
    </Card>
  )
}

function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
            value === option
              ? "bg-[#003A70] text-white shadow-sm shadow-[#003A70]/20"
              : "border border-zinc-200 bg-white text-zinc-600 hover:ring-1 hover:ring-[#003A70]"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function InverterGrid({ compact = false, inverters = data.inverters }: { compact?: boolean; inverters?: InverterRow[] }) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-5" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-10"}`}>
      {inverters.map((inv) => (
        <div
          key={inv.id}
          className={`rounded-lg border p-2.5 transition-colors ${
            inv.status === "Maintenance Required"
              ? "border-red-200 bg-red-50"
              : inv.status === "Watch"
                ? "border-amber-200 bg-amber-50"
                : "border-zinc-200 bg-white"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-bold text-zinc-900">{shortInverter(inv.id)}</span>
            <span className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[inv.status]}`} />
          </div>
          {!compact && (
            <>
              <p className="mt-2 text-[11px] text-zinc-500">Availability</p>
              <p className="text-sm font-semibold text-zinc-900">{metricLabel(inv.availability, "%")}</p>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function AlertList({ alerts = data.alerts }: { alerts?: AlertRow[] }) {
  return (
    <div className="divide-y divide-zinc-100">
      {alerts.map((alert) => (
        <div key={`${alert.inverter}-${alert.title}-${alert.timestamp}`} className="grid grid-cols-[96px_88px_78px_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-xs">
          <span className="truncate font-mono text-[11px] text-zinc-500">{alert.timestamp}</span>
          <span className="font-semibold text-zinc-900">{alert.inverter}</span>
          <Badge variant="outline" className={`h-5 justify-center px-1.5 text-[10px] ${alert.severity === "Critical" ? STATUS_STYLES["Maintenance Required"] : STATUS_STYLES.Watch}`}>
            {alert.severity}
          </Badge>
          <p className="truncate font-medium text-zinc-800">
            {alert.title} - {alert.message} - {alert.action}
          </p>
        </div>
      ))}
    </div>
  )
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export default function SolarDashboard() {
  const [collapsed, setCollapsed] = useState(false)
  const [page, setPage] = useState<Page>("Overview")
  const [gridFilter, setGridFilter] = useState<GridFilter>("All")
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("All")
  const [chatInput, setChatInput] = useState("Which inverter should a technician inspect first?")
  const [chatLoading, setChatLoading] = useState(false)
  const [modelPreset, setModelPreset] = useState("Digital twin ensemble")
  const [modelSensitivity, setModelSensitivity] = useState(68)
  const [modelWindow, setModelWindow] = useState("Rolling 30 days")
  const [modelSettingsSaved, setModelSettingsSaved] = useState(false)
  const [connectorState, setConnectorState] = useState<
    Record<ConnectorId, { connected: boolean; loading: boolean }>
  >({
    telegram: { connected: false, loading: false },
    gmail: { connected: true, loading: false },
    slack: { connected: false, loading: false },
    claude: { connected: true, loading: false },
    codex: { connected: false, loading: false },
  })

  function toggleConnector(id: ConnectorId, on: boolean) {
    if (!on) {
      setConnectorState((s) => ({ ...s, [id]: { connected: false, loading: false } }))
      return
    }
    setConnectorState((s) => ({ ...s, [id]: { connected: false, loading: true } }))
    setTimeout(() => {
      setConnectorState((s) => ({ ...s, [id]: { connected: true, loading: false } }))
    }, 1500)
  }
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask about inverter priorities, the 2019 plant-wide event, downtime vs curtailment, degradation by module type, ticket relevance, or EUR impact. Every number I give is cited to a specific event, inverter, or ledger table.",
    },
  ])

  const topRisk = useMemo(
    () => [...data.inverters].sort((a, b) => b.anomalyRate - a.anomalyRate).slice(0, 6),
    []
  )
  const categoryTotals = useMemo(
    () =>
      data.inverters.reduce(
        (totals, inv) => ({
          curtailmentKWh: totals.curtailmentKWh + inv.curtailmentKWh,
          downtimeKWh: totals.downtimeKWh + inv.downtimeKWh,
          degradationKWh: totals.degradationKWh + inv.degradationKWh,
          unclassifiedKWh: totals.unclassifiedKWh + inv.unclassifiedKWh,
        }),
        { curtailmentKWh: 0, downtimeKWh: 0, degradationKWh: 0, unclassifiedKWh: 0 }
      ),
    []
  )
  const revenueTrend = useMemo(() => data.monthly.slice(-18), [])
  const prTrend = useMemo(
    () => data.pr.filter((p) => !p.lowCoverage).map((p) => ({ month: p.month, pr: p.pr, lossEUR: p.lossEUR })),
    []
  )
  const revenueSpark = useMemo(
    () => data.monthly.slice(-12).map((m) => ({ v: m.actualRevenueEUR ?? 0 })),
    []
  )
  const lossSpark = useMemo(
    () => data.monthly.slice(-12).map((m) => ({ v: m.lossEUR ?? 0 })),
    []
  )
  const fitSpark = useMemo(
    () =>
      data.monthly
        .slice(-12)
        .map((m) => ({ v: m.expectedMWh ? (m.actualMWh ?? 0) / m.expectedMWh : 0 })),
    []
  )
  const filteredInverters = useMemo(
    () => data.inverters.filter((inv) => gridFilter === "All" || inv.status === gridFilter),
    [gridFilter]
  )
  const filteredAlerts = useMemo(
    () => data.alerts.filter((alert) => alertFilter === "All" || alert.severity === alertFilter),
    [alertFilter]
  )

  async function askChat(question = chatInput) {
    const clean = question.trim()
    if (!clean || chatLoading) return
    setChatInput("")
    setChatMessages((messages) => [...messages, { role: "user", content: clean }])
    setChatLoading(true)
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: clean }),
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Chat endpoint returned ${response.status}`)
      }
      const payload = (await response.json()) as { answer?: string }
      setChatMessages((messages) => [
        ...messages,
        { role: "assistant", content: payload.answer ?? "No answer returned." },
      ])
    } catch {
      setChatMessages((messages) => [
        ...messages,
        {
          role: "assistant",
          content:
            "Chat backend not reachable. Start the grounded agent: `uvicorn api:app --port 8000 --app-dir src/agent` with AGENT_API_KEY set (OpenAI or Kimi). Charts above work without it.",
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f8fb] text-zinc-900">
      <aside className={`relative flex shrink-0 flex-col border-r border-zinc-200/80 bg-white transition-all duration-200 ${collapsed ? "w-16" : "w-64"}`}>
        <Button
          variant="outline"
          size="icon-xs"
          className="absolute top-5 -right-3 z-10 rounded-full border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </Button>

        <div className={`flex h-14 items-center gap-2 border-b border-zinc-200 px-4 ${collapsed ? "justify-center px-0" : ""}`}>
          <img src={stealthDetectionLogo} alt="StealthDetection logo" className="h-8 w-9 shrink-0 object-contain" />
          {!collapsed && (
            <div className="min-w-0">
              <span className="block text-[15px] font-semibold tracking-tight text-zinc-950">StealthDetection</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[#003A70]">Enerparc intelligence</span>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 py-4">
          {NAV_ITEMS.map(({ page: item, icon: Icon }) => {
            const active = page === item
            return (
              <button
                key={item}
                onClick={() => setPage(item)}
                className={`relative flex w-full items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  collapsed ? "justify-center px-0" : ""
                } ${active ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-100/60 hover:text-zinc-900"}`}
              >
                {active && <span className="absolute top-1/2 left-0 h-6 w-0.5 -translate-y-1/2 rounded-r bg-[#003A70]" />}
                <Icon className={`size-4.5 shrink-0 ${active ? "text-[#003A70]" : ""}`} />
                {!collapsed && <span>{item}</span>}
              </button>
            )
          })}
        </nav>

        <div className={`border-t border-zinc-200 p-4 ${collapsed ? "px-2" : ""}`}>
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-zinc-200">
              <img src={stealthDetectionLogo} alt="" className="h-6 w-6 object-contain" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900">Plant A</p>
                <p className="truncate text-xs text-zinc-500">65 inverter fleet</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200/80 bg-white/95 pr-32 pl-7 shadow-sm shadow-zinc-200/50">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">{page}</h1>
          </div>
          <div />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-7">
          {page === "Overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <MetricCard label="Revenue" value={`EUR ${metricLabel(data.summary.actualRevenueEUR)}`} helper="Actual generation at real weekly feed-in tariff" icon={Zap} trend={revenueSpark} trendColor="#008060" />
                  <MetricCard label="Identified losses" value={`EUR ${metricLabel(data.summary.totalLossEUR)}`} helper={`${(data.summary.totalLossEUR / (data.summary.actualRevenueEUR + data.summary.totalLossEUR) * 100).toFixed(1)}% of potential revenue, attributed by cause`} icon={Gauge} trend={lossSpark} trendColor="#ef4444" />
                  <MetricCard label="Model quality" value={data.summary.medianModelR2 == null ? "n/a" : `${metricLabel(data.summary.medianModelR2 * 100, "%")}`} helper="Median validation R2 across twins" icon={AlertTriangle} trend={fitSpark} trendColor="#003A70" />
                </div>
                <Card className="border-zinc-200/80 bg-white/95 p-3.5 shadow-sm shadow-zinc-200/70">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Revenue trend</p>
                      <p className="text-sm font-semibold text-zinc-950">Last 18 months</p>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-700">EUR</Badge>
                  </div>
                  <div className="h-[72px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueTrend} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                        <Area type="monotone" dataKey="actualRevenueEUR" name="Revenue" stroke="#008060" fill="#008060" fillOpacity={0.14} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <Card className="border-[#003A70]/20 bg-[#003A70]/[0.04] p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-2xl font-bold text-[#003A70]">{data.detection.detectedBeforeTicket}/{data.detection.ticketsMatched}</p>
                    <p className="text-xs text-zinc-500">faults caught <span className="font-medium">before</span> the ticket {data.detection.medianLeadDays != null ? `(median ${data.detection.medianLeadDays}d lead)` : ""}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">EUR {metricLabel(data.detection.unticketedLossEUR)}</p>
                    <p className="text-xs text-zinc-500">fault losses with <span className="font-medium">no ticket</span> on record</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{data.detection.ticketsNotYieldRelevant}</p>
                    <p className="text-xs text-zinc-500">tickets with no yield impact (avoidable visits)</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">beyond PR</p>
                    <p className="text-xs text-zinc-500">localizes, attributes & prices what Performance Ratio cannot</p>
                  </div>
                </div>
              </Card>

              <Card className="border-zinc-200/80 bg-white/95 p-5 shadow-sm shadow-zinc-200/70">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-zinc-950">Expected vs actual generation</h2>
                    <p className="text-xs text-zinc-400">Monthly energy and abnormality count from the digital twin analysis</p>
                  </div>
                  <Badge className="bg-zinc-100 text-zinc-600">Digital twin</Badge>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.monthly} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke="#e4e4e7" strokeDasharray="4 4" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#71717a" }} tickMargin={8} />
                      <YAxis yAxisId="energy" tick={{ fontSize: 11, fill: "#71717a" }} width={42} />
                      <YAxis yAxisId="events" orientation="right" tick={{ fontSize: 11, fill: "#71717a" }} width={32} />
                      <RechartsTooltip />
                      <Area yAxisId="energy" type="monotone" dataKey="expectedMWh" name="Expected MWh" stroke="#003A70" fill="#003A70" fillOpacity={0.1} strokeWidth={2} />
                      <Area yAxisId="energy" type="monotone" dataKey="actualMWh" name="Actual MWh" stroke="#008060" fill="#008060" fillOpacity={0.12} strokeWidth={2} />
                      <Area yAxisId="events" type="monotone" dataKey="anomalyEvents" name="Abnormalities" stroke="#ef4444" fill="#ef4444" fillOpacity={0.08} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="border-zinc-200/80 bg-white/95 p-5 shadow-sm shadow-zinc-200/70">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-zinc-950">Highest-risk inverters</h2>
                    <p className="text-xs text-zinc-400">Maintenance queue based on anomaly rate and error states</p>
                  </div>
                  <Button size="sm" onClick={() => setPage("Inverter Grid")}>
                    Open Grid
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {topRisk.map((inv) => (
                    <div key={inv.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-zinc-900">{inv.id}</p>
                          <p className="mt-1 text-xs text-zinc-500">{inv.lastAction}</p>
                        </div>
                        <StatusBadge status={inv.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div><p className="text-zinc-400">Avail.</p><p className="font-semibold">{metricLabel(inv.availability, "%")}</p></div>
                        <div><p className="text-zinc-400">Energy</p><p className="font-semibold">{metricLabel(inv.energyMWh)} MWh</p></div>
                        <div><p className="text-zinc-400">State 6</p><p className="font-semibold">{inv.state6Events}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {page === "Inverter Grid" && (
            <Card className="border-zinc-200/80 bg-white/95 p-5 shadow-sm shadow-zinc-200/70">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-zinc-950">65-inverter status grid</h2>
                  <p className="text-xs text-zinc-400">Green: healthy, amber: watch, red: maintenance required</p>
                </div>
                <FilterPills
                  options={["All", "Healthy", "Watch", "Maintenance Required"]}
                  value={gridFilter}
                  onChange={setGridFilter}
                />
              </div>
              <InverterGrid inverters={filteredInverters} />
            </Card>
          )}

          {page === "Alerts" && (
            <Card className="gap-0 border-zinc-200/80 bg-white/95 p-0 shadow-sm shadow-zinc-200/70">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-zinc-950">Actionable notifications</h2>
                  <p className="text-xs text-zinc-400">Aligned with the transcript: prioritize technician visits by likely yield impact</p>
                </div>
                <FilterPills
                  options={["All", "Critical", "Warning"]}
                  value={alertFilter}
                  onChange={setAlertFilter}
                />
              </div>
              <AlertList alerts={filteredAlerts} />
            </Card>
          )}

          {page === "Analytics" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <Card className="border-zinc-200/80 bg-white/95 p-5 shadow-sm shadow-zinc-200/70">
                <h2 className="text-[15px] font-semibold text-zinc-950">Model vs baseline</h2>
                <div className="mt-4 space-y-3 text-sm text-zinc-600">
                  <p className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />65 inverter-specific P_AC models trained on Year 1.</p>
                  <p className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />Median model R2: {data.summary.medianModelR2 == null ? "n/a" : metricLabel(data.summary.medianModelR2 * 100, "%")}.</p>
                  <p className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />Median MAE: {data.summary.medianModelMAE == null ? "n/a" : `${metricLabel(data.summary.medianModelMAE)} kW`}.</p>
                  <p className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />Baseline comparison: {data.summary.baseline}</p>
                </div>
                <div className="mt-5 border-t border-zinc-100 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-900">Beyond Performance Ratio</p>
                    <Badge className="bg-zinc-100 text-zinc-600">PR {prTrend[0]?.pr.toFixed(2)} → {prTrend[prTrend.length - 1]?.pr.toFixed(2)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">PR shows that the plant declines — not which inverter, why, or the EUR cost.</p>
                  <div className="mt-2 h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={prTrend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid stroke="#e4e4e7" strokeDasharray="4 4" />
                        <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#a1a1aa" }} interval={11} tickMargin={6} />
                        <YAxis domain={[0.4, 0.9]} tick={{ fontSize: 10, fill: "#71717a" }} width={32} />
                        <RechartsTooltip />
                        <Area type="monotone" dataKey="pr" name="Performance Ratio" stroke="#003A70" fill="#003A70" fillOpacity={0.1} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
              <Card className="border-zinc-200/80 bg-white/95 p-5 shadow-sm shadow-zinc-200/70">
                <h2 className="text-[15px] font-semibold text-zinc-950">Degradation overview</h2>
                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-lg bg-zinc-50 p-4 text-center"><p className="text-2xl font-bold text-zinc-900">{metricLabel(categoryTotals.curtailmentKWh / 1000)}</p><p className="text-xs text-zinc-500">Curtailment MWh</p></div>
                  <div className="rounded-lg bg-zinc-50 p-4 text-center"><p className="text-2xl font-bold text-zinc-900">{metricLabel(categoryTotals.downtimeKWh / 1000)}</p><p className="text-xs text-zinc-500">Downtime MWh</p></div>
                  <div className="rounded-lg bg-zinc-50 p-4 text-center"><p className="text-2xl font-bold text-zinc-900">{metricLabel(categoryTotals.degradationKWh / 1000)}</p><p className="text-xs text-zinc-500">Hidden / partial MWh</p></div>
                  <div className="rounded-lg bg-zinc-50 p-4 text-center"><p className="text-2xl font-bold text-zinc-900">{metricLabel(categoryTotals.unclassifiedKWh / 1000)}</p><p className="text-xs text-zinc-500">Unclassified MWh</p></div>
                </div>
                <div className="mt-5 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-zinc-900">Module degradation rate (%/yr)</p>
                    <span className="text-xs text-zinc-400">fleet median {data.degradation.fleetMedianPctYr}%/yr</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {data.degradation.byModuleType.slice(0, 6).map((m) => {
                      const worst = data.degradation.byModuleType[0].slopePctYr
                      const pct = Math.min(100, (m.slopePctYr / worst) * 100)
                      return (
                        <div key={m.moduleType} className="flex items-center gap-2 text-xs">
                          <span className="w-28 shrink-0 truncate text-zinc-600">{m.moduleType} ({m.nInverters})</span>
                          <div className="h-2 flex-1 rounded-full bg-zinc-200">
                            <div className="h-2 rounded-full bg-red-400" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-12 shrink-0 text-right font-mono text-zinc-700">{m.slopePctYr}%</span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-3 text-xs text-amber-700">{data.degradation.caveat}</p>
                </div>
              </Card>
            </div>
          )}

          {page === "Chat" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.55fr]">
              <Card className="flex min-h-[560px] border-zinc-200/80 bg-white/95 p-0 shadow-sm shadow-zinc-200/70">
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="border-b border-zinc-200 p-4">
                    <h2 className="text-[15px] font-semibold text-zinc-950">LLM analysis chat</h2>
                    <p className="text-xs text-zinc-400">Grounded on the analysis tables via read-only tools — every figure is cited, never generated.</p>
                    <p className="mt-2 text-xs text-amber-600">Needs the agent backend running (AGENT_API_KEY; OpenAI or Kimi). Without it, a setup message is shown.</p>
                  </div>
                  <ScrollArea className="min-h-0 flex-1 p-4">
                    <div className="space-y-3">
                      {chatMessages.map((message, index) => (
                        <div
                          key={`${message.role}-${index}`}
                          className={`rounded-lg border p-3 text-sm ${
                            message.role === "user"
                              ? "ml-auto max-w-[80%] border-[#003A70]/20 bg-[#003A70]/5 text-zinc-900"
                              : "max-w-[86%] border-zinc-200 bg-zinc-50 text-zinc-700"
                          }`}
                        >
                          {message.content}
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <Loader2 className="size-4 animate-spin" />
                          Thinking over analysis summaries...
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  <div className="border-t border-zinc-200 p-4">
                    <div className="flex gap-2">
                      <Textarea
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            void askChat()
                          }
                        }}
                        className="min-h-20 resize-none border-zinc-200 bg-white text-sm"
                        placeholder="Ask: Which inverter underperforms the most?"
                      />
                      <Button className="h-20 w-20 shrink-0" onClick={() => void askChat()} disabled={chatLoading}>
                        {chatLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="border-zinc-200/80 bg-white/95 p-5 shadow-sm shadow-zinc-200/70">
                <h2 className="text-[15px] font-semibold text-zinc-950">Suggested questions</h2>
                <div className="mt-4 space-y-2">
                  {[
                    "Which inverter lost the most money in 2019 and why?",
                    "Where should we send a technician first?",
                    "Which module type degrades fastest?",
                    "Are any tickets not actually relevant to yield?",
                  ].map((question) => (
                    <button
                      key={question}
                      onClick={() => void askChat(question)}
                      className="block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:border-[#003A70] hover:bg-white"
                    >
                      {question}
                    </button>
                  ))}
                </div>
                <div className="mt-5 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
                  Backend: <span className="font-mono">src/agent/api.py</span> (FastAPI, 8 read-only tools over the ledger). Provider-agnostic — set AGENT_API_KEY for OpenAI or Kimi.
                </div>
              </Card>
            </div>
          )}

          {page === "Connectors" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Connect your tools</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Link external services to extend how the dashboard reports inverter alerts and analysis
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {CONNECTOR_DEFS.map((c) => {
                  const state = connectorState[c.id]
                  return (
                    <Card
                      key={c.id}
                      className={`gap-3 border-zinc-200 bg-white p-5 ${
                        state.connected ? "bg-[#003A70]/5 ring-1 ring-[#003A70]/20" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        {c.icon}
                        {state.connected ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                          >
                            <CheckCircle2 className="size-3" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-zinc-200 bg-zinc-50 text-zinc-500"
                          >
                            Not connected
                          </Badge>
                        )}
                      </div>
                      <div>
                        <p className="text-base font-bold text-zinc-900">{c.name}</p>
                        <p className="mt-1 text-sm text-zinc-500">{c.description}</p>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        {state.loading ? (
                          <span className="flex h-[18.4px] items-center">
                            <Loader2 className="size-4 animate-spin text-[#003A70]" />
                          </span>
                        ) : (
                          <Switch
                            checked={state.connected}
                            onCheckedChange={(on) => toggleConnector(c.id, on)}
                            aria-label={`Toggle ${c.name} connection`}
                          />
                        )}
                        {state.connected && (
                          <Button variant="ghost" size="sm" className="text-[#003A70] hover:text-[#002B55]">
                            Configure
                          </Button>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {page === "Settings" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="border-zinc-200/80 bg-white/95 p-5 shadow-sm shadow-zinc-200/70">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[15px] font-semibold text-zinc-950">Model settings</h2>
                    <p className="mt-1 text-xs text-zinc-500">Presentation controls only; the trained models and analysis data stay unchanged.</p>
                  </div>
                  <Badge className="bg-zinc-100 text-zinc-600">Simulation</Badge>
                </div>

                <div className="mt-5 space-y-5">
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Model</span>
                    <select
                      value={modelPreset}
                      onChange={(event) => {
                        setModelPreset(event.target.value)
                        setModelSettingsSaved(false)
                      }}
                      className="mt-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 outline-none ring-[#003A70]/20 focus:ring-2"
                    >
                      <option>Digital twin ensemble</option>
                      <option>High sensitivity anomaly model</option>
                      <option>Conservative maintenance model</option>
                      <option>Revenue-first dispatch model</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Sensitivity</span>
                      <span className="font-mono text-xs text-zinc-500">{modelSensitivity}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={modelSensitivity}
                      onChange={(event) => {
                        setModelSensitivity(Number(event.target.value))
                        setModelSettingsSaved(false)
                      }}
                      className="mt-3 w-full accent-[#003A70]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Detection window</span>
                    <select
                      value={modelWindow}
                      onChange={(event) => {
                        setModelWindow(event.target.value)
                        setModelSettingsSaved(false)
                      }}
                      className="mt-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 outline-none ring-[#003A70]/20 focus:ring-2"
                    >
                      <option>Rolling 7 days</option>
                      <option>Rolling 30 days</option>
                      <option>Rolling 90 days</option>
                      <option>Full analysis period</option>
                    </select>
                  </label>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setModelSettingsSaved(true)
                      }}
                    >
                      Save view
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setModelPreset("Digital twin ensemble")
                        setModelSensitivity(68)
                        setModelWindow("Rolling 30 days")
                        setModelSettingsSaved(false)
                      }}
                    >
                      Reset
                    </Button>
                    {modelSettingsSaved && <span className="text-xs font-medium text-emerald-700">View settings saved</span>}
                  </div>
                </div>
              </Card>

              <Card className="border-zinc-200/80 bg-white/95 p-5 shadow-sm shadow-zinc-200/70">
                <h2 className="text-[15px] font-semibold text-zinc-950">Current model profile</h2>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-zinc-50 p-4">
                    <p className="text-xs text-zinc-500">Selected model</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900">{modelPreset}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4">
                    <p className="text-xs text-zinc-500">Sensitivity</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900">{modelSensitivity}%</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4">
                    <p className="text-xs text-zinc-500">Window</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900">{modelWindow}</p>
                  </div>
                </div>
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  These controls are intentionally non-destructive. They change the displayed configuration state only and do not retrain, reload, or overwrite the inverter models.
                </div>
                <div className="mt-5 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
                  <p className="font-medium text-zinc-900">Active production model</p>
                  <p className="mt-1">65 inverter digital twins trained on Year 1 monitoring data.</p>
                  <p className="mt-2 text-xs text-zinc-400">
                    Median R2 {data.summary.medianModelR2 == null ? "n/a" : metricLabel(data.summary.medianModelR2 * 100, "%")} · Median MAE {data.summary.medianModelMAE == null ? "n/a" : `${metricLabel(data.summary.medianModelMAE)} kW`}
                  </p>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
