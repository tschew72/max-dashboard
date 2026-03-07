# QA Checklist — Pages V2 Acceptance Tests

**Prepared by:** Quinn 🧪 (QA Engineer)
**Date:** 2026-03-07
**Spec:** `/root/projects/max-dashboard/.specs-fire/intents/pages-v2/brief.md`
**Target:** https://dash.vincechew.me
**Status:** Pre-build — checklist only (will execute post-implementation)

---

## WI-050: Tasks — Timeline/Gantt View Toggle — `/tasks`

- [ ] TC-1: Toggle button labelled "Board" / "Timeline" is visible in the page header
- [ ] TC-2: Clicking "Timeline" switches view from Kanban to a horizontal week-axis timeline
- [ ] TC-3: Tasks with `dueDate` appear on the correct day column in the timeline
- [ ] TC-4: Tasks are grouped by label (WORK, PERSONAL, CONSULTING, VAPT, DEFENSEWATCH, REMINDER)
- [ ] TC-5: Tasks without `dueDate` appear in an "Unscheduled" row at the bottom
- [ ] TC-6: Clicking a task in timeline opens the same detail modal as clicking it in Kanban
- [ ] TC-7: Switching to Timeline and refreshing the page — view persists (localStorage check)
- [ ] TC-8: Switching back to Board and refreshing — Board view persists
- [ ] TC-9: Clear localStorage → default view is Board (not Timeline)
- [ ] TC-10: Skeleton loading state appears within 200ms while timeline data loads
- [ ] TC-11: Timeline renders correctly on mobile viewport (375px width)
- [ ] TC-12: Edge case — no tasks exist → timeline shows empty state with "No tasks" message
- [ ] TC-13: Edge case — all tasks lack dueDate → only "Unscheduled" row is populated
- [ ] TC-14: Edge case — 50+ tasks with due dates in same week → no visual overflow/crash

---

## WI-051: Tasks — Bulk Operations — `/tasks`

- [ ] TC-1: Multi-select toggle button visible in page header
- [ ] TC-2: Activating multi-select shows checkboxes on each task card
- [ ] TC-3: Selecting 1+ tasks shows floating action bar at bottom of viewport
- [ ] TC-4: Action bar contains: Move to [status dropdown], Change Label, Archive, Delete
- [ ] TC-5: Selection count badge in action bar shows correct count (e.g., "3 selected")
- [ ] TC-6: Bulk status change — select 3 tasks → Move to "Done" → all 3 update to Done
- [ ] TC-7: Bulk label change — select 2 tasks → Change Label to "CONSULTING" → labels update
- [ ] TC-8: Bulk delete — select 2 tasks → Delete → confirmation dialog appears
- [ ] TC-9: Bulk delete — confirm deletion → tasks removed, success toast shown
- [ ] TC-10: Bulk delete — cancel deletion → tasks remain, no changes
- [ ] TC-11: Multi-select works in both Kanban and List views
- [ ] TC-12: Deactivating multi-select mode clears all selections and hides action bar
- [ ] TC-13: Edge case — select all tasks then delete → empty board state renders correctly
- [ ] TC-14: Edge case — network error during bulk operation → error toast, partial state handled gracefully
- [ ] TC-15: API calls are JWT-authenticated (401 without valid cookie)

---

## WI-052: Agents — Token Usage Sparklines & Cost Tracking — `/agents`

- [ ] TC-1: Each of the 13 agent cards shows a 7-day sparkline (~60px tall, inline SVG)
- [ ] TC-2: Sparkline reflects actual daily token usage data (not static/placeholder)
- [ ] TC-3: 7d/30d toggle switches the time range for cost display
- [ ] TC-4: Total cost (USD) displayed per agent, formatted to 2 decimal places
- [ ] TC-5: Model badge shown on each agent card (e.g., "claude-sonnet-4-20250514", "gpt-4o")
- [ ] TC-6: Top-level summary card shows total cost across all agents for selected period
- [ ] TC-7: Switching 7d ↔ 30d updates both sparklines and cost figures
- [ ] TC-8: Edge case — agent with zero runs in period → sparkline shows flat line, cost shows $0.00
- [ ] TC-9: Edge case — new agent with no historical data → sparkline renders without error
- [ ] TC-10: Skeleton loading state for sparklines appears within 200ms
- [ ] TC-11: Data sourced from runs aggregated by day (verify API response structure)
- [ ] TC-12: Mobile responsive — sparklines and cost figures don't overflow on 375px viewport

