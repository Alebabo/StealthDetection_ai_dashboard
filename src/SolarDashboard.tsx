import { useMemo, useState } from "react"
import {
  AlertTriangle,
  BellRing,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Globe,
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
  Plug,
  Plus,
  ScrollText,
  Settings,
  Sun,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  X,
  Zap,
} from "lucide-react"
import { FaSlack, FaTelegram, FaWhatsapp } from "react-icons/fa"
import { SiGmail, SiOpenai } from "react-icons/si"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/* ------------------------------------------------------------------ */
/* Brand icon: Claude / Anthropic                                      */
/* ------------------------------------------------------------------ */

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14 5 L24 21.5 H4 Z"
        fill="#f97316"
        stroke="#f97316"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Types & static data                                                 */
/* ------------------------------------------------------------------ */

type Page = "Overview" | "Agents" | "Connectors" | "Knowledge" | "Logs" | "Settings"
type AgentStatus = "Active" | "Idle" | "Error" | "Maintenance"
type AgentFilter = "All" | AgentStatus

const AGENT_ROLES = [
  "Grid Optimizer",
  "Fault Detector",
  "Forecast Agent",
  "Storage Manager",
  "Report Agent",
  "Maintenance Scheduler",
  "Feed-in Monitor",
  "Consumption Analyst",
] as const

interface SolarAgent {
  id: string
  name: string
  role: (typeof AGENT_ROLES)[number]
  status: AgentStatus
  lastAction: string
  lastActive: string
  initials: string
  avatarClass: string
}

const AGENTS: SolarAgent[] = [
  {
    id: "a1",
    name: "Grid Optimizer",
    role: "Grid Optimizer",
    status: "Active",
    lastAction: "Redistributed 12.4 kWh to sector B",
    lastActive: "2 min ago",
    initials: "GO",
    avatarClass: "bg-orange-500/15 text-orange-600",
  },
  {
    id: "a2",
    name: "Fault Detector",
    role: "Fault Detector",
    status: "Error",
    lastAction: "Panel #A7 flagged: output -34%",
    lastActive: "5 min ago",
    initials: "FD",
    avatarClass: "bg-red-500/15 text-red-600",
  },
  {
    id: "a3",
    name: "Forecast Agent",
    role: "Forecast Agent",
    status: "Active",
    lastAction: "Updated: 160 kWh expected tomorrow",
    lastActive: "8 min ago",
    initials: "FA",
    avatarClass: "bg-sky-500/15 text-sky-600",
  },
  {
    id: "a4",
    name: "Storage Manager",
    role: "Storage Manager",
    status: "Active",
    lastAction: "Battery at 78%, holding charge",
    lastActive: "1 min ago",
    initials: "SM",
    avatarClass: "bg-emerald-500/15 text-emerald-600",
  },
  {
    id: "a5",
    name: "Report Agent",
    role: "Report Agent",
    status: "Idle",
    lastAction: "Daily report sent at 06:00",
    lastActive: "3h ago",
    initials: "RA",
    avatarClass: "bg-violet-500/15 text-violet-600",
  },
  {
    id: "a6",
    name: "Maintenance Scheduler",
    role: "Maintenance Scheduler",
    status: "Maintenance",
    lastAction: "Panel cleaning scheduled: June 14",
    lastActive: "22 min ago",
    initials: "MS",
    avatarClass: "bg-amber-500/15 text-amber-600",
  },
  {
    id: "a7",
    name: "Feed-in Monitor",
    role: "Feed-in Monitor",
    status: "Active",
    lastAction: "Feed-in rate stable: 4.2 kW",
    lastActive: "30 sec ago",
    initials: "FM",
    avatarClass: "bg-teal-500/15 text-teal-600",
  },
  {
    id: "a8",
    name: "Consumption Analyst",
    role: "Consumption Analyst",
    status: "Idle",
    lastAction: "Peak demand: 14:30–15:00",
    lastActive: "1h ago",
    initials: "CA",
    avatarClass: "bg-indigo-500/15 text-indigo-600",
  },
]

