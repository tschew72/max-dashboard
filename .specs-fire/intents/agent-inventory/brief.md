# Intent: Agent Inventory & Activity Dashboard

## Objective
Add a comprehensive Agents page to max-dashboard that shows all 13 OpenClaw agents with their configuration (name, emoji, model, workspace) and current activity status (active sessions, last activity timestamp, session count, token usage). Replaces the existing agents page which currently only shows Main agent's cron jobs and sessions.

## Context
- **13 agents** configured in `/root/.openclaw/openclaw.json` → `agents.list[]`
- Each agent has: `id`, `identity.name`, `identity.emoji`, optional `model.primary`
- Per-agent session data lives in `/root/.openclaw/agents/{agentId}/sessions/sessions.json`
  - Each session key maps to: `sessionId`, `updatedAt`, `channel`, `chatType`, `displayName`
- Per-agent session JSONL logs in `/root/.openclaw/agents/{agentId}/sessions/{sessionId}.jsonl`
- Cron jobs in `/root/.openclaw/cron/jobs.json` — each job has `agentId` field
- Cron run history in `/root/.openclaw/cron/runs/`

## What "Inventory" Means
| Field | Source |
|-------|--------|
| Agent ID | `openclaw.json → agents.list[].id` |
| Name | `agents.list[].identity.name` |
| Emoji | `agents.list[].identity.emoji` |
| Model | `agents.list[].model.primary` (if set) |
| Workspace | `/root/.openclaw/workspace/workspace-agents/{id}/` existence check |
| Can be subagent of | `agents.list[].subagents.allowAgents` (for Main) |

## What "Current Activities" Means
| Signal | Source |
|--------|--------|
| Active sessions count | Count entries in `sessions.json` per agent |
| Last activity timestamp | Max `updatedAt` across all sessions for that agent |
| Last session channel | Most recent session's `channel` + `displayName` |
| Scheduled jobs | Count of enabled cron jobs where `agentId` matches |
| Total session files | Count of `.jsonl` files in sessions dir |

## Data Sources
1. **openclaw.json** — agent registry (static, read on load)
2. **Per-agent sessions.json** — live session state (read per agent)
3. **cron/jobs.json** — scheduled job assignments (read once)

## Refresh Strategy
- Periodic polling every 30 seconds (client-side)
- Manual refresh button (existing pattern on page)
- No WebSocket/SSE needed — file reads are fast

## Where It Lives
- Existing route: `/agents` → `app/(dashboard)/agents/page.tsx`
- Enhance existing page: add agent inventory grid/table ABOVE the existing cron job + session views
- Existing page becomes a detail view when clicking into a specific agent

## Success Criteria
1. Dashboard shows all 13 agents in a card/grid view with emoji, name, model, status
2. Each agent card shows: active session count, last activity time, scheduled job count
3. Clicking an agent filters the existing job/session views to that agent
4. Page auto-refreshes every 30s
5. Works with zero agents having any activity (empty state)

## Constraints
- Read-only — no agent management from the dashboard
- Must not slow page load (lazy-load per-agent session data)
- Reuse existing UI patterns (cards, status badges from current agents page)
- API must handle agents with no sessions dir gracefully