---

## WI-053: Agents — Spawn Agent Button & Active Session Management — `/agents`

- [ ] TC-1: "Spawn Agent" button visible in page header
- [ ] TC-2: Clicking button opens modal with: agent selector, message textarea, optional target channel
- [ ] TC-3: Agent selector dropdown lists all 13 agents by name
- [ ] TC-4: Message textarea accepts multi-line input
- [ ] TC-5: Submit with valid agent + message → success toast, modal closes
- [ ] TC-6: Submit with empty message → validation error shown
- [ ] TC-7: Submit with API error → error toast with message
- [ ] TC-8: Active sessions list shows each running session
- [ ] TC-9: "Kill" button visible on active sessions
- [ ] TC-10: Kill button → confirmation dialog appears ("Are you sure?")
- [ ] TC-11: Confirm kill → session terminated, removed from list, success toast
- [ ] TC-12: Cancel kill → session continues, no changes
- [ ] TC-13: Edge case — no active sessions → empty state message
- [ ] TC-14: All API calls JWT-protected (spawn + kill endpoints)

---

## WI-054: Jobs — Batch Enable/Disable & Category Filtering — `/jobs`

- [ ] TC-1: Category filter chips rendered at top of jobs page
- [ ] TC-2: Filter chips derived from actual job categories in data (not hardcoded)
- [ ] TC-3: Clicking a chip filters jobs to that category only
- [ ] TC-4: Multiple chips selectable for multi-category filtering
- [ ] TC-5: Multi-select checkboxes visible on each job row
- [ ] TC-6: Selecting 1+ jobs shows floating action bar with "Enable Selected" and "Disable Selected"
- [ ] TC-7: "Select All" / "Deselect All" buttons in action bar
- [ ] TC-8: Batch enable → all selected jobs toggled to enabled, UI updates optimistically
- [ ] TC-9: Batch disable → all selected jobs toggled to disabled, UI updates optimistically
- [ ] TC-10: Optimistic update reverts on API error with error toast
- [ ] TC-11: Edge case — select all → disable all → re-enable all → all restored
- [ ] TC-12: Edge case — filter by category then bulk toggle → only visible jobs affected
- [ ] TC-13: API calls use PATCH with JWT authentication

---

## WI-055: Jobs — Run History Timeline & Cost-Per-Job — `/jobs`

- [ ] TC-1: Each job row has an expandable "Run History" section
- [ ] TC-2: Expanding shows last 10 runs as colored dots: green=ok, red=error, yellow=timeout
- [ ] TC-3: Hovering a dot shows tooltip: timestamp, duration (ms or s), error message (if error)
- [ ] TC-4: Cost-per-job displayed on each job card (sum of `costUsd` from runs)
- [ ] TC-5: Top-of-page summary card: total job cost (7d), total runs count, success rate %
- [ ] TC-6: Success rate calculated correctly (successful / total × 100)
- [ ] TC-7: Run history fetched from `/api/jobs/[id]/runs` endpoint
- [ ] TC-8: Edge case — job with 0 runs → "No runs yet" message, cost = $0.00
- [ ] TC-9: Edge case — job with <10 runs → shows only available dots
- [ ] TC-10: Edge case — all 10 runs failed → all dots red, 0% success rate
- [ ] TC-11: Skeleton loading for run history while fetching
- [ ] TC-12: API response includes timestamp, status, duration, costUsd, error fields

---

## WI-056: Brain — Full-Text Search Across Knowledge Base — `/brain`