const STATUS_DOT: Record<AgentStatus, string> = {
  Active: "bg-green-500",
  Idle: "bg-zinc-400",
  Error: "bg-red-500",
  Maintenance: "bg-orange-400",
}

type ConnectorId = "whatsapp" | "telegram" | "slack" | "gmail" | "codex" | "claude"

interface ConnectorDef {
  id: ConnectorId
  name: string
  description: string
  icon: React.ReactNode
}

const CONNECTOR_DEFS: ConnectorDef[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Send solar alerts and daily reports via WhatsApp",
    icon: <FaWhatsapp className="size-7 text-[#25D366]" />,
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Receive agent notifications in Telegram channels",
    icon: <FaTelegram className="size-7 text-[#229ED9]" />,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Post yield summaries and anomaly alerts to Slack",
    icon: <FaSlack className="size-7 text-[#E01E5A]" />,
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Email automated performance reports to stakeholders",
    icon: <SiGmail className="size-7 text-[#EA4335]" />,
  },
  {
    id: "codex",
    name: "Codex",
    description: "Enable agents to write and execute optimization scripts",
    icon: <SiOpenai className="size-7 text-zinc-900" />,
  },
  {
    id: "claude",
    name: "Claude",
    description: "Power agent reasoning and report generation via Claude",
    icon: <ClaudeIcon className="size-7" />,
  },
]

type FileKind = "pdf" | "docx" | "xlsx" | "csv" | "txt" | "md"

interface KnowledgeItem {
  id: string
  name: string
  size: string
  kind: FileKind
  uploaded: string
  status: "Indexed" | "Processing"
  agents: string[]
}

const KNOWLEDGE_ITEMS: KnowledgeItem[] = [
  { id: "k1", name: "solar_panel_specs_2024.pdf", size: "4.2 MB", kind: "pdf", uploaded: "Jun 2, 2026", status: "Indexed", agents: ["FD", "GO"] },
  { id: "k2", name: "maintenance_manual_v3.docx", size: "1.8 MB", kind: "docx", uploaded: "Jun 3, 2026", status: "Indexed", agents: ["MS"] },
  { id: "k3", name: "historical_yield_data.xlsx", size: "12.1 MB", kind: "xlsx", uploaded: "Jun 5, 2026", status: "Indexed", agents: ["FA", "CA"] },
  { id: "k4", name: "grid_regulations_DE.pdf", size: "2.9 MB", kind: "pdf", uploaded: "Jun 7, 2026", status: "Indexed", agents: ["GO", "FM"] },
  { id: "k5", name: "fault_codes_reference.txt", size: "0.3 MB", kind: "txt", uploaded: "Jun 11, 2026", status: "Processing", agents: ["FD"] },
  { id: "k6", name: "weather_api_schema.md", size: "0.1 MB", kind: "md", uploaded: "Jun 9, 2026", status: "Indexed", agents: ["FA"] },
]

const FILE_ICON_CLASS: Record<FileKind, string> = {
  pdf: "bg-red-500/10 text-red-500",
  docx: "bg-blue-500/10 text-blue-500",
  xlsx: "bg-green-500/10 text-green-600",
  csv: "bg-green-500/10 text-green-600",
  txt: "bg-zinc-500/10 text-zinc-500",
  md: "bg-zinc-500/10 text-zinc-500",
}

function FileKindIcon({ kind }: { kind: FileKind }) {
  if (kind === "xlsx" || kind === "csv") return <FileSpreadsheet className="size-4" />
  return <FileText className="size-4" />
}

/* Chart data ------------------------------------------------------- */

const spark = (values: number[]) => values.map((v, i) => ({ i, v }))

