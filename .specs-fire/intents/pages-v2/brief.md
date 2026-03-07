# Intent: Pages V2 — Operational Intelligence Across All Dashboard Pages

**Created:** 2026-03-07
**Author:** Bea 📋 (BA/Spec Agent)
**Flow:** FIRE ⚡
**Project:** max-dashboard (Next.js 14, TypeScript, Tailwind, Prisma, PostgreSQL)
**Repo root:** `/root/projects/max-dashboard`

---

## Objective

Upgrade every page in the Max Dashboard from functional-but-basic to operationally complete. Each page should surface the data Vince actually needs for daily decision-making — cost visibility, real-time feeds, batch operations, and integration with Gmail, Docker, and calendar. Every improvement maps to a concrete operational gap identified from the current codebase.

## Success Criteria

1. All 11 pages improved with the enhancements specified below
2. No new external dependencies beyond what's already in `package.json` (recharts, date-fns, lucide-react, @dnd-kit)
3. Every new panel/feature has skeleton loading states (consistent with existing pattern)
4. Mobile-first responsive — works on Vince's phone
5. All API routes JWT-protected (existing middleware pattern)
6. No regressions to existing functionality

## Constraints

- Next.js 14 App Router, TypeScript strict
- PostgreSQL on port 5432 (existing Prisma schema)
- JWT cookie auth on all API routes
- Dark theme: bg `#1d2125`, card `#22272b`, border `#2c333a`
- PM2 + Docker data from shell commands, not DB
- Existing SSE pattern for live data (EventSource)
- 13 agents: Max, Alex, Sam, Bea, Dev, Quinn, Umi, Dex, Cleo, Wren, Kai, Ops, Maya

---

## Work Items

---

### WI-050: Tasks — Timeline/Gantt View Toggle

**Page:** Tasks (`/tasks`)
**What:** Add a "Timeline" view toggle alongside the existing Kanban board. Renders tasks with due dates on a horizontal timeline (week view), grouped by label. Uses the existing `recharts` library or pure CSS/SVG. Toggle between Kanban ↔ Timeline persists in localStorage.
**Why:** Vince manages tasks across 6 labels (WORK, PERSONAL, CONSULTING, VAPT, DEFENSEWATCH, REMINDER). A timeline view shows upcoming deadlines at a glance — critical for the ISO exam prep and consulting deliverables.
**Acceptance Criteria:**
- [ ] Toggle button in page header switches between "Board" and "Timeline" views
- [ ] Timeline shows tasks with `dueDate` on a horizontal week axis, grouped by label
- [ ] Tasks without `dueDate` shown in an "Unscheduled" row
- [ ] Clicking a task in timeline opens the same detail modal as Kanban
- [ ] View preference persisted in localStorage
- [ ] Skeleton loading state for timeline view
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/tasks/page.tsx`
**Complexity:** L

---

### WI-051: Tasks — Bulk Operations (Multi-Select, Status Change, Delete)

**Page:** Tasks (`/tasks`)
**What:** Add multi-select mode: long-press or checkbox toggle enables selection. Bulk action bar appears at bottom with: Move to Status, Change Label, Archive, Delete. Uses existing PATCH/DELETE API endpoints.
**Why:** With 50+ tasks across statuses, individually updating tasks is slow. Bulk operations are essential for weekly task grooming.
**Acceptance Criteria:**
- [ ] Multi-select toggle in header activates checkbox mode on each task card
- [ ] Selecting 1+ tasks shows a floating action bar with: Move to [status], Change Label, Archive, Delete
- [ ] Bulk status change calls PATCH on each selected task (or a new batch endpoint)
- [ ] Bulk delete calls DELETE with confirmation dialog
- [ ] Selection count badge visible in action bar
- [ ] Works in both Kanban and List views
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/tasks/page.tsx`
- `/root/projects/max-dashboard/app/api/tasks/route.ts` (optional: add batch endpoint)
**Complexity:** M

---

### WI-052: Agents — Token Usage Sparklines & Cost Tracking

