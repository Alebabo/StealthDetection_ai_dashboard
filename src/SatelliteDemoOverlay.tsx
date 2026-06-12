import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, RotateCcw, X, Zap } from "lucide-react"

/* ------------------------------------------------------------------ */
/* Timeline (ms from overlay open)                                     */
/*   Phase 0      0–1500   Satellite lock (HUD typewriter + capture)   */
/*   Phase 1   1500–3500   Full area scan sweep                        */
/*   Phase 2   3500–6000   Roof detection B1–B8                        */
/*   Phase 3   6000–10000  Panel placement on suitable roofs           */
/*   Phase 4  10000–12500  Irradiance heatmap                          */
/*   Phase 5  12500–14000  Shadow & obstruction scan                   */
/*   Phase 6  14000–16000  Final report                                */
/* ------------------------------------------------------------------ */

const END_AT = 16500

const HUD_LINES = [
  "CONNECTING TO SATELLITE...",
  "SIGNAL ACQUIRED — SAT-7 HELIO",
  "RESOLUTION: 0.3m/px",
  "COORDINATES: 48.1351° N, 11.5820° E",
  "AREA: 2.4 km²",
  "INITIALIZING SCAN SEQUENCE...",
]
const HUD_LINE_GAP = 200
const HUD_CHAR_MS = 14
const FLASH_AT = 1250
const IMAGE_AT = 1400
const SCAN_FROM = 1500
const SCAN_TO = 3500
const DETECT_FROM = 3500
const DETECT_STEP = 250
const IDENTIFIED_AT = 5600
const PLACE_STAGGER = 45
const HEAT_AT = 10000
const SHADOW_AT = 12500
const REPORT_AT = 14000

type Rating = "excellent" | "good" | "limited"

interface Building {
  id: string
  x: number
  y: number
  w: number
  h: number
  rot: number
  fill: string
  details: { x: number; y: number; w: number; h: number }[]
  rating: Rating
  label: string
  placeStart?: number
  shaded?: number[]
}

/* Satellite scene is a fixed 800x600 viewBox — all coordinates hardcoded */
const BUILDINGS: Building[] = [
  {
    id: "B1", x: 60, y: 40, w: 120, h: 90, rot: -2, fill: "#2e2e38",
    details: [{ x: 78, y: 56, w: 16, h: 10 }, { x: 142, y: 100, w: 14, h: 12 }],
    rating: "excellent", label: "B1 — 138m² — 5° — South", placeStart: 6000,
  },
  {
    id: "B2", x: 320, y: 50, w: 70, h: 90, rot: 3, fill: "#32323e",
    details: [{ x: 330, y: 60, w: 9, h: 9 }],
    rating: "good", label: "B2 — 96m² — 30° — South-East", placeStart: 7200, shaded: [0, 1, 3],
  },
  {
    id: "B3", x: 610, y: 60, w: 130, h: 95, rot: 0, fill: "#28283a",
    details: [{ x: 700, y: 74, w: 18, h: 14 }],
    rating: "excellent", label: "B3 — 124m² — 15° — South-SW", placeStart: 7900,
  },
  {
    id: "B4", x: 90, y: 200, w: 60, h: 80, rot: 8, fill: "#32323e",
    details: [],
    rating: "limited", label: "B4 — 64m² — 42° — North",
  },
  {
    id: "B5", x: 330, y: 210, w: 120, h: 85, rot: -1, fill: "#2e2e38",
    details: [{ x: 344, y: 222, w: 20, h: 13 }],
    rating: "good", label: "B5 — 112m² — 8° — South-West", placeStart: 8800, shaded: [0, 1, 6, 7],
  },
  {
    id: "B6", x: 640, y: 230, w: 55, h: 75, rot: -6, fill: "#28283a",
    details: [],
    rating: "limited", label: "B6 — 58m² — 38° — North-East",
  },
  {
    id: "B7", x: 350, y: 430, w: 140, h: 100, rot: 2, fill: "#2e2e38",
    details: [{ x: 366, y: 444, w: 16, h: 12 }, { x: 452, y: 500, w: 18, h: 12 }],
    rating: "good", label: "B7 — 142m² — 6° — South", placeStart: 9500, shaded: [0, 1, 7, 8],
  },
  {
    id: "B8", x: 620, y: 430, w: 65, h: 85, rot: -4, fill: "#32323e",
    details: [{ x: 632, y: 442, w: 10, h: 10 }],
    rating: "limited", label: "B8 — 72m² — 35° — North-West",
  },
]