const SPARK_AGENTS = spark([7, 8, 8, 8, 7, 8, 8, 8, 8, 8, 8, 8])
const SPARK_YIELD = spark([2, 9, 24, 52, 88, 118, 134, 142, 128, 96, 54, 18])
const SPARK_FEEDIN = spark([5, 9, 14, 22, 31, 40, 48, 55, 63, 70, 79, 87])
const SPARK_ANOMALIES = spark([9, 8, 8, 7, 6, 5, 5, 4, 3, 3, 2, 2])

const WEEK_DATA = [
  { day: "Jun 5", yield: 118, feedIn: 64, consumption: 55 },
  { day: "Jun 6", yield: 131, feedIn: 75, consumption: 58 },
  { day: "Jun 7", yield: 149, feedIn: 92, consumption: 52 },
  { day: "Jun 8", yield: 156, feedIn: 98, consumption: 61 },
  { day: "Jun 9", yield: 84, feedIn: 41, consumption: 57 },
  { day: "Jun 10", yield: 138, feedIn: 82, consumption: 63 },
  { day: "Jun 11", yield: 142.6, feedIn: 87.3, consumption: 59 },
]

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Sparkline({ data }: { data: { i: number; v: number }[] }) {
  return (
    <div className="h-[60px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <Area
            type="monotone"
            dataKey="v"
            stroke="#f97316"
            strokeWidth={2}
            fill="#f97316"
            fillOpacity={0.1}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-zinc-200 bg-zinc-50 text-zinc-600"
    >
      <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
      {status}
    </Badge>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

interface AgentDraft {
  agentId: string | null
  name: string
  role: (typeof AGENT_ROLES)[number]
  description: string
  knowledge: string[]
  connectors: ConnectorId[]
  www: boolean
  wwwMode: "unrestricted" | "whitelist"
  domains: string[]
}

const NAV_ITEMS: { page: Page; icon: React.ElementType }[] = [
  { page: "Overview", icon: LayoutDashboard },
  { page: "Agents", icon: Bot },
  { page: "Connectors", icon: Plug },
  { page: "Knowledge", icon: BookOpen },
  { page: "Logs", icon: ScrollText },
  { page: "Settings", icon: Settings },
]

const TAB_PAGES: Page[] = ["Overview", "Agents", "Connectors", "Knowledge"]

export default function SolarDashboard() {
  const [collapsed, setCollapsed] = useState(false)
  const [page, setPage] = useState<Page>("Overview")
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("All")
  const [dragOver, setDragOver] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)

  const [connectorState, setConnectorState] = useState<
    Record<ConnectorId, { connected: boolean; loading: boolean }>
  >({
    whatsapp: { connected: false, loading: false },
    telegram: { connected: false, loading: false },
    slack: { connected: false, loading: false },
    gmail: { connected: true, loading: false },
    codex: { connected: false, loading: false },
    claude: { connected: true, loading: false },
  })

  const [panelOpen, setPanelOpen] = useState(false)
  const [draft, setDraft] = useState<AgentDraft>(() => makeDraft(null))
  const [domainInput, setDomainInput] = useState("")

  function makeDraft(agent: SolarAgent | null): AgentDraft {
    if (!agent) {
      return {
        agentId: null,
        name: "",
        role: "Grid Optimizer",
        description: "",
        knowledge: [],
        connectors: ["claude"],
        www: false,
        wwwMode: "unrestricted",
        domains: [],
      }
    }
    return {
      agentId: agent.id,
      name: agent.name,
      role: agent.role,
      description: `Autonomous ${agent.role.toLowerCase()} for the SolarOS fleet.`,
      knowledge: KNOWLEDGE_ITEMS.filter((k) => k.agents.includes(agent.initials)).map((k) => k.id),
      connectors: ["claude", "gmail"],
      www: agent.role === "Forecast Agent",
      wwwMode: agent.role === "Forecast Agent" ? "whitelist" : "unrestricted",
      domains: agent.role === "Forecast Agent" ? ["openweathermap.org"] : [],
    }
  }

  function openPanel(agent: SolarAgent | null) {
    setDraft(makeDraft(agent))
    setDomainInput("")
    setPanelOpen(true)
  }

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

  function saveConfiguration() {
    setPanelOpen(false)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 3000)
  }

  function addDomain() {
    const value = domainInput.trim().replace(/,+$/, "")
    if (!value) return
    setDraft((d) =>
      d.domains.includes(value) ? d : { ...d, domains: [...d.domains, value] }
    )
    setDomainInput("")
  }

  const filteredAgents = useMemo(
    () => AGENTS.filter((a) => agentFilter === "All" || a.status === agentFilter),
    [agentFilter]
  )

  const metricCards = useMemo(
    () => [
      {
        label: "Active Agents",
        value: "8 / 8",
        trend: "+1 since yesterday",
        up: true,
        icon: Bot,
        data: SPARK_AGENTS,
      },
      {
        label: "Solar Yield Today",
        value: "142.6 kWh",
        trend: "+18% vs. yesterday",
        up: true,
        icon: Sun,
        data: SPARK_YIELD,
      },
      {
        label: "Grid Feed-in",
        value: "87.3 kWh",
        trend: "+11%",
        up: true,
        icon: Zap,
        data: SPARK_FEEDIN,
      },
      {
        label: "System Anomalies",
        value: "2",
        trend: "-3 vs. yesterday",
        up: false,
        icon: AlertTriangle,
        data: SPARK_ANOMALIES,
      },
    ],
    []
  )

  /* ------------------------------ render --------------------------- */

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      {/* ============================ SIDEBAR ========================= */}
      <aside
        className={`relative flex shrink-0 flex-col border-r border-zinc-200 bg-white transition-all duration-200 ease-in-out ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <Button
          variant="outline"
          size="icon-xs"
          className="absolute top-5 -right-3 z-10 rounded-full border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </Button>

        <div className={`flex h-14 items-center gap-2 border-b border-zinc-200 px-4 ${collapsed ? "justify-center px-0" : ""}`}>
          <Sun className="size-6 shrink-0 text-orange-500" />
          {!collapsed && <span className="text-lg font-bold tracking-tight text-zinc-900">SolarOS</span>}
        </div>

        <nav className="flex-1 space-y-1 py-4">
          {NAV_ITEMS.map(({ page: p, icon: Icon }) => {
            const active = page === p
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`relative flex w-full items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  collapsed ? "justify-center px-0" : ""
                } ${
                  active
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-100/60 hover:text-zinc-900"
                }`}
              >
                {active && (
                  <span className="absolute top-1/2 left-0 h-6 w-0.5 -translate-y-1/2 rounded-r bg-orange-500" />
                )}
                <Icon className={`size-4.5 shrink-0 ${active ? "text-orange-500" : ""}`} />
                {!collapsed && <span>{p}</span>}
              </button>
            )
          })}
        </nav>

        <div className={`flex items-center gap-3 border-t border-zinc-200 p-4 ${collapsed ? "justify-center p-2 py-4" : ""}`}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-xs font-bold text-orange-600">
            AD
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900">Admin</p>
              <p className="truncate text-xs text-zinc-500">Solar Operations</p>
            </div>
          )}
        </div>
      </aside>

      {/* ============================= MAIN =========================== */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white pr-32 pl-6">
          <h1 className="text-lg font-bold text-zinc-900">{page}</h1>
          <div className="flex items-center gap-4">
            <button
              className="relative rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Notifications"
            >
              <BellRing className="size-5" />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-orange-500" />
            </button>
            <div className="flex size-8 items-center justify-center rounded-full bg-orange-500/15 text-xs font-bold text-orange-600">
              AD
            </div>
          </div>
        </header>

        {/* Tab pill navbar */}
        <div className="flex shrink-0 gap-2 px-6 pt-4">
          {TAB_PAGES.map((tab) => (
            <button
              key={tab}
              onClick={() => setPage(tab)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                page === tab
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:ring-1 hover:ring-orange-500"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Page content */}
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {page === "Overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {metricCards.map((m) => (
                  <Card key={m.label} className="gap-3 border-zinc-200 bg-white p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-zinc-500">{m.label}</p>
                        <p className="mt-1 text-3xl font-bold text-zinc-900">{m.value}</p>
                      </div>
                      <div className="rounded-lg bg-orange-500/10 p-2">
                        <m.icon className="size-5 text-orange-500" />
                      </div>
                    </div>
                    <p className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                      {m.up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                      {m.trend}
                    </p>
                    <Sparkline data={m.data} />
                  </Card>
                ))}
              </div>

              <Card className="gap-4 border-zinc-200 bg-white p-5">
                <h2 className="text-base font-semibold text-zinc-900">
                  Energy Overview — Last 7 Days
                </h2>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={WEEK_DATA} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                      <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: "#f97316", fontSize: 12 }}
                        stroke="#e4e4e7"
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#f97316", fontSize: 12 }}
                        stroke="#e4e4e7"
                        tickLine={false}
                        unit=" kWh"
                        width={72}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          border: "1px solid #e4e4e7",
                          borderRadius: "0.5rem",
                          color: "#18181b",
                          fontSize: 12,
                        }}
                        formatter={(value) => [`${value} kWh`]}
                      />
                      <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
                      <Line type="monotone" dataKey="yield" name="Solar Yield" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: "#f97316" }} />
                      <Line type="monotone" dataKey="feedIn" name="Grid Feed-in" stroke="#facc15" strokeWidth={2} dot={{ r: 3, fill: "#facc15" }} />
                      <Line type="monotone" dataKey="consumption" name="Consumption" stroke="#71717a" strokeWidth={2} dot={{ r: 3, fill: "#71717a" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {page === "Agents" && (
            <Card className="gap-0 border-zinc-200 bg-white p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
                <div className="flex flex-wrap gap-2">
                  {(["All", "Active", "Idle", "Error", "Maintenance"] as AgentFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setAgentFilter(f)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
                        agentFilter === f
                          ? "bg-orange-500 text-white shadow-sm shadow-orange-500/25"
                          : "border border-zinc-200 bg-white text-zinc-600 hover:ring-1 hover:ring-orange-500"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <Button onClick={() => openPanel(null)}>
                  <Plus className="size-4" />
                  Deploy Agent
                </Button>
              </div>

              <ScrollArea className="h-[520px]">
                <div className="divide-y divide-zinc-100">
                  {filteredAgents.map((agent) => (
                    <div
                      key={agent.id}
                      onClick={() => openPanel(agent)}
                      className="flex cursor-pointer items-center gap-4 px-4 py-3.5 transition-colors hover:bg-zinc-50"
                    >
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${agent.avatarClass}`}
                      >
                        {agent.initials}
                      </div>
                      <div className="w-56 shrink-0">
                        <p className="truncate text-sm font-bold text-zinc-900">{agent.name}</p>
                        <Badge className="mt-1 bg-zinc-100 text-[10px] text-zinc-600">
                          {agent.role}
                        </Badge>
                      </div>
                      <p className="min-w-0 flex-1 truncate text-sm text-zinc-500">
                        {agent.lastAction}
                      </p>
                      <span className="hidden w-20 shrink-0 text-right text-xs text-zinc-400 lg:block">
                        {agent.lastActive}
                      </span>
                      <StatusBadge status={agent.status} />
                      <span onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-zinc-400 hover:text-zinc-900"
                                aria-label={`Actions for ${agent.name}`}
                              />
                            }
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-36">
                            <DropdownMenuItem>View Logs</DropdownMenuItem>
                            <DropdownMenuItem>Restart</DropdownMenuItem>
                            <DropdownMenuItem>Pause</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPanel(agent)}>
                              Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </span>
                    </div>
                  ))}
                  {filteredAgents.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-16 text-center">
                      <Bot className="size-8 text-zinc-300" />
                      <p className="text-sm text-zinc-500">
                        No agents with status “{agentFilter}” right now.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Card>
          )}

          {page === "Connectors" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Connect your tools</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Link external services to extend your solar agents&apos; communication and
                  data capabilities
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {CONNECTOR_DEFS.map((c) => {
                  const state = connectorState[c.id]
                  return (
                    <Card
                      key={c.id}
                      className={`gap-3 border-zinc-200 bg-white p-5 ${
                        state.connected ? "bg-orange-500/5 ring-1 ring-orange-500/20" : ""
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
                            <Loader2 className="size-4 animate-spin text-orange-500" />
                          </span>
                        ) : (
                          <Switch
                            checked={state.connected}
                            onCheckedChange={(on) => toggleConnector(c.id, on)}
                            aria-label={`Toggle ${c.name} connection`}
                          />
                        )}
                        {state.connected && (
                          <Button variant="ghost" size="sm" className="text-orange-500 hover:text-orange-600">
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

          {page === "Knowledge" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Knowledge Base</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Upload documents and data sources your agents can query
                </p>
              </div>

              <Card
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                }}
                className={`items-center gap-3 border-2 border-dashed bg-white p-8 transition-colors ${
                  dragOver ? "border-orange-500 bg-orange-500/5" : "border-zinc-300"
                }`}
              >
                <UploadCloud className="size-8 text-orange-500" />
                <p className="text-sm font-medium text-zinc-900">
                  Drop files here or click to upload
                </p>
                <p className="text-xs text-zinc-400">
                  Supports PDF, DOCX, TXT, CSV, XLSX, MD — max 50 MB per file
                </p>
                <Button className="mt-1">Upload Files</Button>
              </Card>

              <Card className="gap-0 border-zinc-200 bg-white p-0">
                <div className="flex items-center justify-between border-b border-zinc-200 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900">Documents</h3>
                  <Badge className="bg-zinc-100 text-xs text-zinc-600">
                    21.4 MB / 500 MB used
                  </Badge>
                </div>
                <ScrollArea className="h-[380px]">
                  <div className="divide-y divide-zinc-100">
                    {KNOWLEDGE_ITEMS.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-zinc-50"
                      >
                        <div
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${FILE_ICON_CLASS[item.kind]}`}
                        >
                          <FileKindIcon kind={item.kind} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-zinc-900">{item.name}</p>
                          <p className="text-xs text-zinc-400">{item.size}</p>
                        </div>
                        <span className="hidden text-xs text-zinc-400 md:block">
                          {item.uploaded}
                        </span>
                        {item.status === "Indexed" ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                          >
                            <CheckCircle2 className="size-3" />
                            Indexed
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 border-orange-500/30 bg-orange-500/10 text-orange-600"
                          >
                            <Loader2 className="size-3 animate-spin" />
                            Processing
                          </Badge>
                        )}
                        <div className="hidden gap-1 lg:flex">
                          {item.agents.map((a) => (
                            <span
                              key={a}
                              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-zinc-400 hover:text-zinc-900"
                                aria-label={`Actions for ${item.name}`}
                              />
                            }
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-36">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Re-index</DropdownMenuItem>
                            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            </div>
          )}

          {page === "Logs" && (
            <Card className="items-center gap-3 border-zinc-200 bg-white p-12">
              <ScrollText className="size-8 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-900">Agent activity logs</p>
              <p className="text-xs text-zinc-400">
                Centralized log streaming for all solar agents arrives in the next release.
              </p>
            </Card>
          )}

          {page === "Settings" && (
            <Card className="items-center gap-3 border-zinc-200 bg-white p-12">
              <Settings className="size-8 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-900">Workspace settings</p>
              <p className="text-xs text-zinc-400">
                Plant location, tariff configuration and alert thresholds will be managed here.
              </p>
            </Card>
          )}
        </main>
      </div>

      {/* ==================== AGENT CONFIG PANEL ====================== */}
      <div
        onClick={() => setPanelOpen(false)}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          panelOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-96 transform flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between border-b border-zinc-200 p-5">
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              {draft.name || "New Agent"}
            </h2>
            <p className="text-xs text-zinc-500">Configuration</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-zinc-500 hover:text-zinc-900"
            onClick={() => setPanelOpen(false)}
            aria-label="Close configuration panel"
          >
            <X />
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 p-5">
            {/* Section 1 — General */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-900">General</h3>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-500">Agent Name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Grid Optimizer"
                  className="border-zinc-200 bg-zinc-50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-500">Role</Label>
                <Select
                  value={draft.role}
                  onValueChange={(v) =>
                    setDraft({ ...draft, role: v as (typeof AGENT_ROLES)[number] })
                  }
                >
                  <SelectTrigger className="w-full border-zinc-200 bg-zinc-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-500">Description</Label>
                <Textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="What does this agent manage?"
                  className="border-zinc-200 bg-zinc-50"
                />
              </div>
            </section>

            <Separator className="bg-zinc-200" />

            {/* Section 2 — Knowledge Access */}
            <section className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Knowledge Sources</h3>
                  <p className="text-xs text-zinc-400">
                    Which documents can this agent query?
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  <button
                    className="text-orange-500 transition-colors hover:text-orange-600"
                    onClick={() =>
                      setDraft({ ...draft, knowledge: KNOWLEDGE_ITEMS.map((k) => k.id) })
                    }
                  >
                    Select All
                  </button>
                  <button
                    className="text-zinc-400 transition-colors hover:text-zinc-600"
                    onClick={() => setDraft({ ...draft, knowledge: [] })}
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {KNOWLEDGE_ITEMS.map((item) => {
                  const checked = draft.knowledge.includes(item.id)
                  return (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-zinc-100"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(on) =>
                          setDraft((d) => ({
                            ...d,
                            knowledge: on
                              ? [...d.knowledge, item.id]
                              : d.knowledge.filter((id) => id !== item.id),
                          }))
                        }
                      />
                      <span className={FILE_ICON_CLASS[item.kind].split(" ")[1]}>
                        <FileKindIcon kind={item.kind} />
                      </span>
                      <span className="truncate text-sm text-zinc-700">{item.name}</span>
                    </label>
                  )
                })}
              </div>
            </section>

            <Separator className="bg-zinc-200" />

            {/* Section 3 — Connector Access */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Connector Access</h3>
                <p className="text-xs text-zinc-400">
                  Which integrations can this agent use?
                </p>
              </div>
              <div className="space-y-1">
                {CONNECTOR_DEFS.map((c) => {
                  const globallyConnected = connectorState[c.id].connected
                  const enabled = draft.connectors.includes(c.id)
                  const row = (
                    <div
                      className={`flex items-center justify-between rounded-md px-2 py-2 ${
                        globallyConnected ? "" : "opacity-40"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="[&>svg]:size-5">{c.icon}</span>
                        <span className="text-sm text-zinc-700">{c.name}</span>
                      </span>
                      <Switch
                        checked={enabled && globallyConnected}
                        disabled={!globallyConnected}
                        onCheckedChange={(on) =>
                          setDraft((d) => ({
                            ...d,
                            connectors: on
                              ? [...d.connectors, c.id]
                              : d.connectors.filter((id) => id !== c.id),
                          }))
                        }
                        aria-label={`Allow ${c.name} access`}
                      />
                    </div>
                  )
                  if (globallyConnected) return <div key={c.id}>{row}</div>
                  return (
                    <Tooltip key={c.id}>
                      <TooltipTrigger render={<div className="block w-full" />}>
                        {row}
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        Connect this integration in the Connectors tab first
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </section>

            <Separator className="bg-zinc-200" />

            {/* Section 4 — Web Access */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-900">Internet Access</h3>
              <div className="flex items-center justify-between rounded-md px-2 py-1">
                <span className="flex items-center gap-2.5">
                  <Globe className="size-5 text-zinc-500" />
                  <span className="text-sm text-zinc-700">Allow WWW Access</span>
                </span>
                <Switch
                  checked={draft.www}
                  onCheckedChange={(on) => setDraft({ ...draft, www: on })}
                  aria-label="Allow WWW access"
                />
              </div>

              {draft.www && (
                <div className="space-y-3 pl-2">
                  <RadioGroup
                    value={draft.wwwMode}
                    onValueChange={(v) =>
                      setDraft({ ...draft, wwwMode: v as "unrestricted" | "whitelist" })
                    }
                    className="gap-2"
                  >
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <RadioGroupItem value="unrestricted" />
                      <span className="text-sm text-zinc-700">Unrestricted</span>
                      <span className="text-xs text-zinc-400">— agent can search freely</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <RadioGroupItem value="whitelist" />
                      <span className="text-sm text-zinc-700">Domain Whitelist</span>
                      <span className="text-xs text-zinc-400">— only allowed domains</span>
                    </label>
                  </RadioGroup>

                  {draft.wwwMode === "whitelist" && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={domainInput}
                          onChange={(e) => setDomainInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addDomain()
                          }}
                          placeholder="e.g. pvgis.ec.europa.eu, openweathermap.org"
                          className="border-zinc-200 bg-zinc-50 text-sm"
                        />
                        <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={addDomain}>
                          <Plus className="size-3.5" />
                          Add Domain
                        </Button>
                      </div>
                      {draft.domains.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {draft.domains.map((domain) => (
                            <span
                              key={domain}
                              className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700"
                            >
                              {domain}
                              <button
                                onClick={() =>
                                  setDraft((d) => ({
                                    ...d,
                                    domains: d.domains.filter((x) => x !== domain),
                                  }))
                                }
                                className="text-zinc-400 transition-colors hover:text-zinc-900"
                                aria-label={`Remove ${domain}`}
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Section 5 — Access Summary */}
            <section className="rounded-lg bg-zinc-100 p-3">
              <p className="text-xs font-medium text-zinc-700">This agent has access to:</p>
              <ul className="mt-2 space-y-1.5 text-xs text-zinc-600">
                <li className="flex items-center gap-2">
                  <FileText className="size-3.5 text-orange-500" />
                  {draft.knowledge.length} knowledge file
                  {draft.knowledge.length === 1 ? "" : "s"}
                </li>
                <li className="flex items-center gap-2">
                  <Plug className="size-3.5 text-orange-500" />
                  {
                    draft.connectors.filter((id) => connectorState[id].connected).length
                  }{" "}
                  connectors:
                  <span className="flex items-center gap-1.5 [&>svg]:size-3.5">
                    {CONNECTOR_DEFS.filter(
                      (c) =>
                        draft.connectors.includes(c.id) && connectorState[c.id].connected
                    ).map((c) => (
                      <span key={c.id} className="[&>svg]:size-3.5">
                        {c.icon}
                      </span>
                    ))}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="size-3.5 text-orange-500" />
                  WWW:{" "}
                  {!draft.www
                    ? "No access"
                    : draft.wwwMode === "unrestricted"
                      ? "Unrestricted"
                      : `Whitelist (${draft.domains.length} domain${draft.domains.length === 1 ? "" : "s"})`}
                </li>
              </ul>
            </section>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 border-t border-zinc-200 p-4">
          <Button variant="ghost" className="text-zinc-500 hover:text-zinc-900" onClick={() => setPanelOpen(false)}>
            Cancel
          </Button>
          <Button onClick={saveConfiguration}>Save Configuration</Button>
        </div>
      </div>

      {/* ============================ TOAST =========================== */}
      <div
        className={`fixed right-6 bottom-6 z-[60] flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-xl transition-all duration-300 ${
          toastVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        <CheckCircle2 className="size-4 text-green-500" />
        <span className="text-sm text-zinc-900">Agent configuration saved</span>
      </div>
    </div>
  )
}