**Page:** Agents (`/agents`)
**What:** Add per-agent mini sparkline charts showing token usage over the last 7 days. Display cumulative cost (USD) per agent based on model pricing. Add a "model" badge next to each agent name. Data sourced from existing `/api/agents` runs data which already includes `costUsd` and `usage` fields.
**Why:** Agent cost visibility is critical — 13 agents running 20+ cron jobs can burn tokens fast. Vince needs to see which agents are expensive and trending up.
**Acceptance Criteria:**
- [ ] Each agent card shows a 7-day token usage sparkline (inline SVG, ~60px tall)
- [ ] Total cost (USD) displayed per agent for selected time range (7d/30d toggle)
- [ ] Model badge (e.g., "claude-sonnet-4-20250514", "gpt-4o") shown on each agent card
- [ ] Top-level summary: total cost across all agents for the period
- [ ] Sparkline data sourced from runs aggregated by day
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/agents/page.tsx`
- `/root/projects/max-dashboard/app/api/agents/route.ts` (add cost aggregation if not present)
**Complexity:** M

---

### WI-053: Agents — Spawn Agent Button & Active Session Management

**Page:** Agents (`/agents`)
**What:** Add a "Spawn Agent" button that opens a modal to trigger an ad-hoc agent run. Fields: agent name (dropdown of 13), message/prompt (textarea), target channel (optional). Calls existing OpenClaw API. Also add a "Kill" button on active sessions (already partially exists).
**Why:** Vince sometimes needs to manually trigger an agent (e.g., "run Bea to spec this feature") from the dashboard instead of Discord.
**Acceptance Criteria:**
- [ ] "Spawn Agent" button in page header opens a modal
- [ ] Modal has: agent selector (13 agents), message textarea, optional target channel
- [ ] Submit calls backend to trigger agent run via OpenClaw CLI or API
- [ ] Success/error toast feedback
- [ ] Active sessions list shows "Kill" button (uses existing `/api/agents/kill`)
- [ ] Kill confirmation dialog before terminating
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/agents/page.tsx`
- `/root/projects/max-dashboard/app/api/agents/route.ts` (add spawn endpoint)
**Complexity:** M

---

### WI-054: Jobs — Batch Enable/Disable & Category Filtering

**Page:** Jobs (`/jobs`)
**What:** Add batch enable/disable: checkboxes on jobs, floating action bar to enable/disable selected. Add category filter chips (existing `category` field) at the top. Jobs already have `enabled` field and individual toggle — this extends to bulk.
**Why:** During maintenance windows or cost control, Vince needs to disable a category of jobs (e.g., all "monitoring" jobs) in one click instead of toggling 10 individually.
**Acceptance Criteria:**
- [ ] Category filter chips at top (derived from job categories in data)
- [ ] Multi-select checkboxes on job rows
- [ ] Floating action bar: "Enable Selected", "Disable Selected" when 1+ selected
- [ ] Batch toggle calls PATCH on each job's enable/disable endpoint
- [ ] Select All / Deselect All in action bar
- [ ] Visual feedback: toggled jobs update immediately (optimistic)
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/jobs/page.tsx`
- `/root/projects/max-dashboard/app/api/jobs/[id]/route.ts`
**Complexity:** M

---

### WI-055: Jobs — Run History Timeline & Cost-Per-Job

**Page:** Jobs (`/jobs`)
**What:** Add an inline expandable "Run History" panel per job showing last 10 runs as a mini timeline (status dots: green/red/yellow). Show cost-per-job (sum of `costUsd` from runs). Add a total cost summary card at the top of the page.
**Why:** When a job fails, Vince needs to see the pattern — is it flaky (alternating pass/fail) or broken (10 failures in a row)? Cost-per-job tells him which jobs are worth the spend.
**Acceptance Criteria:**
- [ ] Expandable row per job shows last 10 runs as colored dots (green=ok, red=error, yellow=timeout)
- [ ] Hovering a dot shows: timestamp, duration, error message (if any)
- [ ] Cost-per-job displayed on each job card (sum of run costs)
- [ ] Top-of-page summary: total job cost (7d), total runs, success rate
- [ ] Run history fetched from existing `/api/jobs/[id]/runs` endpoint
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/jobs/page.tsx`
- `/root/projects/max-dashboard/app/api/jobs/[id]/runs/route.ts`
**Complexity:** M

---

### WI-056: Brain — Full-Text Search Across Knowledge Base