const RATING_COLOR: Record<Rating, string> = {
  excellent: "#4ade80",
  good: "#fb923c",
  limited: "#71717a",
}

/* Cells of the 8x6 HUD grid that flash as the scan line passes their row */
const FLASH_CELLS: [number, number][] = [
  [1, 0], [5, 0], [3, 1], [7, 1], [0, 2], [4, 2], [6, 3], [2, 3], [5, 4], [1, 5],
]
const cellFlashAt = ([, row]: [number, number]) =>
  SCAN_FROM + ((row + 0.5) * 100 / 600) * (SCAN_TO - SCAN_FROM)

/* Shadow / obstruction zones (phase 5) */
const SHADOW_ZONES = [
  { id: "s1", points: "326,58 352,62 356,92 330,96", badge: [358, 52] as const },
  { id: "s2", points: "338,216 372,220 368,254 336,250", badge: [300, 206] as const },
  { id: "s3", points: "352,432 396,436 390,470 354,466", badge: [310, 424] as const },
]

/* Agent edge labels + the building they link to (phase 6) */
const AGENT_LINKS = [
  { name: "Fault Detector", color: "#f97316", chip: [120, 170] as const, to: [355, 95] as const },
  { name: "Forecast Agent", color: "#eab308", chip: [120, 330] as const, to: [120, 85] as const },
  { name: "Storage Manager", color: "#22c55e", chip: [140, 375] as const, to: [390, 252] as const },
  { name: "Grid Optimizer", color: "#3b82f6", chip: [660, 200] as const, to: [675, 107] as const },
  { name: "Report Agent", color: "#71717a", chip: [620, 375] as const, to: [420, 480] as const },
]

/* Right-zone message feed */
interface DemoMessage {
  at: number
  agent: string
  nameClass: string
  initials: string
  avatarClass: string
  text: string
  system?: boolean
}

const MESSAGES: DemoMessage[] = [
  { at: 300, agent: "System", nameClass: "text-zinc-400", initials: "OS", avatarClass: "bg-zinc-200 text-zinc-500", system: true, text: "Demo scenario: Munich residential district. Activating scan agents." },
  { at: 1800, agent: "Fault Detector", nameClass: "text-orange-600", initials: "FD", avatarClass: "bg-orange-500/15 text-orange-600", text: "Satellite connection established. Beginning roof topology scan across 2.4 km² zone." },
  { at: 3200, agent: "Fault Detector", nameClass: "text-orange-600", initials: "FD", avatarClass: "bg-orange-500/15 text-orange-600", text: "Scan complete. Structural analysis running. Filtering rooftops from vegetation and roads." },
  { at: 4100, agent: "Fault Detector", nameClass: "text-orange-600", initials: "FD", avatarClass: "bg-orange-500/15 text-orange-600", text: "8 building rooftops identified. Extracting pitch, orientation and area from elevation data." },
  { at: 5500, agent: "Grid Optimizer", nameClass: "text-blue-600", initials: "GO", avatarClass: "bg-blue-500/15 text-blue-600", text: "Rooftop B3 (124m², south-southwest, 15°) flagged as primary installation candidate." },
  { at: 6200, agent: "Forecast Agent", nameClass: "text-yellow-600", initials: "FA", avatarClass: "bg-yellow-500/15 text-yellow-600", text: "Querying irradiance database for coordinates 48.13°N. Historical solar data: 1,186 kWh/m²/year." },
  { at: 7400, agent: "Storage Manager", nameClass: "text-green-600", initials: "SM", avatarClass: "bg-green-500/15 text-green-600", text: "Calculating optimal panel layout for B1, B2, B3, B5, B7. Maximizing density within setback constraints." },
  { at: 8800, agent: "Fault Detector", nameClass: "text-orange-600", initials: "FD", avatarClass: "bg-orange-500/15 text-orange-600", text: "Panel placement complete: 186 modules across 5 rooftops. Estimated peak capacity: 62.4 kWp." },
  { at: 10300, agent: "Forecast Agent", nameClass: "text-yellow-600", initials: "FA", avatarClass: "bg-yellow-500/15 text-yellow-600", text: "Irradiance overlay applied. South-facing surfaces averaging 1,210 kWh/m²/year. North facades: 680." },
  { at: 12000, agent: "Fault Detector", nameClass: "text-orange-600", initials: "FD", avatarClass: "bg-orange-500/15 text-orange-600", text: "Shadow obstruction detected: chimney stack B2, rooftop unit B5, neighboring structure B7-NW edge." },
  { at: 12800, agent: "Grid Optimizer", nameClass: "text-blue-600", initials: "GO", avatarClass: "bg-blue-500/15 text-blue-600", text: "Obstruction adjustment: removing 11 shaded panels. Net capacity revised to 58.7 kWp." },
  { at: 13800, agent: "Report Agent", nameClass: "text-zinc-500", initials: "RA", avatarClass: "bg-zinc-200 text-zinc-600", text: "Compiling site analysis report. CO₂ offset: 23.4 t/year. Payback period est.: 8.2 years." },
  { at: 14500, agent: "Storage Manager", nameClass: "text-green-600", initials: "SM", avatarClass: "bg-green-500/15 text-green-600", text: "Recommending 48 kWh battery storage to capture afternoon surplus. Self-consumption rate: +34%." },
  { at: 15200, agent: "System", nameClass: "text-zinc-400", initials: "OS", avatarClass: "bg-zinc-200 text-zinc-500", system: true, text: "Analysis complete. All agents synchronized. Report ready for export." },
]