- [ ] TC-1: Search input visible at top of Brain page with placeholder text
- [ ] TC-2: Typing triggers search after 300ms debounce (not on every keystroke)
- [ ] TC-3: Results show: file path, line number, matched text with highlight
- [ ] TC-4: Clicking a result opens the file viewer at that content/line
- [ ] TC-5: Empty results: "No results for [query]" message displayed
- [ ] TC-6: Search works across `memory/` directory files
- [ ] TC-7: Search works across `02-KNOWLEDGE/` directory files
- [ ] TC-8: Edge case — single character query → either works or shows minimum length hint
- [ ] TC-9: Edge case — query with special regex characters (e.g., `.*+?`) → no crash
- [ ] TC-10: Edge case — search while files are being written → no error
- [ ] TC-11: Backend uses `grep -rni` or equivalent (case-insensitive)
- [ ] TC-12: Results paginated or limited to prevent huge response on broad queries
- [ ] TC-13: API endpoint JWT-protected
- [ ] TC-14: Loading state shown while search is in progress

---

## WI-057: Brain — Last-Updated Timestamps & File Metadata — `/brain`

- [ ] TC-1: Each file row shows relative time since modification (e.g., "2h ago", "3d ago")
- [ ] TC-2: Sort toggle exists: alphabetical ↔ last modified
- [ ] TC-3: Sorting by last-modified puts most recent files first
- [ ] TC-4: File size shown in human-readable format (KB, MB)
- [ ] TC-5: "Recently Changed" section at top shows exactly 5 most recently modified files
- [ ] TC-6: Recently Changed spans across all directories (not just the current view)
- [ ] TC-7: Files >30 days old show a subtle warning indicator (stale badge/icon)
- [ ] TC-8: Edge case — file modified just now → shows "just now" or "0m ago"
- [ ] TC-9: Edge case — empty directory → no files listed, no crash
- [ ] TC-10: Edge case — file size 0 bytes → shows "0 KB" or equivalent
- [ ] TC-11: Timestamps use SGT (Asia/Singapore) timezone
- [ ] TC-12: Mobile responsive — timestamps and size don't cause horizontal overflow

---

## WI-058: Shield — Customer Tier Breakdown Panel — `/shield`