**Page:** Brain (`/brain`)
**What:** Add a search bar that searches across all knowledge base files and memory files by content. Backend `grep`-based search returns matching files with line snippets. Results shown as a list with file name, matched line, and click-to-open.
**Why:** The knowledge base has 20+ files across multiple directories. Currently you can only browse — no way to find "where did I document the Shield API key rotation?"
**Acceptance Criteria:**
- [ ] Search input at top of Brain page with debounced search (300ms)
- [ ] Backend API endpoint performs `grep -rni` across knowledge base directory
- [ ] Results show: file path, line number, matched text (highlighted)
- [ ] Clicking a result opens the file viewer at that content
- [ ] Empty state: "No results for [query]"
- [ ] Search works across both memory/ and 02-KNOWLEDGE/ directories
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/brain/page.tsx`
- `/root/projects/max-dashboard/app/api/brain/knowledge/route.ts` (add search endpoint or new route)
**Complexity:** M

---

### WI-057: Brain — Last-Updated Timestamps & File Metadata

**Page:** Brain (`/brain`)
**What:** Show `modified` timestamp on each file in the browser (data already returned by API but not prominently displayed). Add sort-by-modified option. Show file size in human-readable format. Add a "Recently Changed" section at the top showing the 5 most recently modified files.
**Why:** Vince needs to know if knowledge base files are stale. A file last updated 6 months ago might have outdated info. Recently-changed files surface what's actively being maintained.
**Acceptance Criteria:**
- [ ] Each file row shows relative time since modification (e.g., "2h ago", "3d ago")
- [ ] Sort toggle: alphabetical ↔ last modified
- [ ] File size shown in human format (KB/MB)
- [ ] "Recently Changed" section at top: 5 most recently modified files across all directories
- [ ] Stale files (>30 days) shown with a subtle warning indicator
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/brain/page.tsx`
**Complexity:** S

---

### WI-058: Shield — Customer Tier Breakdown Panel

**Page:** Shield (`/shield`)
**What:** Add a panel showing PromptDome scan breakdown by consumer/customer. Data already available in `stats.consumers` from `/api/shield/stats`. Render as a ranked list with bar chart showing scan volume per consumer. Add tier labels if identifiable.
**Why:** Vince needs to know which customers are actually using PromptDome and how heavily. High-volume consumers may need tier upgrades; inactive ones need outreach.
**Acceptance Criteria:**
- [ ] "Customers" panel showing consumer breakdown from existing stats data
- [ ] Horizontal bar chart ranking consumers by scan count
- [ ] Each consumer row shows: name, scan count, percentage of total, last active
- [ ] Consumers with 0 scans in last 7d flagged as "Inactive"
- [ ] Panel uses existing `stats.consumers` data (no new API needed)
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/shield/page.tsx`
**Complexity:** S

---

### WI-059: Shield — Real-Time Scan Feed with Auto-Scroll

**Page:** Shield (`/shield`)
**What:** Add a live scan feed panel that shows incoming scans in real-time via SSE. Each entry shows: timestamp, consumer, score, recommendation (allow/warn/block), text preview. Auto-scrolls but pauses on hover. Limit display to last 50 entries.
**Why:** During demos or when investigating an incident, Vince needs to see scans as they happen — not refresh the logs page manually.
**Acceptance Criteria:**
- [ ] "Live Feed" tab/panel alongside existing Stats and Logs views
- [ ] SSE endpoint streams new scan events as they're logged
- [ ] Each entry: timestamp, consumer, score badge, recommendation badge, text preview (truncated 80 chars)
- [ ] Auto-scroll to newest; pauses when user hovers/scrolls up
- [ ] "Pause" / "Resume" toggle button
- [ ] Connection status indicator (live/offline dot)
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/shield/page.tsx`
- `/root/projects/max-dashboard/app/api/shield/stream/route.ts` (new SSE endpoint)
**Complexity:** M

---

### WI-060: Comms — Gmail Inbox Integration

**Page:** Comms (`/comms`)
**What:** Add a "Gmail" tab alongside existing "Mentions" and "Actions" tabs. Fetches recent emails from `/api/dashboard/gmail` (already exists for the dashboard). Shows inbox items with: sender, subject, snippet, timestamp, phishing risk badge (if scan result attached). Click to expand full email body.
**Why:** Comms page currently only shows Teams mentions. Gmail is monitored hourly by Max — the results should be visible here, not just on the dashboard widget.
**Acceptance Criteria:**
- [ ] "Gmail" tab added to Comms page tab bar
- [ ] Fetches from existing `/api/dashboard/gmail` endpoint
- [ ] Each email row: sender, subject, snippet (2 lines), relative timestamp
- [ ] Phishing risk badge if email was scanned (Safe/Suspicious/Dangerous)
- [ ] Click to expand shows full email body (rendered safely, no raw HTML)
- [ ] Empty state when no emails
- [ ] Pull-to-refresh or refresh button
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/comms/page.tsx`
**Complexity:** M

---

### WI-061: Comms — Phishing Alert Highlight & Reply Drafting

**Page:** Comms (`/comms`)
**What:** Emails flagged as suspicious/phishing get a prominent red/orange alert banner at the top of the Comms page with count. Add a "Draft Reply" button on each email that opens a textarea with a pre-filled template. Reply drafts are saved to localStorage (not sent — that requires future integration).
**Why:** Hourly phishing scans surface threats, but they're buried in logs. A dedicated alert banner ensures Vince sees threats immediately. Reply drafting saves time on common responses.
**Acceptance Criteria:**
- [ ] Alert banner at top of Comms page: "⚠️ X suspicious emails detected" (red/orange)
- [ ] Banner clickable — scrolls to / filters the flagged emails
- [ ] Each email has a "Draft Reply" button
- [ ] Draft Reply opens inline textarea with configurable template
- [ ] Drafts auto-saved to localStorage per email ID
- [ ] Saved draft indicator on emails with existing drafts
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/comms/page.tsx`
**Complexity:** M