const PROGRESS_PHASES = [
  { label: "Connecting", from: 0 },
  { label: "Scanning", from: SCAN_FROM },
  { label: "Detection", from: DETECT_FROM },
  { label: "Placement", from: 6000 },
  { label: "Analysis", from: HEAT_AT },
  { label: "Complete", from: REPORT_AT },
]

const fakeClock = (at: number) =>
  `14:02:${String(Math.floor(at / 1000)).padStart(2, "0")}`

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

interface PanelRect {
  x: number
  y: number
}

function panelGrid(b: Building): PanelRect[] {
  const inset = 9
  const pw = 14
  const ph = 20
  const gap = 3
  const cols = Math.floor((b.w - inset * 2 + gap) / (pw + gap))
  const rows = Math.floor((b.h - inset * 2 + gap) / (ph + gap))
  const ox = b.x + (b.w - (cols * (pw + gap) - gap)) / 2
  const oy = b.y + (b.h - (rows * (ph + gap) - gap)) / 2
  const rects: PanelRect[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rects.push({ x: ox + c * (pw + gap), y: oy + r * (ph + gap) })
    }
  }
  return rects
}

const PANEL_GRIDS = new Map(
  BUILDINGS.filter((b) => b.placeStart != null).map((b) => [b.id, panelGrid(b)])
)
const TOTAL_VISUAL_PANELS = [...PANEL_GRIDS.values()].reduce((n, g) => n + g.length, 0)

function placedCount(b: Building, elapsed: number) {
  const grid = PANEL_GRIDS.get(b.id)
  if (!grid || b.placeStart == null || elapsed < b.placeStart) return 0
  return Math.min(grid.length, Math.floor((elapsed - b.placeStart) / PLACE_STAGGER) + 1)
}

/* ------------------------------------------------------------------ */
/* Injected keyframes (self-contained component)                       */
/* ------------------------------------------------------------------ */

const DEMO_CSS = `
@keyframes sat-sweep { from { height: 0%; } to { height: 100%; } }
@keyframes sat-flash-white { 0% { opacity: 0; } 50% { opacity: 0.15; } 100% { opacity: 0; } }
@keyframes sat-cell-flash { 0% { opacity: 0.45; } 100% { opacity: 0; } }
@keyframes sat-cross { from { transform: scale(2); opacity: 1; } to { transform: scale(1); opacity: 0.6; } }
@keyframes sat-draw { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
@keyframes sat-badge { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes sat-panel { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
@keyframes sat-dash { to { stroke-dashoffset: -24; } }
@keyframes sat-flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.9; } }
@keyframes sat-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes sat-progress { from { width: 0%; } to { width: 100%; } }
.sat-sweep {
  animation: sat-sweep ${SCAN_TO - SCAN_FROM}ms linear forwards;
  backdrop-filter: blur(0.5px) grayscale(20%);
  background: rgba(249, 115, 22, 0.04);
  border-bottom: 2px solid rgba(251, 146, 60, 0.9);
  box-shadow: 0 1px 14px rgba(251, 146, 60, 0.7);
}
.sat-flash-white { animation: sat-flash-white 300ms ease-out forwards; }
.sat-cell-flash { animation: sat-cell-flash 150ms ease-out forwards; }
.sat-cross { animation: sat-cross 600ms ease-out forwards; transform-box: fill-box; transform-origin: center; }
.sat-draw { stroke-dasharray: 100; animation: sat-draw 400ms ease-out forwards; }
.sat-badge { animation: sat-badge 350ms ease-out both; }
.sat-panel { animation: sat-panel 300ms ease-out both; transform-box: fill-box; transform-origin: center; }
.sat-dash { animation: sat-dash 900ms linear infinite; }
.sat-flicker { animation: sat-flicker 2s ease-in-out infinite; }
.sat-slide-up { animation: sat-slide-up 500ms cubic-bezier(0.34, 1.4, 0.64, 1) forwards; }
.sat-progress { animation: sat-progress ${END_AT}ms linear forwards; }
.sat-legend-bar { background: linear-gradient(to right, #1a237e, #00bcd4, #ffeb3b, #ff9800, #f44336); }
`

