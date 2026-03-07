# Intent: Dashboard V2 — Performance & Operational Intelligence

**Created:** 2026-03-07
**Author:** Bea 📋 (BA/Spec Agent)
**Flow:** FIRE ⚡
**Project:** max-dashboard (Next.js 14, TypeScript, Tailwind, Prisma, PostgreSQL)
**Repo root:** `/root/projects/max-dashboard`

---

## Objective

Transform the Max Dashboard home page from a task-centric summary into a full operational command center. Vince should open the dashboard and see — in under 2 seconds — the state of infrastructure, agents, email, security, and PromptDome alongside existing task metrics. The page must load instantly with skeleton UI and stream data progressively.

## Success Criteria

1. Dashboard first-paint under 500ms (static shell + skeletons)
2. All data panels populated within 3s via streaming SSE
3. Gmail inbox, infrastructure health, PromptDome stats, agent activity, and security alerts all visible on the home page without navigation
4. No blocking server-side fetches on initial page load
5. Live data refresh every 30s without full page reload (existing SSE pattern extended)

## Constraints

- Next.js 14 App Router (app directory at `/root/projects/max-dashboard/app/`)
- PostgreSQL on port 5433 (connection string: `postgresql://postgres:IttpQGczrT91qrdUEHENGsYvpnRIN6aa@127.0.0.1:5432/max_dashboard`)
- JWT cookie auth required for all API routes
- Mobile-first design (current dark theme: bg `#1d2125`, card `#22272b`, border `#2c333a`)
- PM2 and Docker data sourced from shell commands (not DB)
- PromptDome API at `promptdome.cyberforge.one` (or localhost:3011)
- Existing SSE endpoint: `/api/dashboard/stream`
- All 13 agents: Max, Alex, Sam, Bea, Dev, Quinn, Umi, Dex, Cleo, Wren, Kai, Ops, Maya

---

## Work Items

---

### WI-040: Performance — Skeleton Loading, Streaming SSE, Cache Headers

**Complexity:** M (Medium)

#### Description

The dashboard home page (`/root/projects/max-dashboard/app/(dashboard)/page.tsx`) currently calls `fetchAll()` on mount which fires 4 parallel fetches. The page shows nothing until all resolve. This WI eliminates the blocking pattern:

1. **Skeleton-first render** — The page renders immediately with skeleton placeholders for every panel. Each panel independently transitions to real data when its fetch resolves. The existing `Skeleton` component is already defined in `page.tsx` — extend its usage to all new panels.

2. **Granular SSE streaming** — Extend `/root/projects/max-dashboard/app/api/dashboard/stream/route.ts` to emit typed events (`health`, `tasks`, `gmail`, `infra`, `promptdome`, `agents`, `security`) instead of generic `message`. Each panel subscribes to its own event type and updates independently.

3. **Remove monolithic `fetchAll()`** — Replace with per-panel fetch hooks. Each panel fetches its own data on mount, with individual loading states. SSE updates replace polling for real-time panels.

4. **Cache headers** — Add `Cache-Control: s-maxage=30, stale-while-revalidate=60` to all dashboard API routes. Add `revalidate = 30` to any server components if introduced.

5. **Suspense boundaries** — Wrap each dashboard panel in a React Suspense boundary with skeleton fallback so panels load independently.

#### Acceptance Criteria

