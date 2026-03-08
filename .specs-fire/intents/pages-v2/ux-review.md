# UX QA Review — Max Dashboard Pages V2
**Reviewer:** Umi 🎨  
**Date:** 2026-03-07  
**Method:** Source code inspection (Playwright not available; screenshots skipped)  
**Spec ref:** `.specs-fire/intents/pages-v2/ux-design.md`

---

## Summary

| WI | Component | Status |
|----|-----------|--------|
| WI-062/074 | Exam Countdown Banner | ⚠️ PARTIAL |
| WI-052 | Token Usage Sparklines | ⚠️ PARTIAL |
| WI-059 | Real-Time Scan Feed | ⚠️ PARTIAL |
| WI-050 | Gantt / Timeline View | ❌ MISSING |
| WI-053 | Agent Spawn Panel | ❌ MISSING (on /agents) |
| WI-066 | Docker Containers Panel | ❌ MISSING |
| WI-072 | PageHeader Component | ⚠️ PARTIAL |
| WI-072 | Skeleton Patterns | ⚠️ PARTIAL |
| —      | CSS Variable Consistency | ✅ PASS |
| —      | Dark Theme | ✅ PASS |
| —      | Verdict Badge Colors | ✅ PASS |
| —      | Activity: Export + Pagination | ✅ PASS |
| —      | System: Swap + Network Stats | ✅ PASS |

---

## Detailed Findings

---

### ✅ PASS — CSS Variable Consistency

All reviewed pages use `var(--bg)`, `var(--card)`, `var(--border)`, `var(--text)`, `var(--muted)`, `var(--accent)` throughout. No raw hex values introduced for theme-critical tokens. Accent `#7c3aed` used correctly in stat card progress bars, badge highlights, and buttons.

---

### ✅ PASS — Dark Theme Applied Consistently

All pages: `background: 'var(--bg)'`, panel cards at `var(--card)`, borders at `var(--border)`. No light-mode bleed detected. Jira-dark palette (`#22272b` / `#2c333a`) used as supplement per design system note.

---

### ✅ PASS — Verdict Badge Colors

`/shield` page (ScanFeedPanel + LogRow):  
- `ALLOW` → `#22c55e` (green) ✅  
- `WARN` → `#f59e0b` (yellow) ✅  
- `BLOCK` → `#ef4444` (red) ✅  

Colors match spec exactly.

---

### ✅ PASS — Activity: Export + Pagination + SSE

`/activity/page.tsx`:
- ✅ JSON and CSV export buttons in header
- ✅ Pagination: 20 items/page, Prev/Next controls, sticky bottom bar
- ✅ SSE live updates via `EventSource('/api/activity/stream')`
- ✅ Live/Offline connection indicator (green dot)
- ✅ Filter chips: All / Errors / Cron / Learning
- ✅ Skeleton loaders (SkeletonList with 8 rows)
- ✅ Empty state (Radio icon + "No activity yet")

---

### ✅ PASS — System: Swap + Network I/O

`/system/page.tsx`:
- ✅ Swap card: `Layers` icon, `swap.used` / `swap.total`, progress bar with percentage
- ✅ Network I/O card: `ArrowDownUp` icon, rxBytes + txBytes + interface label
- Both render in the 2-col stat card grid alongside CPU/RAM/Disk/Uptime

---

### ⚠️ PARTIAL — Exam Countdown Banner (WI-062/074)

**Files:**
- `components/dashboard/ExamAlertBanner.tsx` (used on home `/`)
- `app/(dashboard)/calendar/page.tsx` (local `ExamCountdownBanner`)

**What's correct:**
- ✅ Renders on home page (imported at line 17, rendered at line 618)
- ✅ Renders on calendar page (local component, above calendar grid)
- ✅ Expiry check: `if (diff <= 0) return null`
- ✅ Urgent state: switches to red bg when <24h
- ✅ Dismiss button with localStorage persistence (home banner)
- ✅ Real-time countdown update interval

**Deviations from spec:**
- ❌ **Icon:** Spec requires `GraduationCap` (Lucide). Both components use `AlertTriangle`.
- ❌ **Home banner layout:** Condensed countdown as single string (`"2d 14h 33m remaining"`) instead of 3 separate pill blocks with `font-mono text-lg font-bold px-2 py-0.5 rounded bg-black/30` per digit block.
- ❌ **Update interval:** Home banner uses `setInterval(..., 60000)` (60s). Spec requires 30s. Calendar banner is 1s (acceptable).
- ❌ **localStorage key:** Home uses `exam-alert-dismissed-2026-03-09`; spec requires `exam-countdown-dismissed`.
- ⚠️ **Calendar banner is a separate local component** not reusing `ExamAlertBanner`. This creates two code paths to maintain. Spec implied one shared component.
- ⚠️ Calendar banner has extra "Exam Prep Checklist" section (not in spec) — nice addition but undocumented.
- ⚠️ Calendar banner uses gradient bg instead of flat `bg-[#7c3aed]/20` — visual deviation.