/* ------------------------------------------------------------------ */
/* Scene sub-pieces                                                    */
/* ------------------------------------------------------------------ */

function HudTypewriter({ elapsed }: { elapsed: number }) {
  const lines = HUD_LINES.map((line, i) => {
    const start = i * HUD_LINE_GAP
    if (elapsed < start) return null
    const chars = Math.min(line.length, Math.floor((elapsed - start) / HUD_CHAR_MS))
    return line.slice(0, chars)
  }).filter((l): l is string => l !== null && l.length > 0)
  return (
    <>
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </>
  )
}

function hudOperation(elapsed: number): string {
  if (elapsed >= REPORT_AT) return "SITE ANALYSIS COMPLETE — REPORT READY"
  if (elapsed >= SHADOW_AT) return "OBSTRUCTION DETECTION: 3 ZONES FLAGGED"
  if (elapsed >= HEAT_AT) return "IRRADIANCE ANALYSIS COMPLETE — AVG: 1,186 kWh/m²/year"
  if (elapsed >= 6000) return "PLACING PV MODULES — OPTIMIZING LAYOUT..."
  if (elapsed >= IDENTIFIED_AT) return "8 ROOFTOPS IDENTIFIED — ANALYZING SOLAR POTENTIAL..."
  if (elapsed >= DETECT_FROM) return "ROOF DETECTION ACTIVE — ISOLATING STRUCTURES..."
  return "SCANNING SECTOR GRID..."
}

