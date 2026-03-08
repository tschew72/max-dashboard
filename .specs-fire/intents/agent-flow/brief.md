# Intent: Agent Orchestration Flow Visualizer

## Objective
Add a live Agent Flow Canvas page (`/flow`) to max-dashboard that visualises all 13 OpenClaw agents as interactive nodes on a directed graph — showing real-time status, spawner→spawned relationships, animated work flowing between agents, and workflow chain timelines. Think n8n meets mission control for Vince's AI team.

## Success Criteria
- All 13 agents rendered as styled nodes on a React Flow canvas with hierarchical layout
- Real-time status updates via SSE — no manual refresh needed
- Clicking a node opens a detail panel with run history, relationships, and spawn action
- Workflow chains are visible in a bottom timeline and can highlight the canvas
- Dark theme, consistent with existing dashboard design system

## Constraints
- **Framework:** React Flow (`@xyflow/react`) + dagre for auto-layout
- **No new external deps** beyond `@xyflow/react`, `@dagrejs/dagre` (or `dagre`)
- **Next.js App Router** — page at `app/(dashboard)/flow/page.tsx`
- **Dark theme** — matches existing dashboard color system (`globals.css` variables)
- **Responsive** — canvas min 600px height on desktop, scrollable on smaller screens
- **TypeScript strict** — no `any` types, no TS errors
- **SSE** — extend existing `/api/dashboard/stream` endpoint

## Data Sources
| Data | Source | Notes |
|------|--------|-------|
| Agent registry | `/root/.openclaw/openclaw.json` → `agents.list[]` | ID, name, emoji, model |
| Agent metadata | `/root/.openclaw/workspace/workspace-agents/AGENT-REGISTRY.md` | Role descriptions |
| Run history | `/api/agents` endpoint (existing) | Per-agent runs with timestamps, duration, status, cost |
| Active sessions | `/root/.openclaw/agents/{agentId}/sessions/sessions.json` | Live session state |
| Session logs | `/root/.openclaw/agents/{agentId}/sessions/{sessionId}.jsonl` | Spawner→spawned relationships, token counts |
| SSE stream | `/api/dashboard/stream` | Extend to emit `agent-status` events |

---

## Work Items

---

### WI-090: Agent Flow Canvas Page

**Description:**
Create a new page at `/flow` with a React Flow canvas rendering all 13 agents as custom nodes in a hierarchical layout. Add "Flow" to the sidebar navigation with a `GitBranch` (or `Workflow`) icon from Lucide.

**Implementation Details:**

1. **Page file:** `/root/projects/max-dashboard/app/(dashboard)/flow/page.tsx`
2. **Components directory:** `/root/projects/max-dashboard/components/flow/`
   - `AgentFlowCanvas.tsx` — main React Flow wrapper
   - `AgentNode.tsx` — custom node component
   - `AgentEdge.tsx` — custom animated edge component
   - `FlowProvider.tsx` — data fetching + SSE subscription context
3. **Sidebar update:** `/root/projects/max-dashboard/components/Sidebar.tsx` (or equivalent layout nav) — add Flow entry
4. **API route:** `/root/projects/max-dashboard/app/api/agents/flow/route.ts` — returns agent nodes + edges with run frequency data

**Node layout (hierarchical, top-to-bottom):**
```
Row 1 (Orchestration):  Max
Row 2 (Strategy):       Bea       Alex      Sam
Row 3 (Execution):      Dev       Umi       Dex       Cleo
Row 4 (QA/Ops):         Quinn     Wren      Kai       Ops       Maya
```
- Use dagre with `rankdir: 'TB'`, `nodesep: 80`, `ranksep: 100`
- Each node: 160×80px, rounded corners, dark card style

**Each node displays:**
- Agent emoji (large, left side)
- Agent name (bold)
- Current status badge: `idle` | `running` | `done` | `error`
- Last run time (relative, e.g. "3m ago")

**Edges:**
- Directed edges from spawner → spawned agent (derived from session JSONL `parentAgent` or `spawnedBy` fields in run history)
- Edge thickness = log(frequency) — more spawns = thicker line (min 1px, max 5px)
- Animated dots/particles flowing along edges when the target agent is currently `running`
- Edge color: muted gray when idle, accent blue when active

**Acceptance Criteria:**
- [ ] `/flow` page loads with all 13 agent nodes rendered on React Flow canvas
- [ ] Sidebar shows "Flow" link with GitBranch/Workflow icon, active state works
- [ ] Nodes display emoji, name, status badge, last run time
- [ ] Edges render between agents with historical spawner→spawned relationships
- [ ] Edge thickness varies by spawn frequency
- [ ] Animated particles flow along edges when target agent status is `running`
- [ ] Canvas supports pan, zoom, minimap
- [ ] Dark theme matches dashboard color system
- [ ] Responsive: min 600px canvas height, no horizontal overflow on 1024px+ screens
- [ ] "Fit View" button to reset zoom/pan to show all nodes

