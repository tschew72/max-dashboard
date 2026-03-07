# UX Design Spec — Max Dashboard Pages V2
**Author:** Umi 🎨 (UX Designer)  
**Date:** 2026-03-07  
**Flow:** FIRE ⚡  
**For:** Dev (implementation blueprint — zero questions needed)

---

## Design System Reference

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#0f0f0f` | Page background |
| `--card` / `--surface` | `#1a1a1a` (globals) / `#22272b` (dashboard convention) | Panel / card background |
| `--border` | `#2a2a2a` (globals) / `#2c333a` (dashboard convention) | All borders |
| `--accent` | `#7c3aed` | CTAs, highlights, active states |
| `--accent-light` | `#a78bfa` | Hover accent, secondary highlights |
| `--text` | `#f0f0f0` | Primary text |
| `--muted` | `#888` / `#626f86` | Secondary text, timestamps |

> **Note:** Dashboard components use `#22272b` / `#2c333a` inline (Jira-dark palette). Both are acceptable — use whichever is already established per page. Do not introduce a third palette.

**Existing `Skeleton` pattern (from page.tsx):**
```tsx
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: '#2c333a' }} />
}
```
All new skeleton components **must** use this exact pattern.

---

## Component 1: Exam Countdown Banner (WI-074 / WI-062)

**Page:** `/calendar`  
**Position:** Above calendar grid, below page header — full-width sticky strip.

### Layout
```
┌──────────────────────────────────────────────────────────────────────────┐
│  🎓  ISO 27001 Lead Auditor Exam  ·  Mar 9 · 21:30 SGT                  │
│      2 days  14 hours  33 minutes                                         │
│                                                          [✕ Dismiss]      │
└──────────────────────────────────────────────────────────────────────────┘
```

### States

| State | Trigger | Styling |
|-------|---------|---------|
| **Normal** | >24h remaining | Accent purple background: `bg-[#7c3aed]/20`, left border `border-l-4 border-[#7c3aed]` |
| **Urgent** | ≤24h remaining | Red background: `bg-red-900/30`, left border `border-l-4 border-red-500`, text red-300, pulse animation |
| **Dismissed** | User clicks ✕ | Hidden. Persist in `localStorage` key `exam-countdown-dismissed` |
| **Expired** | After Mar 9 21:30 SGT | Do not render. Check `Date.now() > examTimestamp` |

### Specs
- **Container:** `flex items-center gap-4 px-4 py-3 rounded-lg mb-4` with state-dependent bg/border
- **Icon:** `GraduationCap` from Lucide (24px), color matches border
- **Title text:** `text-sm font-semibold text-white` — `"ISO 27001 Lead Auditor Exam"`
- **Date text:** `text-xs text-[--muted]` — `"Mar 9 · 21:30 SGT"`
- **Countdown digits:** Three pill blocks `[DD] days [HH] hours [MM] mins`
  - Each pill: `font-mono text-lg font-bold` padded `px-2 py-0.5 rounded` bg `bg-black/30`
  - Separator dots: `text-[--muted]` between pills
- **Dismiss button:** `ml-auto flex-shrink-0`, icon `X` size 16, `text-[--muted] hover:text-white`, no border
- **Real-time update:** `setInterval` every 30 seconds, recalculate countdown from `new Date('2026-03-09T21:30:00+08:00').getTime()`
- **Urgent animation:** When <24h, add `animate-pulse` to the left border and countdown numbers only — not the entire banner

### Data Shape
```ts
const EXAM_TARGET = new Date('2026-03-09T21:30:00+08:00').getTime()

function getCountdown() {
  const diff = EXAM_TARGET - Date.now()
  if (diff <= 0) return null  // expired
  const days    = Math.floor(diff / 86400000)
  const hours   = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  return { days, hours, minutes, isUrgent: diff < 86400000 }
}
```

### Mobile
- On mobile (<640px): Stack title and countdown vertically. Dismiss button moves to top-right corner absolutely positioned.

---

## Component 2: Token Usage Sparklines (WI-052)