---

### WI-062: Calendar — Exam Countdown & Priority Event Highlighting

**Page:** Calendar (`/calendar`)
**What:** Add a prominent countdown banner for Vince's ISO 27001 Lead Auditor exam (Mar 9, 2026, 21:30 SGT). Highlight high-priority events (configurable keywords: "exam", "audit", "deadline") with a distinct visual treatment. Countdown shows days/hours remaining.
**Why:** The exam is 2 days away. This kind of high-stakes deadline needs permanent visibility, not buried in a calendar grid.
**Acceptance Criteria:**
- [ ] Countdown banner at top of calendar: "ISO 27001 Exam in X days Y hours"
- [ ] Banner prominent: large text, accent color, exam date shown
- [ ] Priority events (matching keywords) rendered with distinct border color and icon
- [ ] Countdown updates in real-time (every minute)
- [ ] Banner dismissible after event passes
- [ ] Keywords configurable (hardcoded array is fine for v1)
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/calendar/page.tsx`
**Complexity:** S

---

### WI-063: Calendar — Teams Meeting Join Buttons & Event Creation

**Page:** Calendar (`/calendar`)
**What:** Add a "Join" button on calendar events that have a `joinUrl` (Teams meetings — field already exists in `CalEvent` interface but not rendered as a button). Add "Create Event" button that opens a modal to create a task with a due date (creates a task that shows on calendar via existing task→calendar bridge).
**Why:** Vince checks the dashboard before meetings. A one-click join button saves opening Outlook. Creating tasks from the calendar view closes the loop between planning and execution.
**Acceptance Criteria:**
- [ ] Events with `joinUrl` show a "Join" button that opens the URL in a new tab
- [ ] Join button styled distinctly (Teams purple, video icon)
- [ ] "Create Event" button in calendar header opens a modal
- [ ] Modal fields: title, date, time, label (maps to task creation)
- [ ] Created event appears on calendar immediately (optimistic update)
- [ ] Join button only visible on events with non-null `joinUrl`
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/calendar/page.tsx`
- `/root/projects/max-dashboard/app/api/tasks/route.ts` (reuse existing task creation)
**Complexity:** M

---

### WI-064: Activity — Extended Event Types & Filtering

**Page:** Activity (`/activity`)
**What:** Extend the activity feed to include more event types beyond the current 4 (error, cron, learning, info). Add: `agent` (agent completions), `email` (Gmail actions), `phishing` (phishing detections), `deploy` (PM2 restarts). Update filter chips to include new types. Backend must tag events with these types.
**Why:** The activity feed is the audit trail. Currently it only shows cron runs and errors — missing 60% of what Max actually does (email monitoring, agent spawns, phishing scans).
**Acceptance Criteria:**
- [ ] New event types rendered with distinct icons and colors: agent (purple), email (blue), phishing (red), deploy (green)
- [ ] Filter chips updated to include new types
- [ ] Backend `/api/activity` returns events with new types
- [ ] Each event type has a meaningful description (not raw log lines)
- [ ] Existing SSE stream delivers new event types
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/activity/page.tsx`
- `/root/projects/max-dashboard/app/api/activity/route.ts`
- `/root/projects/max-dashboard/app/api/activity/stream/route.ts`
**Complexity:** M

---

### WI-065: Activity — Log Export & Pagination

**Page:** Activity (`/activity`)
**What:** Add a "Export" button that downloads the current filtered activity log as CSV or JSON. Add pagination or infinite scroll (currently loads all events at once, capped at 200). Add date range filter.
**Why:** Activity logs are needed for audit evidence (ISO 27001) and incident investigation. Export to CSV enables sharing with compliance reviewers. Pagination prevents performance issues as log volume grows.
**Acceptance Criteria:**
- [ ] "Export" button in header, dropdown: CSV or JSON
- [ ] Export includes all filtered events (not just visible page)
- [ ] Date range picker: Today, Last 7d, Last 30d, Custom
- [ ] Infinite scroll or "Load More" button (50 events per page)
- [ ] Total event count displayed in header
- [ ] CSV format: timestamp, type, description, raw
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/activity/page.tsx`
- `/root/projects/max-dashboard/app/api/activity/route.ts` (add pagination params)
**Complexity:** M