- [ ] Dashboard page renders skeleton UI within 500ms (no white screen, no spinner)
- [ ] Each panel transitions from skeleton to data independently (one slow API doesn't block others)
- [ ] SSE stream emits typed events; client handles each type separately
- [ ] `fetchAll()` removed; replaced with per-panel data fetching
- [ ] Browser DevTools shows `Cache-Control` headers on all `/api/dashboard/*` responses
- [ ] Lighthouse Performance score ≥ 90 on mobile simulation
- [ ] No hydration mismatches (time-dependent values initialized empty on server)

#### Files to Create/Modify

| Action | Path |
|--------|------|
| Modify | `/root/projects/max-dashboard/app/(dashboard)/page.tsx` — split into panel components with individual loading |
| Modify | `/root/projects/max-dashboard/app/api/dashboard/stream/route.ts` — typed SSE events |
| Create | `/root/projects/max-dashboard/hooks/useDashboardSSE.ts` — custom hook for typed SSE subscription |
| Create | `/root/projects/max-dashboard/hooks/usePanelFetch.ts` — generic panel data fetcher with loading/error states |
| Create | `/root/projects/max-dashboard/components/dashboard/DashboardSkeleton.tsx` — full-page skeleton layout |

#### Execution Mode: Confirm (1 checkpoint: plan review)

#### Dependencies: None (foundational — all other WIs depend on this pattern)

#### Out of Scope
- Server Components migration (keep client-side for now; SSE requires `'use client'`)
- Service worker caching strategy
- CDN layer

---

### WI-041: Gmail Inbox Panel

**Complexity:** M (Medium)

#### Description

Add a "Gmail Inbox" panel to the dashboard showing the last 5 emails from `max08022026@gmail.com`. Max already monitors this inbox hourly via cron. This panel surfaces that data visually.

**Panel displays:**
- Unread count badge in panel header
- For each email: sender name/address, subject line (truncated), received time (relative), read/unread indicator
- Action taken badge: if Max executed an instruction from this email, show "✅ Executed" with task link; otherwise show "📨 Received"
- Phishing verdict badge: "🛡 Safe" (green), "⚠ Suspicious" (amber), "🚫 Blocked" (red) — sourced from phishing-detector skill results

**Data source:** New API endpoint that reads Gmail via IMAP or Google API (whichever Max's existing gmail-monitor cron uses). If direct Gmail API access isn't available, the endpoint reads from a local cache file that the gmail-monitor cron writes.

#### Acceptance Criteria

- [ ] Panel shows on dashboard home page below the stat chips row
- [ ] Displays up to 5 most recent emails with sender, subject, time
- [ ] Unread count shown in panel header badge
- [ ] Each email shows phishing verdict badge (Safe/Suspicious/Blocked)
- [ ] Each email shows action status (Executed with link, or Received)
- [ ] Panel shows skeleton while loading
- [ ] "View all →" link navigates to Comms page
- [ ] Empty state: "No recent emails" with appropriate icon
- [ ] Auto-refreshes via SSE `gmail` event type

#### Files to Create/Modify

| Action | Path |
|--------|------|
| Create | `/root/projects/max-dashboard/components/dashboard/GmailInboxPanel.tsx` |
| Create | `/root/projects/max-dashboard/app/api/dashboard/gmail/route.ts` — returns last 5 emails with metadata |
| Modify | `/root/projects/max-dashboard/app/api/dashboard/stream/route.ts` — add `gmail` event emission |
| Modify | `/root/projects/max-dashboard/app/(dashboard)/page.tsx` — integrate GmailInboxPanel |
| Create | `/root/projects/max-dashboard/lib/gmail.ts` — Gmail data fetching logic (IMAP/API/cache) |

#### Execution Mode: Confirm (1 checkpoint: plan review — Gmail auth strategy)

#### Dependencies: WI-040 (skeleton + SSE pattern)

#### Out of Scope
- Sending emails from dashboard
- Full email body preview
- Gmail OAuth flow (use existing service account or app password from gmail-monitor cron)

---

### WI-042: Infrastructure Health Panel

**Complexity:** M (Medium)

#### Description

Add an "Infrastructure" panel showing real-time PM2 process and Docker container status. The existing System Health section only shows gateway status, RAM, and disk. This panel provides process-level visibility.

**PM2 Section:**
- Table/list of all PM2 processes: name, status (online/errored/stopped), uptime, restarts, memory usage
- Color-coded status: green (online), red (errored), grey (stopped)
- Processes: PromptDome, TestForge, testforge-worker (x2), testforge-webhook-worker, max-dashboard, price-calculator, price-frontend, abacus-frontend

**Docker Section:**
- Table/list of all Docker containers: name, status (running/stopped/exited), uptime
- Color-coded: green (running), red (exited), grey (stopped)
- Containers: ciso, 27001-cybertrust, healtest (STOPPED), defensewatch (STOPPED)

**Data source:** API endpoint runs `pm2 jlist` and `docker ps -a --format json` on the server. Cached for 30s.

#### Acceptance Criteria

- [ ] Panel shows on dashboard with PM2 and Docker sections
- [ ] PM2 list shows: name, status badge (color-coded), uptime, restart count, memory (MB)
- [ ] Docker list shows: name, status badge (color-coded), uptime
- [ ] Live refresh every 30s via SSE `infra` event
- [ ] Errored/stopped processes surface visually (red highlight, sorted to top)
- [ ] Panel shows skeleton while loading
- [ ] Clicking a PM2 process navigates to System page
- [ ] Total counts shown in header: "8 processes · 4 containers" with error count if any

#### Files to Create/Modify

| Action | Path |
|--------|------|
| Create | `/root/projects/max-dashboard/components/dashboard/InfraHealthPanel.tsx` |
| Create | `/root/projects/max-dashboard/app/api/dashboard/infra/route.ts` — runs pm2 jlist + docker ps, returns JSON |
| Modify | `/root/projects/max-dashboard/app/api/dashboard/stream/route.ts` — add `infra` event emission |
| Modify | `/root/projects/max-dashboard/app/(dashboard)/page.tsx` — integrate InfraHealthPanel |
| Create | `/root/projects/max-dashboard/lib/infra.ts` — PM2 + Docker data parsing utilities |

#### Execution Mode: Autopilot (well-defined, shell commands → JSON)

#### Dependencies: WI-040 (skeleton + SSE pattern)

#### Out of Scope
- PM2 process start/stop/restart from this panel (System page already handles that via `/api/system/pm2/[name]/[action]`)
- Docker container management (start/stop)
- Nginx/systemd service status

---

### WI-043: PromptDome Live Stats Panel

**Complexity:** M (Medium)

#### Description

Add a "PromptDome" panel showing live scan statistics from the PromptDome product. PromptDome is Evvo Labs' AI prompt injection protection SaaS running at `promptdome.cyberforge.one` (port 3011 locally).

**Panel displays:**
- **Hero stat:** Total scans today (large number)
- **Breakdown bar:** Block / Warn / Allow counts with color-coded proportional bar (red/amber/green)
- **Top 3 threat categories** this week (e.g., "Prompt Injection", "Jailbreak Attempt", "Data Exfiltration") with counts
- **Recent activity feed:** Last 5 scan events with timestamp, verdict, truncated input preview
- **Customer count:** Total active API customers

**Data source:** Existing endpoints — `/api/shield/stats` and `/api/shield/logs` are already in the codebase. Extend or proxy from PromptDome's own API if needed.

#### Acceptance Criteria

- [ ] Panel shows on dashboard with hero stat, breakdown bar, threats, activity feed
- [ ] Total scans today shown as large prominent number
- [ ] Block/Warn/Allow shown as horizontal stacked bar with counts
- [ ] Top 3 threat categories listed with count badges
- [ ] Last 5 scan events shown with time, verdict badge, preview
- [ ] Customer count displayed in panel header or footer
- [ ] "View details →" links to Shield page
- [ ] Panel shows skeleton while loading
- [ ] Auto-refreshes via SSE `promptdome` event

#### Files to Create/Modify

| Action | Path |
|--------|------|
| Create | `/root/projects/max-dashboard/components/dashboard/PromptDomePanel.tsx` |
| Create | `/root/projects/max-dashboard/app/api/dashboard/promptdome/route.ts` — aggregates scan stats |
| Modify | `/root/projects/max-dashboard/app/api/dashboard/stream/route.ts` — add `promptdome` event |
| Modify | `/root/projects/max-dashboard/app/(dashboard)/page.tsx` — integrate PromptDomePanel |
| Create | `/root/projects/max-dashboard/lib/promptdome.ts` — PromptDome API client / data aggregation |

#### Execution Mode: Confirm (1 checkpoint: API data source confirmation)

#### Dependencies: WI-040 (skeleton + SSE pattern)

#### Out of Scope
- PromptDome customer management from dashboard
- Scan configuration / rule editing
- Historical trend charts (future WI)

---

### WI-044: Agent Activity Feed

**Complexity:** S (Small)

#### Description

Enhance the existing "Recent Agent Activity" section on the dashboard into a richer panel showing recent completions from all 13 agents. The current implementation (`agentRuns` state) already fetches from `/api/agents?hours=6` and shows job name, status, time, duration, and token count. This WI enriches it.

**Enhanced panel displays:**
- Agent name (extracted from job name or mapped) with agent emoji/avatar
- Model used (e.g., `claude-sonnet-4-20250514`, `gpt-4o`)
- Token count (input + output breakdown if available)
- Cost (already available as `costUsd`)
- Task summary (first 80 chars of the job output or description)
- Duration with visual indicator (fast < 30s green, medium < 2m amber, slow > 2m red)
- Filter tabs: All | Succeeded | Failed

**Data source:** Extend existing `/api/agents` endpoint to include model name and task summary fields.

#### Acceptance Criteria

- [ ] Panel shows all 13 agents' recent activity (last 6 hours)
- [ ] Each entry shows: agent name, model, tokens, cost, duration, task summary
- [ ] Duration color-coded: green (< 30s), amber (30s–2m), red (> 2m)
- [ ] Filter tabs: All / Succeeded / Failed — client-side filtering
- [ ] Agent name shown with identifying emoji or color dot
- [ ] "View all →" links to Agents page
- [ ] Panel shows skeleton while loading
- [ ] Auto-refreshes via SSE `agents` event

#### Files to Create/Modify

| Action | Path |
|--------|------|
| Create | `/root/projects/max-dashboard/components/dashboard/AgentActivityPanel.tsx` — replaces inline agent section |
| Modify | `/root/projects/max-dashboard/app/api/agents/route.ts` — add model + summary fields to response |
| Modify | `/root/projects/max-dashboard/app/api/dashboard/stream/route.ts` — add `agents` event |
| Modify | `/root/projects/max-dashboard/app/(dashboard)/page.tsx` — replace inline agent section with AgentActivityPanel |
| Create | `/root/projects/max-dashboard/lib/agents.ts` — agent metadata map (name → emoji, color) |

#### Execution Mode: Autopilot (extending existing pattern)

#### Dependencies: WI-040 (skeleton + SSE pattern)

#### Out of Scope
- Agent configuration/management (Agents page handles this)
- Historical agent performance analytics
- Agent cost budgeting

---

### WI-045: Security Alerts Widget

**Complexity:** M (Medium)

#### Description

Add a unified "Security Alerts" widget that aggregates all security-relevant events into a single prioritized feed. Currently, security signals are scattered across Gmail (phishing), Shield (PromptDome blocks), and Jobs (cron failures). This widget unifies them.

**Alert sources:**
1. **Phishing detections** — from Gmail monitor's phishing-detector skill results. Fields: email sender, subject, verdict (suspicious/blocked), detection time
2. **PromptDome blocks** — scan events where verdict = BLOCK. Fields: source IP/customer, threat category, blocked input preview, time
3. **Cron failures** — jobs with `lastStatus: 'error'` or consecutive errors. Fields: job name, error count, last failure time, consecutive failures

**Widget displays:**
- Severity-sorted feed: Critical (phishing blocked, PromptDome blocks) → Warning (suspicious emails, cron errors) → Info (resolved alerts)
- Each alert: icon, severity badge, title, source, time (relative)
- Total alert count in header with severity breakdown
- "Dismiss" action per alert (marks as acknowledged, doesn't delete)
- Expandable detail on tap

**Data source:** New composite API endpoint that queries Gmail cache, Shield logs, and Jobs API, merges and sorts by severity + time.

#### Acceptance Criteria

- [ ] Widget shows on dashboard with unified alert feed
- [ ] Alerts sourced from: phishing detections, PromptDome blocks, cron failures
- [ ] Each alert shows: severity icon, title, source label, relative time
- [ ] Severity levels: Critical (red), Warning (amber), Info (blue) — visually distinct
- [ ] Alerts sorted: Critical first, then Warning, then Info; within same severity, newest first
- [ ] Total count badge in header with severity breakdown (e.g., "3 alerts · 1 critical")
- [ ] Empty state: "All clear — no active alerts ✅"
- [ ] Panel shows skeleton while loading
- [ ] Auto-refreshes via SSE `security` event
- [ ] Clicking an alert navigates to relevant page (Shield for PromptDome, Comms for phishing, Jobs for cron)

#### Files to Create/Modify

| Action | Path |
|--------|------|
| Create | `/root/projects/max-dashboard/components/dashboard/SecurityAlertsWidget.tsx` |
| Create | `/root/projects/max-dashboard/app/api/dashboard/security/route.ts` — composite alert aggregator |
| Modify | `/root/projects/max-dashboard/app/api/dashboard/stream/route.ts` — add `security` event |
| Modify | `/root/projects/max-dashboard/app/(dashboard)/page.tsx` — integrate SecurityAlertsWidget |
| Create | `/root/projects/max-dashboard/lib/security-alerts.ts` — alert source aggregation + severity mapping |
| Create | `/root/projects/max-dashboard/types/alerts.ts` — SecurityAlert, AlertSeverity, AlertSource types |

#### Execution Mode: Confirm (1 checkpoint: plan review — alert source integration)

#### Dependencies: WI-040 (skeleton + SSE pattern), WI-041 (Gmail data for phishing alerts), WI-043 (PromptDome data for block alerts)

#### Out of Scope
- Alert persistence in database (future — currently derived from source data)
- Alert notification push (email/Discord — handled by existing cron jobs)
- Alert rules configuration
- Historical alert analytics

---

## Dashboard Layout (Recommended Panel Order)

```
┌─────────────────────────────────────┐
│ Header (greeting, time, SSE dot)    │
├─────────────────────────────────────┤
│ Stat Chips (Active · Overdue · Urg) │  ← existing
├─────────────────────────────────────┤
│ 🚨 Security Alerts Widget          │  ← WI-045 (top if alerts exist)
├─────────────────────────────────────┤
│ 📬 Gmail Inbox Panel               │  ← WI-041
├─────────────────────────────────────┤
│ ✅ Pending Approvals               │  ← existing
├─────────────────────────────────────┤
│ 🛡 PromptDome Live Stats           │  ← WI-043
├─────────────────────────────────────┤
│ 🏗 Infrastructure Health            │  ← WI-042
├─────────────────────────────────────┤
│ 🤖 Agent Activity Feed             │  ← WI-044 (enhanced)
├─────────────────────────────────────┤
│ 📊 Task Progress (ring + breakdown)│  ← existing
├─────────────────────────────────────┤
│ ⏰ Upcoming · 48h                   │  ← existing
├─────────────────────────────────────┤
│ ⚡ Quick Actions                    │  ← existing
├─────────────────────────────────────┤
│ 🖥 System Health (RAM/Disk/Gateway) │  ← existing
└─────────────────────────────────────┘
```

Security Alerts Widget conditionally renders at the top ONLY when there are active alerts. When empty, it's hidden entirely (no empty card).

---

## Implementation Order

1. **WI-040** (Performance) — foundational; establishes skeleton + SSE patterns all panels depend on
2. **WI-042** (Infrastructure) — lowest external dependency; pure shell commands
3. **WI-044** (Agent Activity) — extends existing pattern; smallest scope
4. **WI-043** (PromptDome) — depends on existing Shield API routes
5. **WI-041** (Gmail) — requires Gmail data source investigation
6. **WI-045** (Security Alerts) — depends on WI-041 + WI-043 data availability

---

## Shared Types

Create `/root/projects/max-dashboard/types/dashboard.ts`:

```typescript
export interface DashboardPanel<T> {
  data: T | null
  loading: boolean
  error: string | null
  lastUpdated: number | null
}

export type SSEEventType = 'health' | 'tasks' | 'gmail' | 'infra' | 'promptdome' | 'agents' | 'security' | 'ping'

export interface SSEMessage {
  type: SSEEventType
  data: unknown
  timestamp: number
}
```

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gmail API auth complexity | WI-041 delayed | Fallback to local cache file from existing cron |
| PM2/Docker shell commands slow | WI-042 sluggish | 30s cache + SSE push (not polling) |
| PromptDome API unavailable | WI-043 empty panel | Graceful degradation: "PromptDome offline" state |
| Too many panels on mobile | UX cluttered | Collapsible panels with persist-in-localStorage |
| SSE connection limits | Multiple tabs break | Single SSE with event multiplexing (already the pattern) |