**Page:** `/agents` — inside each agent card  
**Constraint:** Inline SVG only. No recharts, no external lib.

### Layout (inside agent card)
```
┌─────────────────────────────────────────────────┐
│  🤖 Max          claude-sonnet-4     $0.042 /7d  │
│  ──────────────────────────────────────────────  │
│  [sparkline ▁▃▅▄▇▆▃]                 ↗ +12%     │
│  Mon Tue Wed Thu Fri Sat Sun                     │
└─────────────────────────────────────────────────┘
```

### Sparkline SVG Spec
- **Dimensions:** `width="100%" height="40"` (or fixed `width="140" height="40"`)
- **Viewbox:** `viewBox="0 0 140 40"`
- **Line:** SVG `<polyline>` — stroke `#7c3aed`, strokeWidth `1.5`, fill `none`
- **Area fill:** SVG `<polygon>` using same points + baseline corners — fill `rgba(124,58,237,0.15)`
- **Dots:** SVG `<circle>` r=`2` at each data point — fill `#7c3aed`, hidden by default, visible on hover via CSS
- **Min/Max:** Normalize all values to 0–40 range: `y = 40 - (value / maxValue) * 36` (4px padding)
- **Empty state:** Dashed horizontal line at midpoint — `stroke="#2c333a" stroke-dasharray="4 2"`
- **Zero values:** Rendered as floor (y=38), not skipped

### Data Shape
```ts
interface AgentSparklineData {
  agentId: string
  agentName: string
  model: string
  days: {
    date: string        // ISO date "2026-03-01"
    tokens: number      // total tokens for that day
    costUsd: number     // cost for that day
  }[]                   // exactly 7 entries, fill 0 for missing days
  totalCostUsd: number  // sum of last 7d
  trend: number         // % change: ((last3avg - prev3avg) / prev3avg) * 100
}
```

### API Extension
`GET /api/agents` — add `sparkline` field per agent:
```ts
// Aggregate from `AgentRun` table: group by agentId, date(createdAt)
// Select sum(tokensUsed), sum(costUsd) per day
// Return last 7 days with 0-fill for missing dates
```

### Rendering
```tsx
function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  const W = 140, H = 40, PAD = 4
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - PAD - ((v / max) * (H - PAD * 2))
    return `${x},${y}`
  }).join(' ')
  const areaPoints = `0,${H} ${pts} ${W},${H}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="40" style={{ display: 'block' }}>
      <polygon points={areaPoints} fill="rgba(124,58,237,0.15)" />
      <polyline points={pts} fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