---

### WI-066: System — Docker Containers Panel

**Page:** System (`/system`)
**What:** Add a "Docker" panel below the existing PM2 panel. Shows running and stopped containers with: name, status, image, ports, uptime. Action buttons: start, stop, restart (same pattern as PM2 actions). Data from `docker ps -a --format json`.
**Why:** System page shows PM2 but not Docker. Vince runs 3 Docker containers (ciso, defensewatch, healtest) — managing them requires SSH. Dashboard control eliminates that.
**Acceptance Criteria:**
- [ ] "Docker Containers" panel below PM2 section
- [ ] Each container shows: name, status badge (running/stopped/exited), image name, exposed ports, uptime
- [ ] Action buttons: Start, Stop, Restart (with confirmation dialog)
- [ ] Status badge colors match PM2 pattern (green=running, red=stopped)
- [ ] Auto-refresh with system data (every 10s, existing interval)
- [ ] Graceful handling when Docker is not installed or daemon not running
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/system/page.tsx`
- `/root/projects/max-dashboard/app/api/system/route.ts` (add Docker data)
- `/root/projects/max-dashboard/app/api/system/docker/[name]/[action]/route.ts` (new: container actions)
**Complexity:** M

---

### WI-067: System — Swap Usage & Network I/O Metrics

**Page:** System (`/system`)
**What:** Add swap usage card (used/total, percentage bar) and network I/O card (bytes in/out since boot or per-minute rate). Data from `/proc/swaps` + `/proc/net/dev` or `free` + `ifstat` commands. Fits into existing StatCard grid.
**Why:** Swap pressure indicates memory exhaustion (common with 13 agents). Network I/O shows if the server is under unusual traffic load (DDoS, scraping, or healthy API traffic).
**Acceptance Criteria:**
- [ ] Swap card: used/total in MB or GB, percentage bar (matches existing RAM card style)
- [ ] Network card: bytes received/sent since boot, formatted in GB/MB
- [ ] Both cards use existing `StatCard` component pattern
- [ ] Swap >80% shows red warning color
- [ ] Data included in existing `/api/system` response
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/system/page.tsx`
- `/root/projects/max-dashboard/app/api/system/route.ts`
**Complexity:** S

---

### WI-068: Analytics — Agent Cost Trends Chart

**Page:** Analytics (`/analytics`)
**What:** Add an "Agent Costs" section with a stacked bar chart showing daily cost (USD) broken down by agent over the selected time range. Uses existing `tokens.byDay` and `tokens.byModel` data, extended with per-agent breakdown from runs.
**Why:** Analytics page shows token totals but not who's spending them. Per-agent cost trends reveal which agents or jobs are driving costs up — essential for budget control.
**Acceptance Criteria:**
- [ ] "Agent Costs" panel with stacked bar chart (daily, by agent)
- [ ] Legend showing agent names with color coding
- [ ] Hover tooltip: date, per-agent cost, total for that day
- [ ] Total cost for period shown as summary number
- [ ] Data from `/api/analytics` extended with per-agent cost breakdown
- [ ] Works with existing 7d/14d/30d range toggle
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/analytics/page.tsx`
- `/root/projects/max-dashboard/app/api/analytics/route.ts`
**Complexity:** M

---

### WI-069: Analytics — Top Tasks by Label & Completion Velocity

**Page:** Analytics (`/analytics`)
**What:** Add two panels: (1) "Tasks by Label" — donut/pie chart showing task distribution across labels (WORK, PERSONAL, CONSULTING, etc.). (2) "Completion Velocity" — line chart showing tasks completed per day over the time range. Both derived from existing task data.
**Why:** Vince needs to know where his time is going (label distribution) and whether velocity is improving or slipping. Critical for consulting capacity planning.
**Acceptance Criteria:**
- [ ] "Tasks by Label" donut chart with label counts and percentages
- [ ] Label colors match existing task label color scheme
- [ ] "Completion Velocity" line chart: tasks moved to DONE per day
- [ ] Both charts respond to time range toggle (7d/14d/30d)
- [ ] Empty state when no data for period
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/analytics/page.tsx`
- `/root/projects/max-dashboard/app/api/analytics/route.ts`
**Complexity:** M

