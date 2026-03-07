# WI-032: Real-Time SSE Updates on Main Dashboard
**Priority:** MEDIUM
**Effort:** S
**Page:** app/(dashboard)/page.tsx + API

## Problem
The main dashboard (`/`) fetches data once on mount and has no real-time updates. Meanwhile the tasks page already has SSE (`/api/tasks/stream`). When a cron job completes, a task changes status, or system health degrades, the dashboard shows stale data until manual refresh.

## Solution
1. Create `/api/dashboard/stream` SSE endpoint that emits events when:
   - A task status changes (reuse existing task event emitter)
   - A job run completes (subscribe to job run events)
   - System health changes (memory/disk thresholds crossed)
2. In the dashboard page, connect to SSE and debounce-refetch dashboard data on any event (same pattern as tasks page)
3. Add a subtle "live" indicator dot next to the page title showing SSE is connected
4. Auto-reconnect on SSE error with 5s backoff (same pattern as tasks page)

## Acceptance Criteria
- [ ] Dashboard auto-refreshes within 2s when a task status changes
- [ ] Dashboard auto-refreshes within 2s when a job run completes
- [ ] Green "live" dot visible next to dashboard title when SSE connected
- [ ] SSE reconnects automatically after disconnect
- [ ] No performance regression — events are debounced (300ms)
- [ ] `npm run build` passes with no TypeScript errors