```

### Trend Badge
- **Up ≥5%:** `↗ +X%` in `text-green-400 text-xs`
- **Down ≥5%:** `↘ -X%` in `text-red-400 text-xs`
- **Flat <5%:** `→ ~0%` in `text-[--muted] text-xs`

### 7d / 30d Toggle
- Pill toggle in agent section header (not per-card)
- `localStorage` key: `agent-cost-range` → `"7d"` | `"30d"`
- 30d sparkline: aggregate by 30 data points (1 per day), same SVG approach

### Mobile
Sparkline scales to full card width. Trend badge moves below sparkline.

---

## Component 3: Real-Time Scan Feed (WI-059)

**Page:** `/shield` — new "Live Feed" tab  
**Data:** SSE from `GET /api/shield/stream`

### Layout
```
┌─ Live Feed ─────────────────────────────── 🟢 Live  [⏸ Pause] ─┐
│                                                                   │
│  14:32:01  customer-a   [BLOCK 🔴]  "ignore previous instru..."  │
│  14:31:58  customer-b   [WARN 🟡]   "summarize the following..."  │
│  14:31:45  customer-a   [ALLOW 🟢]  "What is the refund poli..."  │
│  14:31:30  internal     [BLOCK 🔴]  "system: you are now..."      │
│  ...                                                               │
│                                                                   │
│  [────────────────── max 20 items ──────────────────]             │
└───────────────────────────────────────────────────────────────────┘
```

### Entry Row Design
Each row: `flex items-center gap-3 px-3 py-2 border-b border-[#2c333a] text-sm hover:bg-[#22272b]`

| Field | Spec |
|-------|------|
| Timestamp | `font-mono text-xs text-[--muted]` — `HH:mm:ss` format (SGT) |
| Consumer | `text-xs text-[--text] w-24 truncate` |
| Verdict Badge | Pill component (see below) |
| Text Preview | `text-xs text-[--muted] truncate flex-1` — max 80 chars, `title={fullText}` |

### Verdict Badges
```tsx
const VERDICT_STYLES = {
  ALLOW: { bg: 'bg-green-900/40',  text: 'text-green-400',  border: 'border-green-700',  label: 'ALLOW'  },
  WARN:  { bg: 'bg-yellow-900/40', text: 'text-yellow-400', border: 'border-yellow-700', label: 'WARN'   },
  BLOCK: { bg: 'bg-red-900/40',    text: 'text-red-400',    border: 'border-red-700',    label: 'BLOCK'  },
}
// Pill: `text-[10px] font-bold px-1.5 py-0.5 rounded border ${VERDICT_STYLES[verdict].bg} ${...text} ${...border}`
```

### Auto-Scroll Behavior
- Container: `overflow-y-auto` with fixed `max-h-[480px]`
- Default: scroll to bottom on new item — `containerRef.current.scrollTop = containerRef.current.scrollHeight`
- **Pause on hover:** `onMouseEnter` sets `isPaused = true`, `onMouseLeave` sets `isPaused = false` and scrolls to bottom
- **Pause button:** Toggles `isPaused` manually. Icon: `Pause` when live, `Play` when paused
- New items added to top of array (most recent first), or bottom with auto-scroll — **use bottom with auto-scroll** (more natural for live feeds)
- Hard limit: keep only last 20 items in state array: `setItems(prev => [...prev, newItem].slice(-20))`

### Connection Status Indicator
```
🟢 Live   — SSE connected, events flowing
🟡 Idle   — connected but no events in last 30s
🔴 Offline — SSE disconnected, showing reconnect spinner
```
- Position: top-right of panel header
- Implemented via: track `lastEventTime`, compare in `setInterval` every 5s

### SSE Data Shape
```ts
interface ScanFeedEvent {
  id: string
  timestamp: string      // ISO
  consumer: string       // consumer/customer id
  score: number          // 0–100
  verdict: 'ALLOW' | 'WARN' | 'BLOCK'
  textPreview: string    // first 80 chars of input
  recommendation: string // human-readable reason
}
```

### Empty State
Center-aligned, icon `Radio` (lucide), text: `"Waiting for scans..."`, muted color.

### Mobile
Compress consumer column (20px), hide recommendation column. Show as 2-line rows instead.

---

## Component 4: Gantt / Timeline View (WI-050)

**Page:** `/tasks` — new "Timeline" view toggle  
**Constraint:** CSS Grid + divs only. No D3, no recharts, no external deps.

### Toggle Placement
In tasks page header, alongside existing view controls:
```
[📋 Board] [📅 Timeline]   ← pill toggle, localStorage persisted
```

### Overall Layout Structure
```
┌── Timeline ─────────────────────────────── [Week ▾] [Today] ──┐
│                                                                  │
│  Label Header │ Mon 3  Tue 4  Wed 5  Thu 6  Fri 7  Sat 8  Sun 9 │
│  ─────────────┼───────────────────────────────────────────────── │
│  WORK         │           [──── Task A ────]                     │
│               │  [─ Task B ─]                                    │
│  PERSONAL     │                      [─── Task C ────────]       │
│  CONSULTING   │  [── Task D ─────────────────]                   │
│  Unscheduled  │  • Task E  • Task F  • Task G                   │
└──────────────────────────────────────────────────────────────────┘
```

### CSS Grid Architecture
```tsx
// Outer grid: [label column] + [N day columns]
// Week view: 7 day columns
// Month view: 30 day columns (compressed)

const gridTemplateColumns = `160px repeat(${dayCount}, 1fr)`

// Container:
<div style={{ display: 'grid', gridTemplateColumns, minWidth: '600px' }}>
  {/* Header row */}
  {/* Label rows */}
</div>
```

### Task Bar Rendering
Each task with `dueDate`:
- Determine `startCol` = `startDate` position in grid (or `dueDate - 3 days` if only dueDate)
- `endCol` = `dueDate` position + 1
- Bar: `position: absolute` within a `position: relative` row — **OR** use `grid-column: startCol / endCol`
- Bar style: `rounded px-2 py-0.5 text-xs font-medium truncate cursor-pointer`
- Color by status:

```ts
const TASK_BAR_COLORS: Record<string, { bg: string; text: string }> = {
  BACKLOG:     { bg: '#2c333a',   text: '#b6c2cf' },
  IN_PROGRESS: { bg: '#0052cc',   text: '#ffffff' },
  REVIEW:      { bg: '#ff8b00',   text: '#ffffff' },
  DONE:        { bg: '#1a4731',   text: '#36b37e' },
}
```

### Zoom Levels
| Level | Column Width | Date Format |
|-------|-------------|-------------|
| Week | `minmax(80px, 1fr)` | `Mon 3` (weekday + day) |
| Month | `minmax(32px, 1fr)` | `3` (day number only) |

- Toggle: `[Week] [Month]` pills in header (stored in `localStorage`)
- `Today` button: scrolls timeline container so today's column is visible
- Today's column: subtle highlight `bg-[#7c3aed]/10`

### Row Structure
- Each label group = one row, height `auto` (min 40px)
- Multiple tasks on same row = stacked vertically within that row (absolute positioned bars, row auto-expands)
- "Unscheduled" row: tasks shown as text bullets, no bar

### Interactions
- **Click task bar** → opens same detail modal as Kanban view
- **Hover task bar** → tooltip: title, status, due date
- **Skeleton:** show shimmer bars (width random 30–70%) while loading

### Mobile
Horizontal scroll container (`overflow-x: auto`), week view only on mobile.

---

## Component 5: Agent Spawn Panel (WI-053)

**Page:** `/agents` — modal triggered by "Spawn Agent" button in page header

### Trigger Button
```
[⚡ Spawn Agent]   ← in page header, right side
Style: bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-3 py-1.5 rounded-lg text-sm font-medium
Icon: Zap (Lucide) size 14, mr-1.5
```

### Modal Structure
```
┌─────────────────────────────────────────────┐
│  ⚡ Spawn Agent                          [✕]  │
│  ──────────────────────────────────────────  │
│  Agent                                       │
│  [Max ▾]                                     │
│                                              │
│  Task / Prompt                               │
│  ┌────────────────────────────────────────┐  │
│  │ Describe what the agent should do...   │  │
│  │                                        │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Model Override          (optional)          │
│  [Default (agent config) ▾]                  │
│                                              │
│  Timeout (minutes)       (optional)          │
│  [30                                    ]    │
│                                              │
│  ──────────────────────────────────────────  │
│  [Cancel]                  [⚡ Spawn Agent]  │
└─────────────────────────────────────────────┘
```

### Field Specs

**Agent Selector Dropdown**
- All 13 agents: Max, Alex, Sam, Bea, Dev, Quinn, Umi, Dex, Cleo, Wren, Kai, Ops, Maya
- Style: `w-full bg-[#22272b] border border-[#2c333a] rounded-lg px-3 py-2 text-sm text-white`
- Custom dropdown (not native `<select>`) — show agent emoji/icon if available

**Task Description Textarea**
- `rows={4}`, `placeholder="Describe what the agent should do..."`
- Same border/bg as dropdown
- Required — disabled submit if empty
- Character counter `text-xs text-[--muted]` bottom-right: `0 / 2000`
- `resize-none`

**Model Override Dropdown**
- Options: `Default (agent config)`, `claude-sonnet-4-20250514`, `claude-opus-4-0`, `gpt-4o`, `gpt-4o-mini`, `gemini-2.0-flash`
- Label marked `(optional)` in muted text

**Timeout Field**
- Number input, default `30`, min `1`, max `480`
- Suffix label: `min` shown inline right
- Style: `w-24 bg-[#22272b] border border-[#2c333a] rounded-lg px-3 py-2 text-sm`

### Submit States
| State | Button | Behavior |
|-------|--------|----------|
| Idle | `⚡ Spawn Agent` — accent bg | Normal |
| Submitting | `⏳ Spawning...` — disabled, spinner | Disabled, no double-submit |
| Success | Toast: `"✅ Agent spawned successfully"` | Modal closes |
| Error | Toast: `"❌ Failed to spawn: {error}"` — red | Modal stays open |

### Modal Overlay
- `fixed inset-0 bg-black/60 z-50 flex items-center justify-center`
- Panel: `bg-[#22272b] border border-[#2c333a] rounded-xl p-6 w-full max-w-md`
- Close on overlay click + `Escape` key
- Trap focus inside modal

### Mobile
Full-screen bottom sheet on mobile (<640px). `rounded-t-2xl`, drag handle at top.

---

## Component 6: Docker Containers Panel (WI-066)

**Page:** `/system` — new section below PM2 panel

### Section Header
```
Docker Containers            [⟳ Refresh]    ← same header style as PM2 section
```

### Table Structure
Mirror the PM2 table exactly. Same column proportions, same action button style.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Name              Status       Image                  Uptime   Actions  │
│  ──────────────────────────────────────────────────────────────────────  │
│  ciso              🟢 running   evvo/ciso:latest       3d 4h    [■] [↺]  │
│  defensewatch      🔴 exited    evvo/dw:v2.1           —        [▶] [↺]  │
│  healtest          🟢 running   evvo/healtest:1.0      12h      [■] [↺]  │
│  ──────────────────────────────────────────────────────────────────────  │
│  Docker not available                                                     │  ← fallback row
└─────────────────────────────────────────────────────────────────────────┘
```

### Column Specs
| Column | Width | Content |
|--------|-------|---------|
| Name | `flex-1` | Container name, monospace |
| Status | `w-32` | Status dot + label (see below) |
| Image | `w-48 truncate` | Image name:tag, `text-[--muted] text-xs` |
| Uptime | `w-24` | Human duration or `—` if stopped |
| Actions | `w-24` | Icon buttons |

### Status Badges
```tsx
const DOCKER_STATUS = {
  running: { dot: 'bg-green-500',  label: 'running',  text: 'text-green-400'  },
  exited:  { dot: 'bg-red-500',    label: 'exited',   text: 'text-red-400'    },
  paused:  { dot: 'bg-yellow-500', label: 'paused',   text: 'text-yellow-400' },
  created: { dot: 'bg-blue-500',   label: 'created',  text: 'text-blue-400'   },
}
// Dot: <span className="w-2 h-2 rounded-full inline-block mr-1.5 ${dot}" />
```

### Action Buttons
- Same style as PM2 action buttons on the existing System page
- **Running container:** `[■ Stop]` + `[↺ Restart]`
- **Stopped container:** `[▶ Start]` + `[↺ Restart]` (restart = start if stopped)
- Stop/Restart: confirmation dialog (same as PM2 kill confirmation pattern)
- Icon sizes: 14px, button `p-1.5 rounded hover:bg-[#2c333a]`

### Confirmation Dialog
```
"Stop container 'ciso'? This will interrupt running processes."
[Cancel]  [Stop Container]  ← red button
```

### API Data Shape
```ts
interface DockerContainer {
  name: string          // container name (no leading /)
  status: 'running' | 'exited' | 'paused' | 'created'
  image: string         // image:tag
  uptime: string | null // human format, null if not running
  ports: string[]       // ["3000/tcp", "8080->8080/tcp"]
}
```

### Error / Fallback States
| Condition | Display |
|-----------|---------|
| Docker not installed | Row: `"Docker not installed on this host"` — muted text, no action buttons |
| Daemon not running | Row: `"Docker daemon offline — start with sudo systemctl start docker"` |
| No containers | Row: `"No containers found"` — empty state |

### Auto-Refresh
- Shares the existing System page `setInterval` (10s) — include Docker in same API response
- No separate interval

### Skeleton
3 rows of: `Skeleton className="h-8 w-full mb-1"` while loading

---

## Component 7: Global Page Header + Skeleton Patterns (WI-072)

### PageHeader Component

**Purpose:** Consistent header across all 11 dashboard pages. Zero variation in structure — only content differs.

### Structure
```tsx
interface PageHeaderProps {
  title: string            // e.g. "Agents"
  subtitle?: string        // optional: "13 active · $0.12 today"
  icon?: LucideIcon        // page icon, size 20
  actions?: React.ReactNode // buttons on right side
  badge?: { label: string; color: 'green' | 'red' | 'yellow' | 'purple' | 'blue' }
}
```

### Visual Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 Agents     [🟢 13 active]                    [⚡ Spawn Agent] │
│  13 agents · 4 running · $0.12 today                            │
└─────────────────────────────────────────────────────────────────┘
```

### CSS
```tsx
// Outer wrapper
<div className="flex items-start justify-between mb-6 gap-4">

  // Left: icon + title + subtitle
  <div className="flex items-center gap-3 min-w-0">
    {icon && <div className="p-2 rounded-lg" style={{ background: '#22272b' }}>
      <Icon size={20} style={{ color: '#7c3aed' }} />
    </div>}
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {badge && <Badge {...badge} />}
      </div>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: '#888' }}>{subtitle}</p>}
    </div>
  </div>

  // Right: action buttons
  {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
</div>
```

### Badge Variants
```ts
const BADGE_COLORS = {
  green:  { bg: 'bg-green-900/40',  text: 'text-green-400',  border: 'border-green-700'  },
  red:    { bg: 'bg-red-900/40',    text: 'text-red-400',    border: 'border-red-700'    },
  yellow: { bg: 'bg-yellow-900/40', text: 'text-yellow-400', border: 'border-yellow-700' },
  purple: { bg: 'bg-purple-900/40', text: 'text-purple-400', border: 'border-purple-700' },
  blue:   { bg: 'bg-blue-900/40',   text: 'text-blue-400',   border: 'border-blue-700'   },
}
// Badge: `text-[10px] font-bold px-1.5 py-0.5 rounded border ${colors.bg} ${colors.text} ${colors.border}`
```

---

### Skeleton Patterns

**Rule:** Every data-fetched section must have a skeleton loading state. Use the existing `Skeleton` component with `animate-pulse`.

#### Pattern A: Card Grid Skeleton
```tsx
// Usage: Agents page, Jobs page cards
function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl p-4" style={{ background: '#22272b', border: '1px solid #2c333a' }}>
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-1.5" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-10 w-full mb-2" />  {/* sparkline area */}
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

#### Pattern B: Table Skeleton
```tsx
// Usage: System page (PM2, Docker), Jobs list view
function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2c333a' }}>
      {/* Header */}
      <div className="flex gap-4 px-4 py-2.5" style={{ background: '#22272b', borderBottom: '1px solid #2c333a' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3" style={{ width: i === 0 ? '40%' : '15%' }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3" style={{ borderBottom: '1px solid #2c333a' }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4" style={{ width: j === 0 ? '35%' : '18%' }} />
          ))}
        </div>
      ))}
    </div>
  )
}
```

#### Pattern C: List Skeleton
```tsx
// Usage: Brain page, Activity feed, Comms
function SkeletonList({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-px">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5" style={{ background: '#22272b', borderBottom: '1px solid #2c333a' }}>
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-3.5 mb-1.5" style={{ width: `${55 + (i % 3) * 15}%` }} />
            <Skeleton className="h-2.5" style={{ width: `${30 + (i % 4) * 10}%` }} />
          </div>
          <Skeleton className="h-3 w-12 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}
```

#### Pattern D: Stat Card Row Skeleton
```tsx
// Usage: System stats, Analytics summary cards
function SkeletonStatRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl p-4" style={{ background: '#22272b', border: '1px solid #2c333a' }}>
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-7 w-24 mb-1" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      ))}
    </div>
  )
}
```

#### Pattern E: Timeline/Gantt Skeleton
```tsx
// Usage: Tasks timeline view loading state
function SkeletonTimeline() {
  const widths = [45, 70, 30, 55, 80, 40, 65]
  return (
    <div className="space-y-4">
      {['WORK', 'PERSONAL', 'CONSULTING', 'VAPT'].map((label, i) => (
        <div key={label} className="flex gap-4">
          <Skeleton className="h-5 w-28 flex-shrink-0" />
          <div className="flex-1 flex gap-2 items-center">
            <Skeleton className="h-6 rounded-md" style={{ width: `${widths[i % widths.length]}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
```

### Skeleton Usage Rules
1. Show skeleton immediately on mount while `isLoading === true`
2. Skeleton count should match expected data count where known (e.g., 13 agent cards = 13 skeletons)
3. Never show skeleton + real content simultaneously — hard swap
4. Skeleton duration: no artificial delay — hide as soon as data arrives
5. Error state replaces skeleton: show inline error with retry button

---

## Shared Interaction Patterns

### Toast Notifications
- Use existing toast pattern (if shadcn/ui `useToast` exists) or implement minimal:
  ```tsx
  // Fixed position: bottom-right on desktop, bottom-center on mobile
  // Duration: 3000ms success, 5000ms error (manual dismiss)
  // Colors: success bg-green-900/90, error bg-red-900/90
  ```

### Confirmation Dialogs
- All destructive actions (Stop, Delete, Kill) require confirmation
- Minimal: title, 1-line description, Cancel + Confirm button
- Confirm button color matches action severity (red for destroy, orange for stop)

### Empty States
Standard format for all pages:
```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <Icon size={40} style={{ color: '#626f86' }} className="mb-3" />
  <p className="text-sm font-medium" style={{ color: '#b6c2cf' }}>No [items] found</p>
  <p className="text-xs mt-1" style={{ color: '#626f86' }}>[Contextual hint]</p>
</div>
```

### Error States
```tsx
<div className="flex items-center gap-2 p-4 rounded-lg" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)' }}>
  <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
  <div>
    <p className="text-sm text-red-400 font-medium">Failed to load</p>
    <p className="text-xs text-red-300/70">{errorMessage}</p>
  </div>
  <button onClick={retry} className="ml-auto text-xs text-red-400 underline">Retry</button>
