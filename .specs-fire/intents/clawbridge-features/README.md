# ClawBridge-Inspired Features

**Project:** max-dashboard  
**Sprint:** ClawBridge Feature Parity  
**Created:** 2026-03-09  
**Author:** Bea 📋 (Business Analyst)

---

## Overview

Four features inspired by [ClawBridge](https://clawbridge.app) to enhance the Max Dashboard with real-time agent observability, control, cost tracking, and system health monitoring.

| WI | Feature | Priority | Effort | Status |
|----|---------|----------|--------|--------|
| [WI-100](./WI-100.md) | Live Thoughts Feed | High | 3–4h | Backlog |
| [WI-101](./WI-101.md) | Emergency Stop | Critical | 2h | Backlog |
| [WI-102](./WI-102.md) | Token Economy Panel | Medium | 3–4h | Backlog |
| [WI-103](./WI-103.md) | System Metrics Bar | Medium | 1.5–2h | Backlog |

**Total estimated effort:** 9.5–12 hours

---

## Recommended Build Order

### Phase 1 — Safety First
1. **WI-101: Emergency Stop** (2h) — Critical safety feature. No dependencies. Modifies existing flow page only.

### Phase 2 — Observability
2. **WI-103: System Metrics Bar** (1.5–2h) — Simplest new component. Self-contained API + component. Quick win.
3. **WI-100: Live Thoughts Feed** (3–4h) — Core observability feature. SSE streaming requires careful file-tailing implementation.

### Phase 3 — Economics
4. **WI-102: Token Economy Panel** (3–4h) — JSONL aggregation is the heaviest backend work. Benefits from patterns established in WI-100.

**Rationale:** Emergency stop is a safety control — ship first. System metrics is the simplest isolated feature. Thoughts feed and token panel both parse JSONL, so doing them in sequence allows code reuse (shared JSONL reader utility).

---

## Shared Patterns

### JSONL Reader Utility
Both WI-100 and WI-102 read JSONL session files. Consider creating a shared utility:
```
lib/jsonl.ts — readSessionLines(agentId, options) / tailSession(agentId, callback)
```

### File Paths
All features reference:
- Agent sessions: `/root/.openclaw/agents/<agentId>/sessions/*.jsonl`
- System metrics: `/proc/stat`, `/proc/meminfo`
- Dashboard integration: `app/(dashboard)/page.tsx`

### Dark Theme Colors
All new components must use the existing theme:
- Background: `#0d1117`
- Panel: `#161b22`
- Border: `#21262d`
- Text: `#e6edf3`
- Muted: `#8b949e`

---

## New Files Summary

| File | WI | Type |
|------|----|------|
| `app/api/thoughts/stream/route.ts` | WI-100 | SSE endpoint |
| `app/(dashboard)/thoughts/page.tsx` | WI-100 | Page |
| `components/thoughts/ThoughtsFeed.tsx` | WI-100 | Component |
| `app/api/agents/[agentId]/stop/route.ts` | WI-101 | API endpoint |
| `app/api/tokens/route.ts` | WI-102 | API endpoint |
| `components/dashboard/TokenEconomyPanel.tsx` | WI-102 | Component |
| `app/api/system/metrics/route.ts` | WI-103 | API endpoint |
| `components/dashboard/SystemMetricsBar.tsx` | WI-103 | Component |

## Modified Files Summary

| File | WIs | Changes |
|------|-----|---------|
| `components/ui/Sidebar.tsx` | WI-100 | Add `/thoughts` nav item |
| `components/flow/AgentDetailPanel.tsx` | WI-101 | Add stop button |
| `components/flow/types.ts` | WI-101 | Add sessionKey/pid fields |
| `app/(dashboard)/page.tsx` | WI-102, WI-103 | Add TokenEconomyPanel + SystemMetricsBar |
