# WI-034: Recent Activity Feed Widget on Main Dashboard
**Priority:** MEDIUM
**Effort:** S
**Page:** app/(dashboard)/page.tsx

## Problem
The main dashboard shows tasks and system health but lacks visibility into what agents have been doing recently. Users must navigate to `/agents` or `/activity` to see recent agent runs, job completions, or task changes. For an AI orchestration dashboard, the home screen should surface recent agent activity at a glance.

## Solution
1. Add a "Recent Activity" section to the main dashboard below existing widgets
2. Fetch last 5 agent runs from `/api/agents?hours=6` (reuse existing endpoint)
3. Show each run as a compact row: status icon (✓/✗), job name, time ago, duration, token count
4. Link "View all →" to `/agents` page
5. If no runs in last 6h, show "No recent activity" placeholder
6. Style consistent with existing dashboard cards (dark card, rounded-xl, same borders)

## Acceptance Criteria
- [ ] Dashboard shows last 5 agent runs with status, name, time, and token count
- [ ] Failed runs are visually distinct (red accent)
- [ ] "View all" link navigates to /agents page
- [ ] Widget loads without blocking other dashboard content (parallel fetch)
- [ ] Graceful empty state when no recent runs exist
- [ ] `npm run build` passes with no TypeScript errors