**Action for Dev:**
1. Change icon to `GraduationCap` in `ExamAlertBanner.tsx` and calendar's local component
2. Update home interval to 30s
3. Standardize localStorage key to `exam-countdown-dismissed`
4. Refactor home banner countdown display to pill blocks per spec
5. Consider extracting calendar countdown to shared `ExamCountdownBanner` component

---

### ⚠️ PARTIAL — Token Usage Sparklines (WI-052)

**File:** `app/(dashboard)/agents/page.tsx` (lines 259–289, inline component `TokenSparkline`)

**What's correct:**
- ✅ SVG sparkline exists with `<polyline>` rendering
- ✅ Y-axis normalization: `y = h - (v / max) * (h - 4) - 2`
- ✅ `strokeWidth="1.5"`, `strokeLinejoin="round"`, `strokeLinecap="round"`
- ✅ Renders inside agent cards (line 1028–1030)

**Deviations from spec:**
- ❌ **Stroke color:** Uses `#388bfd` (blue). Spec requires `#7c3aed` (accent purple).
- ❌ **No area fill:** Missing `<polygon>` fill with `rgba(124,58,237,0.15)`.
- ❌ **No trend badge:** Missing `↗ +X%` / `↘ -X%` / `→ ~0%` badge per agent card.
- ❌ **No 7d/30d toggle:** No range toggle in agent section header.
- ❌ **No cost display:** Spec layout shows `$0.042 /7d` in agent card header.
- ❌ **Not extracted:** Component is inline in `agents/page.tsx`, not at `components/dashboard/Sparkline.tsx` as spec requires.
- ❌ **viewBox:** Uses `0 0 400 32` (400px wide). Spec says `0 0 140 40`.
- ❌ **No empty state:** No dashed line for zero-data state.

**Action for Dev:**
1. Change stroke to `#7c3aed`, add polygon area fill
2. Add trend badge (needs API `trend` field)
3. Add 7d/30d toggle to section header
4. Extract to `components/dashboard/Sparkline.tsx`
5. Add cost display to agent card

---

### ⚠️ PARTIAL — Real-Time Scan Feed (WI-059)

**File:** `app/(dashboard)/shield/page.tsx` → `ScanFeedPanel` function

**What's correct:**
- ✅ Feed panel exists and renders in Analytics tab
- ✅ Verdict badge colors correct (green/yellow/red)
- ✅ Text preview truncated to 80 chars
- ✅ Timestamp + consumer + verdict per row
- ✅ Empty state ("No recent scans")
- ✅ Loading spinner while fetching

**Deviations from spec:**
- ❌ **SSE not used:** Panel uses `fetch('/api/shield/recent')` polling every 15s. Spec requires SSE `GET /api/shield/stream` with `EventSource`.
- ❌ **No "Live Feed" tab:** ScanFeedPanel is embedded inside the Analytics tab, not its own tab. Spec requires a dedicated "Live Feed" tab alongside Analytics/Logs/Scan.
- ❌ **No Pause button:** Spec requires `[⏸ Pause]` toggle to stop auto-scroll.
- ❌ **No auto-scroll:** Container has no scroll-to-bottom behavior.
- ❌ **No connection status indicator:** Spec requires 🟢 Live / 🟡 Idle / 🔴 Offline with `lastEventTime` tracking.
- ❌ **Verdict badge missing border:** Badge has `bg + color` but no `border` property. Spec: `border: 'border-green-700'` etc.
- ❌ **Max 20 items:** Not enforced in polling implementation (shows all from API).
- ❌ **No hover-pause:** Spec requires `onMouseEnter` pauses scroll.

**Action for Dev:**
1. Add "Live Feed" tab to Shield page tab bar
2. Implement `EventSource('/api/shield/stream')` or keep polling but create the tab
3. Add SSE endpoint `/api/shield/stream`
4. Add Pause button + connection status indicator
5. Add border to verdict badges
6. Cap items at 20 with auto-scroll

---

### ❌ MISSING — Gantt / Timeline View (WI-050)

**File checked:** `app/(dashboard)/tasks/page.tsx`

Tasks page implements a Kanban board (DnD context with `@dnd-kit/core`) only. **No Timeline/Gantt view detected.**

Missing:
- `[📋 Board] [📅 Timeline]` pill toggle in header
- CSS Grid Gantt layout with day columns
- Task bars with status colors
- Week/Month zoom levels
- `localStorage` persisted view preference
- "Today" button
- Gantt skeleton loader (`SkeletonTimeline`)

**Action for Dev:** Full implementation required per WI-050 spec.

