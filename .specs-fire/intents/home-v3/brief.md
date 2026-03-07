# Intent: Home Page v3 — Command Centre

## Objective
Transform the max-dashboard home page from a flat panel list into a prioritised command centre with live KPIs, one-click actions, and stronger visual hierarchy. Apply Wren's copy improvements throughout.

## Success Criteria
- Page feels like a real-time ops dashboard, not a static report
- Every KPI links to its detail page — zero dead-end numbers
- Quick actions let Vince act without navigating away
- Layout guides the eye: alerts → KPIs → actions → detail panels
- Copy is consistent with Wren's tone (direct, competent, dry wit)

## Constraints
- Next.js App Router, React Server Components where possible, `'use client'` only for interactive parts
- Must work within existing SSE infrastructure (`useDashboardSSE`)
- No new backend APIs except `/api/agents/spawn` (already planned)
- Ship incrementally — each WI is independently deployable

---

## Work Items

---

### WI-080: Live KPI Strip
**Description**
Full-width row of 4-5 metric cards at the top of the dashboard (below alerts/exam banner). Each card shows a single number + label, updates via existing SSE stream or 30-second polling fallback.

| Card | Value | Link |
|------|-------|------|
| Tasks in Progress | count of `IN_PROGRESS` tasks | `/tasks` |
| Agent Runs Today | count + success rate % | `/agents` |
| Shield Scans Today | count + block rate % | `/security` |
| Unread Emails | count | `/comms` |
| Cron Errors | count (red text if > 0) | `/jobs` |

**Acceptance Criteria**
- [ ] 5 metric cards render in a responsive horizontal row (stack 2×3 on mobile)
- [ ] Values update without page reload (SSE preferred, 30s poll fallback)
- [ ] Each card is a clickable `<Link>` to its detail page
- [ ] Cron Errors card text turns `#ef4444` (red) when value > 0
- [ ] Skeleton loading state shown while data is in flight

**Files to Modify**
- `/root/projects/max-dashboard/components/dashboard/KpiStrip.tsx` *(new)*
- `/root/projects/max-dashboard/app/(dashboard)/page.tsx`
- `/root/projects/max-dashboard/hooks/useDashboardSSE.ts` *(extend payload if needed)*

**Complexity:** M

---

### WI-081: Quick Actions Row
**Description**
Full-width row of 4 action buttons below the KPI strip. Each button triggers an inline interaction — no full-page navigations.

| Button | Label | Behaviour |
|--------|-------|-----------|
| ➕ | New Task | Navigate to `/tasks?create=1` (task board handles modal) |
| 🤖 | Spawn Agent | Open inline modal: select agent, enter task text, submit → `POST /api/agents/spawn` |
| 🛡️ | Run Scan | Open inline text input, submit → `POST /api/promptdome/scan`, show verdict inline |
| 📅 | View Today | Navigate to `/calendar` |

**Acceptance Criteria**
- [ ] 4 action buttons render in a responsive row (2×2 on mobile)
- [ ] "Spawn Agent" modal lists available agents from `/api/agents` and submits to `/api/agents/spawn`; shows toast "Agent started. Watch Activity for updates." on success
- [ ] "Run Scan" shows an inline text area + submit; displays PromptDome verdict (safe/blocked + reason) without page reload
- [ ] All buttons show a spinning icon during in-flight state
- [ ] Error state shows toast: "Action failed. No changes were made."

**Files to Modify**
- `/root/projects/max-dashboard/components/dashboard/QuickActions.tsx` *(new)*
- `/root/projects/max-dashboard/components/dashboard/SpawnAgentModal.tsx` *(new)*
- `/root/projects/max-dashboard/components/dashboard/InlineScanWidget.tsx` *(new)*
- `/root/projects/max-dashboard/app/(dashboard)/page.tsx`

**Complexity:** M

---

### WI-082: Improved Layout & Visual Hierarchy
**Description**
Restructure the home page grid from a flat panel list to a prioritised layout with clear visual weight.