---

### WI-070: Settings — Agent Model Overrides UI

**Page:** Settings (`/settings`)
**What:** Add an "Agent Models" section showing each agent's current model assignment with an editable dropdown to override. Models: list from a hardcoded set (claude-sonnet-4-20250514, claude-opus-4-0, gpt-4o, etc.). Saves to a config file or API that OpenClaw reads.
**Why:** Switching an agent's model currently requires editing config files via SSH. A UI toggle lets Vince experiment with cheaper models for low-priority agents without touching the server.
**Acceptance Criteria:**
- [ ] "Agent Models" section showing all 13 agents with current model
- [ ] Each agent has a dropdown to select alternative model
- [ ] Save button persists changes (to config file or database)
- [ ] Visual diff: changed models highlighted until saved
- [ ] Reset to defaults button
- [ ] Changes take effect on next agent session (not retroactive)
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/settings/page.tsx`
- `/root/projects/max-dashboard/app/api/settings/agents/route.ts` (new: agent model config CRUD)
**Complexity:** M

---

### WI-071: Settings — Gmail Monitoring Toggle & Notification Preferences

**Page:** Settings (`/settings`)
**What:** Add toggles for: (1) Gmail monitoring on/off, (2) Phishing alert notifications on/off, (3) Daily briefing on/off, (4) Error notification threshold (dropdown: all/critical/none). Each toggle maps to a config that OpenClaw cron jobs respect.
**Why:** Vince needs to be able to silence notifications during focused work or disable Gmail monitoring without editing cron configs.
**Acceptance Criteria:**
- [ ] "Notifications" section with toggle switches for each preference
- [ ] Gmail monitoring toggle: on/off with last-checked timestamp
- [ ] Phishing alerts toggle: on/off
- [ ] Daily briefing toggle: on/off
- [ ] Error threshold dropdown: All errors, Critical only, None
- [ ] Settings persisted to database or config file
- [ ] Changes confirmed with toast notification
**Files to modify:**
- `/root/projects/max-dashboard/app/(dashboard)/settings/page.tsx`
- `/root/projects/max-dashboard/app/api/settings/preferences/route.ts` (new: preferences CRUD)
**Complexity:** M

---

## Execution Order (Recommended)

**Phase 1 — Quick Wins (S complexity):**
WI-057 (Brain timestamps), WI-058 (Shield customers), WI-062 (Calendar exam countdown), WI-067 (System swap/network)

**Phase 2 — Core Operations (M complexity):**
WI-052 (Agent cost sparklines), WI-054 (Jobs batch), WI-055 (Jobs run history), WI-060 (Comms Gmail), WI-064 (Activity event types)

**Phase 3 — Enhanced UX (M complexity):**
WI-051 (Tasks bulk ops), WI-053 (Agent spawn), WI-056 (Brain search), WI-059 (Shield live feed), WI-061 (Comms phishing), WI-063 (Calendar join+create), WI-065 (Activity export)

**Phase 4 — Intelligence Layer (M complexity):**
WI-066 (System Docker), WI-068 (Analytics agent costs), WI-069 (Analytics tasks), WI-070 (Settings agent models), WI-071 (Settings notifications)

**Phase 5 — Advanced (L complexity):**
WI-050 (Tasks timeline/Gantt)

---

## Dependencies

- WI-060 (Gmail in Comms) depends on `/api/dashboard/gmail` endpoint (already exists)
- WI-059 (Shield live feed) requires new SSE endpoint
- WI-066 (Docker panel) requires Docker socket access from the API process
- WI-062 (Exam countdown) has a hard date: Mar 9, 2026 21:30 SGT — must ship before then
- WI-070/071 (Settings) require a new preferences storage mechanism (DB table or JSON config)

---

## Out of Scope

- Email sending/reply functionality (WI-061 is draft-only, not send)
- PromptDome billing/subscription management
- Agent code editing or deployment from dashboard
- Real-time collaborative editing
- Mobile native app (PWA is sufficient)
