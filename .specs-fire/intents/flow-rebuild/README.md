# Flow Rebuild — Agent Flow Visualizer v2

**Intent:** Complete rebuild of the `/flow` page in max-dashboard  
**Created:** 2026-03-09  
**Author:** Bea 📋  
**Status:** SPEC COMPLETE — Ready for implementation

---

## Why We're Rebuilding

The current `/flow` page has four fundamental flaws:

1. **Hardcoded edges** — `buildEdges()` in `route.ts` uses a static `knownEdges` array (17 hardcoded relationships like `main→ba`, `ba→dev`, etc.). These represent "who *could* spawn whom" — not who actually did.

2. **Broken active detection** — An edge is flagged as "active" when both endpoints have a JSONL file modified in the last 90 seconds (`isAgentActive()`). Since `main` is almost always running, any running agent lights up a fake `main→X` edge. This is meaningless.

3. **All 14 agents always visible** — ReactFlow renders all agents in a fixed grid layout (`LAYOUT` constant with pixel coordinates). Most are idle most of the time. Visual noise.

4. **No task context** — "Running" status tells you nothing. You can't see WHAT an agent is doing, WHO dispatched it, or what tool it's currently using.

## What It Should Solve

When Vince opens `/flow`, he needs instant answers to:
- **"What is being worked on right now?"** → Active spawn trees with task previews
- **"Who is doing it and who dispatched them?"** → Real `spawnedBy` edges from sessions.json
- **"What did they last work on?"** → Task preview from JSONL first user message

## The Key Insight: Real Data Already Exists

Each agent's `sessions.json` contains subagent entries with:
- `spawnedBy` → real parent session key (e.g., `"agent:main:discord:channel:..."` → parent is `main`)
- `spawnDepth` → hierarchy level
- `updatedAt` → millisecond timestamp for status detection
- `sessionId` → maps to JSONL file containing the task prompt and tool calls

JSONL files contain:
- Line 0: `{type: "session", ...}` — session metadata
- First `{type: "message", message: {role: "user"}}` — the task prompt sent to the agent
- `{type: "message", message: {content: [{type: "toolCall", name: "..."}]}}` — tool calls (note: field is `toolCall` not `tool_use`, with `name` key)

## Work Items

| WI | Title | Scope |
|----|-------|-------|
| WI-200 | API Rewrite | `lib/flow/parse-sessions.ts` + `/api/flow/agents` + `/api/flow/stream` |
| WI-201 | ActiveChainView | Vertical spawn tree component |
| WI-202 | SystemOverview | Agent grid component |
| WI-203 | Flow Page Rewrite | Two-mode layout + SSE integration |
| WI-204 | Polish | Transitions, mobile responsive, duration timer |

## Acceptance Criteria

1. ✅ Subagent running → vertical spawn tree with real parent→child edges from `spawnedBy`
2. ✅ Task preview on each node (first 120 chars of user prompt)
3. ✅ Last tool call name on running nodes
4. ✅ Nothing running → clean grid of all 14 agents sorted by recency
5. ✅ SSE updates view in real-time
6. ✅ No hardcoded edges — all from actual `spawnedBy` data
7. ✅ No animation on idle state
8. ✅ Subtle pulse animation on active edges only
9. ✅ Duration timer on running nodes (counting up)
10. ✅ Mobile responsive — vertical stack on phone

## Files Changed

**Rewrite:**
- `app/api/flow/agents/route.ts`
- `app/api/flow/stream/route.ts`
- `app/(dashboard)/flow/page.tsx`
- `components/flow/AgentNode.tsx`

**Create:**
- `lib/flow/parse-sessions.ts`
- `components/flow/ActiveChainView.tsx`
- `components/flow/SystemOverview.tsx`
- `components/flow/SpawnEdge.tsx`

**Delete/deprecate:**
- `components/flow/AgentEdge.tsx` (replaced by SpawnEdge)
- `components/flow/AgentDetailPanel.tsx` (info now inline on nodes)
- `components/flow/WorkflowTimeline.tsx` (replaced by ActiveChainView)
- `components/flow/types.ts` (rewritten with new types)
- Consider removing `@xyflow/react` dependency (custom layout is simpler for vertical trees)

## Architecture Decision: Drop ReactFlow

**Decision: Remove `@xyflow/react` and use custom CSS layout.**

Rationale:
- ReactFlow is designed for sprawling, draggable node graphs. We're building a focused vertical tree.
- Custom layout = simpler code, fewer deps, faster renders, easier mobile responsive
- The current ReactFlow setup (fixed positions, no dragging, no connecting) doesn't use any ReactFlow features that justify the dependency
- Vertical tree layout is trivially done with flexbox
- Animated edges are simpler with CSS than ReactFlow's SVG path system