**Complexity:** High (2–3 sessions)
**Execution Mode:** Confirm (1 checkpoint: plan review)
**Dependencies:** None (new page)

---

### WI-091: Real-time Status Animations

**Description:**
Implement per-node status animations driven by SSE events so the canvas reflects agent activity in real time without polling.

**Implementation Details:**

1. **SSE extension:** `/root/projects/max-dashboard/app/api/dashboard/stream/route.ts` — add `agent-status` event type
   ```
   event: agent-status
   data: {"agentId":"dev","status":"running","sessionId":"...","timestamp":"..."}
   ```
2. **Status source:** Server watches `/root/.openclaw/agents/{agentId}/sessions/sessions.json` for changes (fs.watch or polling fallback every 5s)
3. **Animation states in `AgentNode.tsx`:**

| Status | Visual |
|--------|--------|
| `idle` | Subtle pulse glow (dim, 3s cycle, opacity 0.3→0.6) |
| `running` | Bright glow (accent color) + spinning ring border (CSS animation) + edge particles active |
| `done` (last 5 min) | Green ✓ overlay badge, fades out over 5 minutes (opacity transition) |
| `error` | Red border + shake animation (CSS keyframe, 0.5s) + ⚠️ badge |

4. **Transition animations:** Status changes animate smoothly (300ms ease) — no jarring flips

**Acceptance Criteria:**
- [ ] SSE endpoint emits `agent-status` events when agent sessions start/complete
- [ ] Idle nodes show subtle pulse glow animation
- [ ] Running nodes glow brightly with spinning ring border
- [ ] Running nodes trigger particle animation on connected edges
- [ ] Done nodes (within 5 min) show green check overlay that fades
- [ ] Error nodes show red shake animation with warning badge
- [ ] Status transitions are smooth (no flicker/jump)
- [ ] SSE reconnects automatically on disconnect (with exponential backoff)
- [ ] Canvas updates within 2 seconds of actual agent status change

**Complexity:** Medium (1–2 sessions)
**Execution Mode:** Autopilot
**Dependencies:** WI-090 (canvas must exist)

---

### WI-092: Node Detail Panel

**Description:**
Clicking an agent node opens a slide-in side panel (right side, 400px wide) showing detailed agent information, run history, relationships, and a spawn action.

**Implementation Details:**

1. **Component:** `/root/projects/max-dashboard/components/flow/AgentDetailPanel.tsx`
2. **Panel content:**
   - **Header:** Emoji + Name + Role description + Model badge (e.g. `claude-sonnet-4-20250514`)
   - **Status:** Current status with uptime/last active
   - **Last 5 Runs table:**
     | Timestamp | Duration | Status | Cost |
     |-----------|----------|--------|------|
     | 2 min ago | 45s | ✅ done | $0.12 |
   - **Relationships section:**
     - "Spawned by" — list of agents that have spawned this agent (with frequency count)
     - "Spawns" — list of agents this agent has spawned (with frequency count)
   - **7-Day Summary:**
     - Total runs count
     - Total tokens (input + output)
     - Total cost
   - **Action button:** "Spawn Task" — opens existing spawn modal (reuse from agents page if available)
3. **Slide animation:** Panel slides in from right (300ms ease-out), overlay dims canvas slightly
4. **Close:** X button or click outside panel or Escape key
5. **Data fetch:** `GET /api/agents/flow/[agentId]` — returns detail payload