</div>
```

---

## Component File Locations (for Dev)

| Component | Create at |
|-----------|-----------|
| `PageHeader` | `/root/projects/max-dashboard/components/dashboard/PageHeader.tsx` |
| `Skeleton*` | `/root/projects/max-dashboard/components/dashboard/Skeletons.tsx` |
| `Sparkline` | `/root/projects/max-dashboard/components/dashboard/Sparkline.tsx` |
| `ExamCountdownBanner` | `/root/projects/max-dashboard/components/dashboard/ExamCountdownBanner.tsx` |
| `ScanFeed` | `/root/projects/max-dashboard/components/dashboard/ScanFeed.tsx` |
| `AgentSpawnModal` | `/root/projects/max-dashboard/components/dashboard/AgentSpawnModal.tsx` |
| `DockerPanel` | `/root/projects/max-dashboard/components/dashboard/DockerPanel.tsx` |
| `GanttTimeline` | `/root/projects/max-dashboard/components/dashboard/GanttTimeline.tsx` |

---

## Priority Order for Dev

1. **`PageHeader` + `Skeletons.tsx`** — foundations, needed by all other components (WI-072)
2. **`ExamCountdownBanner`** — time-sensitive, exam is Mar 9 (WI-062/074)
3. **`DockerPanel`** — direct ops value (WI-066)
4. **`Sparkline` + agent card integration** — cost visibility (WI-052)
5. **`ScanFeed`** — needs new SSE endpoint, spec SSE data shape above (WI-059)
6. **`AgentSpawnModal`** — needs spawn API endpoint (WI-053)
7. **`GanttTimeline`** — highest complexity, build last (WI-050)

---

*Spec complete. Dev should have zero ambiguity. File: `/root/projects/max-dashboard/.specs-fire/intents/pages-v2/ux-design.md`*