function BuildingLayer({ b, elapsed }: { b: Building; elapsed: number }) {
  const idx = BUILDINGS.indexOf(b)
  const detectAt = DETECT_FROM + idx * DETECT_STEP
  const detected = elapsed >= detectAt
  const crosshair = detected && elapsed < detectAt + 700
  const badge = elapsed >= detectAt + 300
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const grid = PANEL_GRIDS.get(b.id)
  const placed = placedCount(b, elapsed)
  const allPlaced = grid != null && placed >= grid.length
  const shadowsOn = elapsed >= SHADOW_AT

  const badgeWidth = b.label.length * 5.3 + 18

  return (
    <g>
      {/* Rotated rooftop group: footprint, details, outline, panels */}
      <g transform={`rotate(${b.rot} ${cx} ${cy})`}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={b.fill} filter="url(#sat-bshadow)" />
        {b.details.map((d, i) => (
          <rect key={i} x={d.x} y={d.y} width={d.w} height={d.h} fill="#3a3a44" />
        ))}

        {detected && (
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={2}
            fill="none"
            stroke="#fb923c"
            strokeWidth={2}
            pathLength={100}
            className="sat-draw"
          />
        )}

        {grid?.slice(0, placed).map((p, i) => {
          const shaded = shadowsOn && b.shaded?.includes(i)
          return (
            <g key={i} className="sat-panel" opacity={shaded ? 0.5 : 1}>
              <rect x={p.x} y={p.y} width={14} height={20} fill="#1e2d4a" stroke="#3a5070" strokeWidth={1} />
              <line x1={p.x + 7} y1={p.y} x2={p.x + 7} y2={p.y + 20} stroke="#2a3d5e" strokeWidth={0.8} />
              <line x1={p.x} y1={p.y + 10} x2={p.x + 14} y2={p.y + 10} stroke="#2a3d5e" strokeWidth={0.8} />
              {shaded && <rect x={p.x} y={p.y} width={14} height={20} fill="#ef4444" opacity={0.35} />}
            </g>
          )
        })}
      </g>

      {/* Crosshair */}
      {crosshair && (
        <g className="sat-cross" stroke="#fb923c" strokeWidth={1.5} fill="none">
          <circle cx={cx} cy={cy} r={16} />
          <line x1={cx - 24} y1={cy} x2={cx - 8} y2={cy} />
          <line x1={cx + 8} y1={cy} x2={cx + 24} y2={cy} />
          <line x1={cx} y1={cy - 24} x2={cx} y2={cy - 8} />
          <line x1={cx} y1={cy + 8} x2={cx} y2={cy + 24} />
        </g>
      )}

      {/* Detection badge */}
      {badge && (
        <g className="sat-badge" transform={`translate(${cx} ${b.y - 14})`}>
          <rect
            x={-badgeWidth / 2}
            y={-11}
            width={badgeWidth}
            height={17}
            rx={4}
            fill="rgba(255,255,255,0.95)"
            stroke="#fdba74"
            strokeWidth={1}
          />
          <rect x={-badgeWidth / 2} y={-11} width={2.5} height={17} rx={1} fill={RATING_COLOR[b.rating]} />
          <text x={allPlaced ? -6 : 0} y={1.5} textAnchor="middle" fontSize={9.5} fontFamily="ui-monospace, monospace" fill="#27272a">
            {b.label}
          </text>
          {allPlaced && (
            <g transform={`translate(${badgeWidth / 2 - 12} -2.5)`} stroke="#16a34a" strokeWidth={1.8} fill="none">
              <circle r={5.5} />
              <path d="M -2.4 0 L -0.7 1.9 L 2.6 -1.9" />
            </g>
          )}
        </g>
      )}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The animated scene (remounted per run via key)                      */
/* ------------------------------------------------------------------ */

function SatelliteScene({ onSkip }: { onSkip: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const start = performance.now()
    const id = setInterval(() => {
      const e = performance.now() - start
      setElapsed(e)
      if (e > END_AT) clearInterval(id)
    }, 50)
    return () => clearInterval(id)
  }, [])

  const visibleMessages = MESSAGES.filter((m) => elapsed >= m.at)

  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [visibleMessages.length])

  const imageOn = elapsed >= IMAGE_AT
  const scanning = elapsed >= SCAN_FROM && elapsed < SCAN_TO + 150
  const scanPct = Math.min(100, Math.max(0, Math.round(((elapsed - SCAN_FROM) / (SCAN_TO - SCAN_FROM)) * 100)))
  const heatOn = elapsed >= HEAT_AT
  const shadowsOn = elapsed >= SHADOW_AT
  const reportOn = elapsed >= REPORT_AT
  const totalsOn = elapsed >= 6000 && !reportOn
  const legendOn = heatOn && !reportOn

  const placedVisual = useMemo(
    () => BUILDINGS.reduce((n, b) => n + placedCount(b, elapsed), 0),
    [elapsed]
  )
  const f = placedVisual / TOTAL_VISUAL_PANELS
  const totals = {
    panels: Math.round(186 * f),
    kwp: (62.4 * f).toFixed(1),
    mwh: (47.3 * f).toFixed(1),
    co2: (23.4 * f).toFixed(1),
  }

  const activePhase = PROGRESS_PHASES.reduce((acc, p, i) => (elapsed >= p.from ? i : acc), 0)

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex min-h-0 flex-1">
        {/* =================== LEFT — SATELLITE VIEW ================== */}
        <div className="relative h-full w-[60%] overflow-hidden bg-black">
          {/* Satellite image (fades in from black after capture) */}
          <div className={`size-full transition-opacity duration-[600ms] ${imageOn ? "opacity-100" : "opacity-0"}`}>
            <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" className="size-full">
              <defs>
                <filter id="sat-bshadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="3" dy="4" stdDeviation="2" floodColor="#000000" floodOpacity="0.5" />
                </filter>
                <linearGradient id="sat-heat-base" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#1a237e" />
                  <stop offset="55%" stopColor="#00bcd4" />
                  <stop offset="100%" stopColor="#1a237e" />
                </linearGradient>
                <radialGradient id="sat-hotspot">
                  <stop offset="0%" stopColor="#f44336" />
                  <stop offset="35%" stopColor="#ff9800" />
                  <stop offset="70%" stopColor="#ffeb3b" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#ffeb3b" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Layer 1 — ground texture */}
              <rect width="800" height="600" fill="#1a1f1a" />
              <polygon points="0,0 180,0 140,70 60,110 0,80" fill="#1e2a1e" />
              <polygon points="430,0 600,0 570,50 470,60 440,30" fill="#222d20" />
              <polygon points="200,300 290,310 300,360 230,380 190,340" fill="#1e2a1e" />
              <polygon points="540,320 640,330 620,400 520,390" fill="#222d20" />
              <polygon points="700,500 800,480 800,600 690,600" fill="#1e2a1e" />
              <polygon points="0,300 70,310 90,400 40,430 0,420" fill="#222d20" />
              <polygon points="240,540 330,545 320,600 230,600" fill="#1e2a1e" />
              <path d="M 0 250 Q 120 230 200 260 T 420 250" stroke="#2a2a1e" strokeWidth="5" fill="none" />
              <path d="M 500 600 Q 540 480 620 420 T 760 300" stroke="#2a2a1e" strokeWidth="4" fill="none" />
              {/* parking lot, bottom-left */}
              <rect x="50" y="470" width="170" height="105" fill="#1a1a2a" />
              <g stroke="#26263a" strokeWidth="1.5">
                <line x1="75" y1="480" x2="75" y2="565" />
                <line x1="105" y1="480" x2="105" y2="565" />
                <line x1="135" y1="480" x2="135" y2="565" />
                <line x1="165" y1="480" x2="165" y2="565" />
                <line x1="195" y1="480" x2="195" y2="565" />
              </g>

              {/* Layer 2 — street grid */}
              <g stroke="#2d2d2d">
                <line x1="0" y1="160" x2="800" y2="160" strokeWidth="8" />
                <line x1="0" y1="395" x2="800" y2="395" strokeWidth="6" />
                <line x1="270" y1="0" x2="270" y2="600" strokeWidth="8" />
                <line x1="570" y1="0" x2="570" y2="600" strokeWidth="6" />
              </g>
              <g stroke="#3a3a3a" strokeWidth="2" strokeDasharray="14 10">
                <line x1="0" y1="160" x2="800" y2="160" />
                <line x1="270" y1="0" x2="270" y2="600" />
              </g>

              {/* Layer 3 — buildings + animation layers */}
              {BUILDINGS.map((b) => (
                <BuildingLayer key={b.id} b={b} elapsed={elapsed} />
              ))}

              {/* Phase 4 — irradiance heatmap */}
              <g
                className="transition-opacity duration-1000"
                opacity={heatOn ? 0.55 : 0}
                pointerEvents="none"
              >
                <rect width="800" height="600" fill="url(#sat-heat-base)" opacity="0.8" />
                <circle cx="120" cy="85" r="120" fill="url(#sat-hotspot)" />
                <circle cx="675" cy="107" r="130" fill="url(#sat-hotspot)" />
                <circle cx="390" cy="252" r="110" fill="url(#sat-hotspot)" />
                <circle cx="420" cy="480" r="125" fill="url(#sat-hotspot)" />
                <circle cx="355" cy="95" r="80" fill="url(#sat-hotspot)" opacity="0.8" />
              </g>

              {/* Phase 5 — shadow zones */}
              {shadowsOn &&
                SHADOW_ZONES.map((z) => (
                  <g key={z.id} className="sat-badge">
                    <polygon points={z.points} fill="#000000" opacity="0.35" />
                    <polygon
                      points={z.points}
                      fill="none"
                      stroke="#f87171"
                      strokeWidth="1.5"
                      strokeDasharray="6 4"
                      className="sat-dash"
                    />
                    <g transform={`translate(${z.badge[0]} ${z.badge[1]})`}>
                      <rect x="-2" y="-9" width="96" height="14" rx="3" fill="rgba(255,255,255,0.92)" stroke="#f87171" strokeWidth="0.8" />
                      <text x="46" y="2" textAnchor="middle" fontSize="8.5" fontFamily="ui-monospace, monospace" fill="#b91c1c">
                        Shadow — −12% yield
                      </text>
                    </g>
                  </g>
                ))}

              {/* Phase 6 — agent links */}
              {reportOn &&
                AGENT_LINKS.map((a) => (
                  <g key={a.name} className="sat-badge">
                    <line
                      x1={a.chip[0]}
                      y1={a.chip[1]}
                      x2={a.to[0]}
                      y2={a.to[1]}
                      stroke={a.color}
                      strokeWidth="1.2"
                      strokeDasharray="6 5"
                      className="sat-dash"
                      opacity="0.8"
                    />
                    <g transform={`translate(${a.chip[0]} ${a.chip[1]})`}>
                      <rect x="-52" y="-9" width="104" height="18" rx="9" fill="rgba(255,255,255,0.95)" stroke={a.color} strokeWidth="1" />
                      <circle cx="-42" cy="0" r="3.5" fill={a.color} />
                      <text x="6" y="3" textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill="#27272a">
                        {a.name}
                      </text>
                    </g>
                  </g>
                ))}
            </svg>
          </div>

          {/* White HUD grid (8x6) */}
          <svg
            viewBox="0 0 800 600"
            preserveAspectRatio="none"
            className={`absolute inset-0 size-full transition-opacity duration-700 ${elapsed >= 300 ? "opacity-100" : "opacity-0"}`}
          >
            <g stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1">
              {Array.from({ length: 7 }).map((_, i) => (
                <line key={`v${i}`} x1={(i + 1) * 100} y1="0" x2={(i + 1) * 100} y2="600" />
              ))}
              {Array.from({ length: 5 }).map((_, i) => (
                <line key={`h${i}`} x1="0" y1={(i + 1) * 100} x2="800" y2={(i + 1) * 100} />
              ))}
            </g>
            {FLASH_CELLS.map((cell, i) => {
              const at = cellFlashAt(cell)
              if (elapsed < at || elapsed > at + 220) return null
              return (
                <rect
                  key={i}
                  x={cell[0] * 100}
                  y={cell[1] * 100}
                  width="100"
                  height="100"
                  fill="#fb923c"
                  className="sat-cell-flash"
                />
              )
            })}
          </svg>

          {/* Phase 1 — scan sweep */}
          {scanning && <div className="sat-sweep pointer-events-none absolute inset-x-0 top-0" />}

          {/* Capture flash */}
          {elapsed >= FLASH_AT && elapsed < FLASH_AT + 400 && (
            <div className="sat-flash-white pointer-events-none absolute inset-0 bg-white" />
          )}

          {/* HUD top-left */}
          <div className="absolute top-3 left-3 max-w-[60%] rounded bg-zinc-950/70 p-2 font-mono text-xs leading-5 text-green-400">
            {elapsed < SCAN_FROM ? <HudTypewriter elapsed={elapsed} /> : <div>{hudOperation(elapsed)}</div>}
          </div>

          {/* HUD top-right */}
          <div className="sat-flicker absolute top-3 right-3 rounded bg-zinc-950/70 p-2 text-right font-mono text-xs leading-5 text-zinc-400">
            <div>48.1351° N&nbsp;&nbsp;11.5820° E</div>
            <div>ALT: 842m&nbsp;&nbsp;SAT: HELIO-7</div>
            <div>RES: 0.3m/px</div>
            {scanning && <div className="text-orange-400">SCANNING... {scanPct}%</div>}
          </div>

          {/* Irradiance legend (bottom-left, phase 4+) */}
          {legendOn && (
            <div className="absolute bottom-4 left-4 rounded-lg border border-zinc-200 bg-white/95 p-2.5 shadow-lg duration-500 animate-in fade-in">
              <div className="sat-legend-bar h-2 w-[120px] rounded-full" />
              <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
                <span>Low</span>
                <span>High</span>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400">Solar Irradiance — kWh/m²/year</p>
            </div>
          )}

          {/* Running totals (bottom-center, phase 3+) */}
          {totalsOn && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl border border-orange-300 bg-white/95 p-3 shadow-lg duration-500 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex gap-5 text-center">
                {[
                  ["Panels placed", String(totals.panels)],
                  ["Est. capacity", `${totals.kwp} kWp`],
                  ["Annual yield", `${totals.mwh} MWh`],
                  ["CO₂ offset", `${totals.co2} t/yr`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="font-mono text-sm font-bold text-orange-600">{value}</p>
                    <p className="text-[10px] text-zinc-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase 6 — final report card */}
          {reportOn && (
            <div className="sat-slide-up absolute inset-x-0 bottom-0 rounded-t-2xl border-t-4 border-orange-500 bg-white/95 p-5 shadow-2xl">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-zinc-900">Site Analysis Complete</h3>
                <CheckCircle2 className="size-5 text-green-500" />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-3">
                {[
                  ["Total Rooftop Area", "847 m²"],
                  ["Usable Area", "612 m²"],
                  ["Panels Recommended", "186"],
                  ["Est. Annual Yield", "47.3 MWh"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-zinc-100 p-2.5">
                    <p className="text-base font-bold text-zinc-900">{value}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-end justify-between">
                <button className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600">
                  Generate Full Report
                </button>
                <span className="text-xs text-zinc-400">Powered by SolarOS Agents</span>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-full w-px shrink-0 bg-orange-500/70" />

        {/* =============== RIGHT — AGENT COMMUNICATION ================ */}
        <div className="flex h-full min-w-0 flex-1 flex-col bg-white">
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-5 py-4">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
            </span>
            <h2 className="text-sm font-bold text-zinc-900">Agent Communication</h2>
            <span className="ml-auto text-[10px] text-zinc-400">live · SAT-7 HELIO</span>
          </div>

          <div ref={messagesRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {visibleMessages.map((m) => (
              <div key={m.at} className="flex gap-2.5 duration-300 animate-in fade-in slide-in-from-bottom-2">
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${m.avatarClass}`}
                >
                  {m.initials}
                </span>
                <div className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-xs font-semibold ${m.nameClass}`}>{m.agent}</span>
                    <span className="font-mono text-[10px] text-zinc-400">{fakeClock(m.at)}</span>
                  </div>
                  <p className={`mt-1 text-sm ${m.system ? "text-zinc-400 italic" : "text-zinc-600"}`}>
                    {m.text}
                  </p>
                </div>
              </div>
            ))}

            {/* Condensed summary card after the last message */}
            {elapsed >= 15600 && (
              <div className="rounded-lg border border-zinc-200 border-l-4 border-l-orange-500 bg-white p-3 text-sm shadow-sm duration-300 animate-in fade-in slide-in-from-bottom-2">
                <p className="flex items-center gap-1.5 font-semibold text-zinc-900">
                  <CheckCircle2 className="size-4 text-green-500" />
                  Site Analysis Complete
                </p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                  <li>Total rooftop area: 847 m² · usable 612 m²</li>
                  <li>Panels recommended: 186 (58.7 kWp net)</li>
                  <li>Est. annual yield: 47.3 MWh · CO₂ offset 23.4 t/yr</li>
                  <li>Battery recommendation: 48 kWh · payback ≈ 8.2 yrs</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================== BOTTOM PROGRESS BAR ===================== */}
      <div className="flex h-14 shrink-0 items-center gap-4 border-t border-zinc-200 bg-white px-5">
        <span className="shrink-0 text-sm text-zinc-500">SolarOS — Satellite Site Analysis Demo</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex justify-between">
            {PROGRESS_PHASES.map((p, i) => (
              <span
                key={p.label}
                className={`text-[10px] font-medium transition-colors duration-300 ${
                  i === activePhase ? "text-orange-500" : "text-zinc-400"
                }`}
              >
                {p.label}
              </span>
            ))}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
            <div className="sat-progress h-full rounded-full bg-orange-500" />
          </div>
        </div>
        <button
          onClick={onSkip}
          className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1 text-sm text-zinc-500 transition-colors hover:border-orange-500 hover:text-zinc-900"
        >
          Skip
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Trigger + overlay shell                                             */
/* ------------------------------------------------------------------ */

export default function SatelliteDemoOverlay() {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [runId, setRunId] = useState(0)

  function launch() {
    setRunId((r) => r + 1)
    setOpen(true)
  }

  function close() {
    setVisible(false)
    setTimeout(() => setOpen(false), 400)
  }

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => setVisible(true), 20)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      clearTimeout(id)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <style>{DEMO_CSS}</style>

      {/* Trigger */}
      <button
        onClick={launch}
        className="fixed top-3 right-4 z-50 flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/20"
      >
        <Zap className="size-4 text-orange-500" />
        Demo
      </button>

      {/* Fullscreen overlay (light chrome, dark satellite imagery) */}
      {open && (
        <div
          className={`fixed inset-0 z-50 bg-zinc-50 transition-opacity duration-[400ms] ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          <SatelliteScene key={runId} onSkip={close} />

          <div className="absolute top-3 right-4 flex items-center gap-2">
            <button
              onClick={() => setRunId((r) => r + 1)}
              className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:border-orange-500 hover:text-zinc-900"
              aria-label="Replay demo"
            >
              <RotateCcw className="size-4" />
            </button>
            <button
              onClick={close}
              className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:border-orange-500 hover:text-zinc-900"
              aria-label="Close demo"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