---

### ❌ MISSING — Agent Spawn Panel (WI-053)

**Files checked:** `app/(dashboard)/agents/page.tsx`

The Agents page has no Spawn Agent button or modal. A spawn modal **does exist on the home page** (`page.tsx` lines 396, 703) but it's a simplified inline implementation, not the `AgentSpawnModal` component specified.

Missing from `/agents`:
- `[⚡ Spawn Agent]` button in page header
- `AgentSpawnModal` component at `components/dashboard/AgentSpawnModal.tsx`
- Agent selector dropdown (all 13 agents)
- Task description textarea with character counter
- Model override dropdown
- Timeout field
- Submit states (idle / submitting / success / error)
- Focus trap + Escape key close
- Mobile: bottom sheet treatment

**Action for Dev:** Extract/create `AgentSpawnModal` component and integrate into Agents page header.

---

### ❌ MISSING — Docker Containers Panel (WI-066)

**File checked:** `app/(dashboard)/system/page.tsx`

System page shows: CPU, RAM, Disk, Uptime, Swap, Network stat cards + PM2 processes list. **No Docker section.**

Missing:
- "Docker Containers" section header with Refresh button
- Container table (Name / Status / Image / Uptime / Actions)
- Docker status badges (running/exited/paused/created)
- Stop / Start / Restart action buttons with confirmation dialog
- Fallback states (Docker not installed / daemon offline / no containers)
- 3-row skeleton loader while loading
- Docker data included in `/api/system` response

**Action for Dev:** Full implementation required per WI-066 spec.

---

### ⚠️ PARTIAL — PageHeader Component (WI-072)

**File:** `components/ui/PageHeader.tsx` ✅ Exists

**What's correct:**
- ✅ Component accepts `title`, `emoji`, `actions`, `subtitle`, `sticky`, `badge` props
- ✅ Badge rendering with custom color
- ✅ Sticky positioning with `z-40`
- ✅ Correct CSS variables for bg and border

**Deviations:**
- ⚠️ **Wrong location:** At `components/ui/PageHeader.tsx`. Spec requires `components/dashboard/PageHeader.tsx`.
- ❌ **Not used by any dashboard page:** Searched all 12 dashboard pages — none import `PageHeader`. Each page implements its own custom header (sticky div with inline styles).
- ⚠️ **Prop difference:** Component uses `emoji?: string` (string) instead of `icon?: LucideIcon` as spec defines. No icon-in-box rendering pattern.

**Action for Dev:**
1. Move to `components/dashboard/PageHeader.tsx`
2. Update `icon` prop to accept `LucideIcon` type with icon-in-box rendering
3. Integrate into all dashboard pages (replace custom headers)

---

### ⚠️ PARTIAL — Skeleton Patterns (WI-072)

**Status:** Each page has its own local `Skeleton` component. No centralized `components/dashboard/Skeletons.tsx`.

**Verified implementations:**
- `/` home page: `function Skeleton({ className })` with `animate-pulse` + `background: '#2c333a'` ✅
- `/activity`: Local `Skeleton` + `SkeletonList` (8 rows) ✅
- `/system`: Inline `animate-pulse` divs (no extracted Skeleton function)

**Deviations:**
- ❌ No `components/dashboard/Skeletons.tsx` file — `SkeletonCardGrid`, `SkeletonTable`, `SkeletonList`, `SkeletonStatRow`, `SkeletonTimeline` patterns not centralized
- ⚠️ `system/page.tsx` uses raw inline `animate-pulse` divs without a Skeleton component
- ⚠️ Inconsistent background values: home uses `#2c333a` (correct per spec); activity uses `var(--border)` (may vary by theme)

**Action for Dev:**
1. Create `components/dashboard/Skeletons.tsx` with all 5 named patterns (A–E)
2. Refactor all pages to import from shared file
3. Standardize background to `#2c333a` per spec

---

## Priority Fix Order

| Priority | WI | Component | Effort |
|----------|----|-----------|--------|
| 🔴 P1 | WI-062 | ExamAlertBanner — fix icon + pill blocks | Low |
| 🔴 P1 | WI-066 | Docker Containers Panel | Medium |
| 🟠 P2 | WI-053 | Agent Spawn Panel on /agents | Medium |
| 🟠 P2 | WI-059 | Scan Feed — SSE + Live Feed tab | Medium |
| 🟡 P3 | WI-052 | Sparkline color + area fill + trend badge | Low |
| 🟡 P3 | WI-072 | Centralize PageHeader + Skeletons | Medium |
| 🟢 P4 | WI-050 | Gantt Timeline | High |

---

*Review complete. Source inspection only — no screenshots (Playwright not installed in testforge). Recommend taking browser screenshots after P1/P2 fixes for visual validation.*