- [ ] TC-1: "Customers" panel visible on Shield page
- [ ] TC-2: Horizontal bar chart ranks consumers by scan count (highest first)
- [ ] TC-3: Each consumer row shows: name, scan count, percentage of total
- [ ] TC-4: Each consumer row shows "last active" relative timestamp
- [ ] TC-5: Consumers with 0 scans in last 7d flagged with "Inactive" badge
- [ ] TC-6: Data sourced from existing `stats.consumers` (no new API call)
- [ ] TC-7: Skeleton loading state for panel
- [ ] TC-8: Edge case — no consumers → empty state message
- [ ] TC-9: Edge case — single consumer → 100% bar, no ranking needed
- [ ] TC-10: Percentage values sum to ~100% (within rounding tolerance)
- [ ] TC-11: Panel matches dark theme (bg #22272b, border #2c333a)

---

## WI-059: Shield — Real-Time Scan Feed with Auto-Scroll — `/shield`

- [ ] TC-1: "Live Feed" tab/panel visible alongside existing Stats and Logs views
- [ ] TC-2: SSE connection established on tab activation (verify via Network tab)
- [ ] TC-3: Each feed entry shows: timestamp, consumer, score badge, recommendation badge, text preview
- [ ] TC-4: Text preview truncated to 80 characters with ellipsis
- [ ] TC-5: Recommendation badge colors: allow=green, warn=yellow/orange, block=red
- [ ] TC-6: Feed auto-scrolls to newest entry as events arrive
- [ ] TC-7: Hovering/scrolling up pauses auto-scroll
- [ ] TC-8: "Pause" / "Resume" toggle button visible and functional
- [ ] TC-9: Connection status indicator: green dot when live, red/grey when disconnected
- [ ] TC-10: Feed limited to last 50 entries (older entries removed from DOM)
- [ ] TC-11: Edge case — SSE connection drops → indicator shows offline, auto-reconnect attempted
- [ ] TC-12: Edge case — no scans arriving → feed shows empty state with "Waiting for scans..."
- [ ] TC-13: Edge case — rapid burst of 20 scans → all rendered without lag or dropped entries
- [ ] TC-14: Tab switch away and back → SSE reconnects, feed resumes

---

## WI-060: Comms — Gmail Inbox Integration — `/comms`

- [ ] TC-1: "Gmail" tab added to Comms page tab bar (alongside Mentions, Actions)
- [ ] TC-2: Clicking Gmail tab fetches data from `/api/dashboard/gmail`
- [ ] TC-3: Each email row shows: sender name, subject line, snippet (2 lines max), relative timestamp
- [ ] TC-4: Phishing risk badge displayed: Safe (green), Suspicious (orange), Dangerous (red)
- [ ] TC-5: Click to expand shows full email body
- [ ] TC-6: Email body rendered safely — no raw HTML injection (XSS prevention)
- [ ] TC-7: Empty state shown when no emails returned
- [ ] TC-8: Refresh button or pull-to-refresh triggers new fetch
- [ ] TC-9: Skeleton loading state while emails are fetching
- [ ] TC-10: Edge case — API returns error → error message displayed, not blank page
- [ ] TC-11: Edge case — email with very long subject → truncated with ellipsis
- [ ] TC-12: Edge case — email without phishing scan result → no badge shown (not crash)
- [ ] TC-13: API call JWT-protected (401 without auth)
- [ ] TC-14: Mobile responsive — email rows stack properly on 375px

---

## WI-061: Comms — Phishing Alert Highlight & Reply Drafting — `/comms`

- [ ] TC-1: Alert banner at top of Comms page: "⚠️ X suspicious emails detected" when flagged emails exist
- [ ] TC-2: Banner uses red/orange styling for visibility
- [ ] TC-3: Banner is clickable — scrolls to or filters flagged emails
- [ ] TC-4: Each email has a "Draft Reply" button
- [ ] TC-5: Clicking "Draft Reply" opens inline textarea below the email
- [ ] TC-6: Textarea pre-filled with configurable template text
- [ ] TC-7: Draft auto-saved to localStorage keyed by email ID
- [ ] TC-8: Navigating away and back → saved draft restored from localStorage
- [ ] TC-9: Emails with existing drafts show a "Draft saved" indicator
- [ ] TC-10: Edge case — no suspicious emails → alert banner not shown
- [ ] TC-11: Edge case — clear localStorage → all drafts gone, no indicator
- [ ] TC-12: Edge case — very long draft text → textarea scrollable, no overflow
- [ ] TC-13: Draft is NOT sent (no send API call) — this is draft-only for v1

---

## WI-062: Calendar — Exam Countdown & Priority Event Highlighting — `/calendar`

- [ ] TC-1: Countdown banner visible at top of calendar page
- [ ] TC-2: Banner text format: "ISO 27001 Exam in X days Y hours" (or equivalent)
- [ ] TC-3: Countdown targets 2026-03-09 21:30 SGT (Asia/Singapore)
- [ ] TC-4: **Time verification:** On 2026-03-07 20:00 SGT → shows ~2 days 1 hour 30 min remaining
- [ ] TC-5: **Time verification:** On 2026-03-09 20:30 SGT → shows ~1 hour remaining
- [ ] TC-6: **Time verification:** On 2026-03-09 21:30 SGT → shows 0 or "Exam time!" message
- [ ] TC-7: Countdown updates in real-time (verify value changes every minute without refresh)
- [ ] TC-8: Banner uses prominent styling: large text, accent color, exam date displayed
- [ ] TC-9: When countdown < 24 hours → banner turns red / urgent color
- [ ] TC-10: After exam time passes → banner is dismissible or auto-hides
- [ ] TC-11: Priority events matching keywords ("exam", "audit", "deadline") have distinct border color
- [ ] TC-12: Priority events show a distinct icon (different from regular events)
- [ ] TC-13: Non-priority events render normally (no false positives)
- [ ] TC-14: Keywords are configurable (at minimum hardcoded array — verify array exists)
- [ ] TC-15: Edge case — system clock in different timezone → countdown still correct for SGT target
- [ ] TC-16: Mobile responsive — banner readable on 375px width

---

## WI-063: Calendar — Teams Meeting Join Buttons & Event Creation — `/calendar`

- [ ] TC-1: Events with `joinUrl` show a "Join" button
- [ ] TC-2: Clicking "Join" opens the URL in a new tab (`target="_blank"`)
- [ ] TC-3: Join button styled with Teams purple color and video icon
- [ ] TC-4: Events without `joinUrl` (null/undefined) do NOT show a Join button
- [ ] TC-5: "Create Event" button visible in calendar header
- [ ] TC-6: Clicking "Create Event" opens a modal
- [ ] TC-7: Modal fields: title (text), date (date picker), time (time picker), label (dropdown)
- [ ] TC-8: Submit creates a task via existing task creation API
- [ ] TC-9: Created event appears on calendar immediately (optimistic update)
- [ ] TC-10: Form validation — title required, date required
- [ ] TC-11: Success toast after creation
- [ ] TC-12: Error handling — API failure shows error toast, modal stays open
- [ ] TC-13: Edge case — create event with past date → allowed or shows warning
- [ ] TC-14: API call JWT-protected

---

## WI-064: Activity — Extended Event Types & Filtering — `/activity`

- [ ] TC-1: New event type icons with correct colors: agent (purple), email (blue), phishing (red), deploy (green)
- [ ] TC-2: Filter chips include all types: error, cron, learning, info, agent, email, phishing, deploy
- [ ] TC-3: Clicking a filter chip shows only events of that type
- [ ] TC-4: Multiple chips selectable for multi-type filtering
- [ ] TC-5: Backend `/api/activity` returns events tagged with new types
- [ ] TC-6: Each event has a meaningful human-readable description (not raw log)
- [ ] TC-7: SSE stream delivers new event types in real-time
- [ ] TC-8: Edge case — filter to type with 0 events → empty state message
- [ ] TC-9: Edge case — all filters deselected → show all events (or show nothing with hint)
- [ ] TC-10: Existing event types (error, cron, learning, info) still render correctly (no regression)
- [ ] TC-11: New event types render correctly on mobile

---

## WI-065: Activity — Log Export & Pagination — `/activity`

- [ ] TC-1: "Export" button visible in page header
- [ ] TC-2: Export dropdown offers CSV and JSON options
- [ ] TC-3: CSV export downloads file with columns: timestamp, type, description, raw
- [ ] TC-4: JSON export downloads valid JSON array of events
- [ ] TC-5: Export respects current filter (type + date range)
- [ ] TC-6: Export includes ALL filtered events, not just the visible page
- [ ] TC-7: Date range picker with presets: Today, Last 7d, Last 30d, Custom
- [ ] TC-8: Custom date range picker allows start and end date selection
- [ ] TC-9: Infinite scroll or "Load More" button — initial load ≤50 events
- [ ] TC-10: Loading more appends events without duplicates
- [ ] TC-11: Total event count displayed in header (e.g., "Showing 50 of 342")
- [ ] TC-12: Edge case — export with 0 events → empty file or "No data" message
- [ ] TC-13: Edge case — export 10,000+ events → no timeout, file downloads successfully
- [ ] TC-14: Edge case — date range with no events → empty state with message
- [ ] TC-15: CSV properly escapes commas and newlines in description/raw fields

---

## WI-066: System — Docker Containers Panel — `/system`

- [ ] TC-1: "Docker Containers" panel visible below PM2 section
- [ ] TC-2: Each container shows: name, status badge, image name, exposed ports, uptime
- [ ] TC-3: Status badge colors: green=running, red=stopped/exited
- [ ] TC-4: Action buttons per container: Start, Stop, Restart
- [ ] TC-5: Action buttons show confirmation dialog before executing
- [ ] TC-6: Stop running container → status updates to stopped, Start button becomes active
- [ ] TC-7: Start stopped container → status updates to running, Stop button becomes active
- [ ] TC-8: Restart running container → brief status change, returns to running
- [ ] TC-9: Auto-refresh with system data (every ~10s interval, matching existing pattern)
- [ ] TC-10: Edge case — Docker daemon not running → graceful error message (not crash)
- [ ] TC-11: Edge case — Docker not installed → panel shows "Docker not available" message
- [ ] TC-12: Edge case — container in "restarting" state → appropriate status shown
- [ ] TC-13: Action API endpoints JWT-protected
- [ ] TC-14: Data sourced from `docker ps -a --format json` (verify API implementation)

---

## WI-067: System — Swap Usage & Network I/O Metrics — `/system`

- [ ] TC-1: Swap card visible in StatCard grid
- [ ] TC-2: Swap card shows: used/total in MB or GB, percentage bar
- [ ] TC-3: Swap card percentage bar matches existing RAM card styling
- [ ] TC-4: Swap usage >80% → bar turns red/warning color
- [ ] TC-5: Network card visible in StatCard grid
- [ ] TC-6: Network card shows: bytes received and sent, formatted in human-readable (MB/GB)
- [ ] TC-7: Both cards use existing `StatCard` component pattern (consistent look)
- [ ] TC-8: Data included in existing `/api/system` response (no separate API call)
- [ ] TC-9: Edge case — no swap configured → card shows "No swap" or 0/0
- [ ] TC-10: Edge case — swap at exactly 80% → verify threshold behavior (red or not)
- [ ] TC-11: Cards auto-refresh with system data interval

---

## WI-068: Analytics — Agent Cost Trends Chart — `/analytics`

- [ ] TC-1: "Agent Costs" panel visible on analytics page
- [ ] TC-2: Stacked bar chart shows daily cost broken down by agent
- [ ] TC-3: Legend shows agent names with distinct color coding
- [ ] TC-4: Hover tooltip on bar shows: date, per-agent cost, total for that day
- [ ] TC-5: Total cost for period shown as summary number above or beside chart
- [ ] TC-6: Chart responds to existing 7d/14d/30d range toggle
- [ ] TC-7: Switching range reloads chart with correct data
- [ ] TC-8: Edge case — agent with $0 cost → not shown in bar (or minimal sliver)
- [ ] TC-9: Edge case — day with $0 total cost → no bar or flat bar
- [ ] TC-10: Edge case — all 13 agents active → legend readable, colors distinct
- [ ] TC-11: Data from `/api/analytics` extended with per-agent breakdown
- [ ] TC-12: Skeleton loading while chart data loads
- [ ] TC-13: Mobile responsive — chart scrollable or resizes on small screens

---

## WI-069: Analytics — Top Tasks by Label & Completion Velocity — `/analytics`

- [ ] TC-1: "Tasks by Label" donut chart visible with label counts and percentages
- [ ] TC-2: Label colors match existing task label color scheme (WORK, PERSONAL, etc.)
- [ ] TC-3: Hover on donut segment shows label name, count, and percentage
- [ ] TC-4: "Completion Velocity" line chart shows tasks completed (moved to DONE) per day
- [ ] TC-5: Both charts respond to 7d/14d/30d range toggle
- [ ] TC-6: Switching range updates both charts
- [ ] TC-7: Edge case — no tasks in period → empty state message for both charts
- [ ] TC-8: Edge case — all tasks same label → donut shows single color at 100%
- [ ] TC-9: Edge case — zero completions per day in range → line chart shows flat zero line
- [ ] TC-10: Skeleton loading for both charts
- [ ] TC-11: Mobile responsive — charts stack vertically on small screens

---

## WI-070: Settings — Agent Model Overrides UI — `/settings`

- [ ] TC-1: "Agent Models" section visible on settings page
- [ ] TC-2: All 13 agents listed with their current model
- [ ] TC-3: Each agent has a dropdown with model options (claude-sonnet-4-20250514, claude-opus-4-0, gpt-4o, etc.)
- [ ] TC-4: Changing a model highlights the row (visual diff indicator)
- [ ] TC-5: Save button persists changes (API call or config file write)
- [ ] TC-6: Save success → toast confirmation, visual diff cleared
- [ ] TC-7: Save failure → error toast, changes preserved in UI for retry
- [ ] TC-8: "Reset to defaults" button restores original model assignments
- [ ] TC-9: Reset requires confirmation before executing
- [ ] TC-10: Changes take effect on next agent session (noted in UI)
- [ ] TC-11: Edge case — change model and navigate away without saving → warn or lose changes (document behavior)
- [ ] TC-12: API endpoint JWT-protected
- [ ] TC-13: Edge case — API returns model not in dropdown list → displays raw value, no crash

---

## WI-071: Settings — Gmail Monitoring Toggle & Notification Preferences — `/settings`

- [ ] TC-1: "Notifications" section visible on settings page
- [ ] TC-2: Gmail monitoring toggle: on/off switch functional
- [ ] TC-3: Gmail toggle shows last-checked timestamp
- [ ] TC-4: Phishing alerts toggle: on/off switch functional
- [ ] TC-5: Daily briefing toggle: on/off switch functional
- [ ] TC-6: Error threshold dropdown with options: All errors, Critical only, None
- [ ] TC-7: Changing any toggle → immediately persisted (API call on change)
- [ ] TC-8: Settings confirmed with toast notification on save
- [ ] TC-9: Reload page → all toggle states preserved correctly
- [ ] TC-10: Edge case — rapid toggle on/off/on → final state persisted correctly
- [ ] TC-11: Edge case — API error on save → error toast, toggle reverts to previous state
- [ ] TC-12: Settings stored in database or config file (verify persistence mechanism)
- [ ] TC-13: API endpoint JWT-protected

---

## Cross-Cutting Tests (All Pages)

- [ ] CC-1: All new panels have skeleton loading states that appear within 200ms
- [ ] CC-2: All new API endpoints return 401 without valid JWT cookie
- [ ] CC-3: All pages mobile-responsive — no horizontal scroll at 375px width
- [ ] CC-4: Dark theme consistency: bg #1d2125, card #22272b, border #2c333a on all new panels
- [ ] CC-5: No new external dependencies added beyond existing package.json
- [ ] CC-6: TypeScript strict mode — `npm run build` passes with zero errors
- [ ] CC-7: Existing functionality on all 11 pages — no regressions
- [ ] CC-8: Panels load independently (one slow panel doesn't block others)
- [ ] CC-9: SSE connections (WI-059, WI-064) properly close on page navigation
- [ ] CC-10: All timestamps display in SGT (Asia/Singapore, GMT+8)
- [ ] CC-11: Error states — API returns 500 → user sees error message, not blank panel
- [ ] CC-12: localStorage items use namespaced keys (no collision with existing data)

---

**Total Test Cases: 301**

- WI-050: 14 TCs
- WI-051: 15 TCs
- WI-052: 12 TCs
- WI-053: 14 TCs
- WI-054: 13 TCs
- WI-055: 12 TCs
- WI-056: 14 TCs
- WI-057: 12 TCs
- WI-058: 11 TCs
- WI-059: 14 TCs
- WI-060: 14 TCs
- WI-061: 13 TCs
- WI-062: 16 TCs
- WI-063: 14 TCs
- WI-064: 11 TCs
- WI-065: 15 TCs
- WI-066: 14 TCs
- WI-067: 11 TCs
- WI-068: 13 TCs
- WI-069: 11 TCs
- WI-070: 13 TCs
- WI-071: 13 TCs
- Cross-Cutting: 12 TCs