**Acceptance Criteria:**
- [ ] Clicking a node opens a right-side slide-in panel (400px)
- [ ] Panel shows agent name, emoji, role, model
- [ ] Panel shows last 5 runs with timestamp, duration, status, cost
- [ ] Panel shows spawned-by and spawns-to relationships with frequency
- [ ] Panel shows 7-day token + cost totals
- [ ] "Spawn Task" button is present and functional (opens spawn modal or placeholder)
- [ ] Panel closes on X click, outside click, or Escape key
- [ ] Panel slide animation is smooth (300ms)
- [ ] Panel is scrollable if content exceeds viewport height
- [ ] No layout shift on canvas when panel opens (panel overlays, doesn't push)

**Complexity:** Medium (1 session)
**Execution Mode:** Autopilot
**Dependencies:** WI-090 (canvas + nodes must exist)

---

### WI-093: Workflow Timeline (Bottom Panel)

**Description:**
Add a collapsible bottom panel below the canvas showing the last 10 workflow chains as a horizontal timeline. Each chain visualises the agent execution sequence with timing. Clicking a chain highlights the involved nodes and edges on the canvas.

**Implementation Details:**

1. **Component:** `/root/projects/max-dashboard/components/flow/WorkflowTimeline.tsx`
2. **Layout:** Bottom panel, 180px tall (collapsible to 40px header), below the React Flow canvas
3. **Data source:** Derive chains from session JSONL files — a chain is a sequence of agent runs linked by `parentSessionId` or `spawnedBy` fields
4. **API route:** `GET /api/agents/flow/chains` — returns last 10 workflow chains
   ```json
   {
     "chains": [
       {
         "id": "chain-abc123",
         "startedAt": "2026-03-08T10:00:00Z",
         "status": "success",
         "steps": [
           {"agentId": "main", "name": "Max", "emoji": "⚡", "startedAt": "...", "duration": 12, "status": "done"},
           {"agentId": "ba", "name": "Bea", "emoji": "📋", "startedAt": "...", "duration": 45, "status": "done"},
           {"agentId": "dev", "name": "Dev", "emoji": "💻", "startedAt": "...", "duration": 120, "status": "done"}
         ]
       }
     ]
   }
   ```
5. **Visual per chain:**
   - Horizontal sequence of agent emoji circles connected by arrows
   - Duration shown between nodes
   - Total chain time on the right
   - Color-coded border: green = all success, red = any failed, yellow = in-progress
6. **Interaction:**
   - Click a chain → highlight involved nodes (bright border) + edges (accent color + thicker) on canvas
   - Click again or click another chain to deselect
   - Highlighted state persists until explicitly cleared
7. **Collapse toggle:** Chevron button in header bar, remembers state in localStorage

**Acceptance Criteria:**
- [ ] Bottom panel renders below the canvas with last 10 workflow chains
- [ ] Each chain shows agent sequence with emojis, arrows, and timing
- [ ] Chains are color-coded: green (success), red (failed), yellow (in-progress)
- [ ] Clicking a chain highlights the relevant nodes and edges on the canvas
- [ ] Clicking again or selecting another chain clears previous highlight
- [ ] Panel is collapsible (40px header when collapsed, 180px when expanded)
- [ ] Collapse state persists across page navigation (localStorage)
- [ ] Empty state shows "No workflow chains yet" with subtle illustration
- [ ] Panel does not interfere with canvas pan/zoom
- [ ] Chains auto-refresh every 30 seconds (or via SSE if chain completes)

**Complexity:** High (2 sessions)
**Execution Mode:** Confirm (1 checkpoint: plan review)
**Dependencies:** WI-090 (canvas), WI-091 (status data for in-progress detection)

---

## File Manifest

| File | Purpose |
|------|---------|
| `/root/projects/max-dashboard/app/(dashboard)/flow/page.tsx` | Flow page entry point |
| `/root/projects/max-dashboard/components/flow/AgentFlowCanvas.tsx` | React Flow canvas wrapper |
| `/root/projects/max-dashboard/components/flow/AgentNode.tsx` | Custom agent node component |
| `/root/projects/max-dashboard/components/flow/AgentEdge.tsx` | Custom animated edge component |
| `/root/projects/max-dashboard/components/flow/FlowProvider.tsx` | Data context + SSE subscription |
| `/root/projects/max-dashboard/components/flow/AgentDetailPanel.tsx` | Side panel on node click |
| `/root/projects/max-dashboard/components/flow/WorkflowTimeline.tsx` | Bottom timeline panel |
| `/root/projects/max-dashboard/app/api/agents/flow/route.ts` | API: nodes + edges data |
| `/root/projects/max-dashboard/app/api/agents/flow/[agentId]/route.ts` | API: agent detail data |
| `/root/projects/max-dashboard/app/api/agents/flow/chains/route.ts` | API: workflow chains |
| `/root/projects/max-dashboard/app/api/dashboard/stream/route.ts` | SSE: extend with agent-status events |
| `/root/projects/max-dashboard/components/Sidebar.tsx` | Update: add Flow nav item |

## New Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `@xyflow/react` | `^12.x` | React Flow canvas |
| `@dagrejs/dagre` | `^1.x` | Hierarchical auto-layout |

## Out of Scope
- Drag-and-drop node repositioning (read-only canvas for v1)
- Manual workflow creation / editing (this is a visualiser, not a builder)
- Historical replay of past workflows (only last 10 chains shown)
- Agent configuration editing from the flow page (use existing agents page)
- Mobile-optimised layout (desktop-first; mobile gets basic scroll view)