**Target layout (top → bottom):**
1. `SecurityAlertsWidget` — full-width, conditional (only when alerts > 0) *(existing)*
2. `ExamAlertBanner` — full-width, conditional *(existing)*
3. `KpiStrip` — full-width *(WI-080)*
4. `QuickActions` — full-width *(WI-081)*
5. Tasks panel (60%) + Agent Activity panel (40%) — side by side
6. PromptDome panel (50%) + Gmail panel (50%) — side by side
7. Infrastructure panel — full-width, **collapsed by default** (`<details>` or state toggle)
8. **Remove** the "Next Job" `StatChip` / upcoming-job widget at the bottom

**Acceptance Criteria**
- [ ] Layout matches the 7-row structure above on desktop (≥1024px)
- [ ] Panels stack single-column on mobile (<768px)
- [ ] Infrastructure panel renders collapsed by default with a "Show Infrastructure" toggle
- [ ] "Next Job" widget / `StatChip` row at the bottom is removed
- [ ] No visual regression on existing panel components (they receive the same props)

**Files to Modify**
- `/root/projects/max-dashboard/app/(dashboard)/page.tsx` *(layout restructure)*

**Complexity:** M

---

### WI-083: Live SGT Clock in Header
**Description**
The header greeting already shows time via `sgtTime()`. Make it tick live (every second) and add a pulsing green dot next to the "Gateway: online" indicator.

**Acceptance Criteria**
- [ ] Clock string updates every second without page reload (via `setInterval` + state)
- [ ] Pulsing green dot (`animate-pulse`, `#36b37e`) renders next to "Gateway: online" text
- [ ] Dot changes to red (`#ef4444`) with no pulse when gateway status ≠ online
- [ ] `setInterval` is cleaned up on unmount (no memory leak)

**Files to Modify**
- `/root/projects/max-dashboard/app/(dashboard)/page.tsx` *(header section)*

**Complexity:** S

---

### WI-084: Apply Wren's Copy Improvements
**Description**
Apply copy from `.specs-fire/intents/pages-v2/copy-improvements.md` to the home page:

| Element | Current | New (from Wren) |
|---------|---------|-----------------|
| Page title / meta | "Dashboard" | "Max — Command Centre" |
| Page description | *(none)* | "Live task status, system health, and what needs your attention right now." |
| Health unavailable empty state | generic | Headline: "Health check failed." / Sub: "Cannot reach the health endpoint. Check gateway status." |
| Upcoming 48h empty state | emoji-heavy | Headline: "Nothing on the clock." / Sub: "No tasks due in the next 48 hours. Rare. Enjoy it." |
| Quick action labels | "Run Learning Cycle" | "Run Learning" |
| Quick action labels | "Refresh Buttons" | "Sync Buttons" |
| Quick action labels | "View Memory" | "Open Memory" |
| Overflow links | "+{N} more" | "View {N} more →" |
| Error: tasks API | generic | "Could not load tasks. Check your connection or gateway status." |
| Error: health API | generic | "Health check failed. Gateway may be offline." |

**Acceptance Criteria**
- [ ] Browser tab / page heading reads "Max — Command Centre"
- [ ] All empty-state headlines and subtexts match Wren's copy exactly
- [ ] All button labels match Wren's updated labels
- [ ] Error messages match Wren's copy for tasks API and health API failures
- [ ] No leftover old copy strings for the items listed above

**Files to Modify**
- `/root/projects/max-dashboard/app/(dashboard)/page.tsx`
- `/root/projects/max-dashboard/app/(dashboard)/layout.tsx` *(page title metadata if set there)*

**Complexity:** S

---

## Execution Order
1. WI-083 (S) — clock fix, quick win
2. WI-084 (S) — copy pass, quick win
3. WI-082 (M) — layout restructure (creates slots for new components)
4. WI-080 (M) — KPI strip fills Row 3
5. WI-081 (M) — quick actions fills Row 4

## Out of Scope
- Backend API changes beyond `/api/agents/spawn`
- Calendar page build (WI-081 links to `/calendar` but doesn't build it)
- Mobile-native interactions (responsive CSS only)
- Dark/light theme toggle (dashboard is dark-only)
