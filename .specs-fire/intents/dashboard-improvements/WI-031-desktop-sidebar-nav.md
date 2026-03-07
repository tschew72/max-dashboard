# WI-031: Responsive Desktop Sidebar Navigation
**Priority:** HIGH
**Effort:** M
**Page:** components/ui/BottomNav.tsx + layout

## Problem
The BottomNav works well on mobile but on desktop (≥768px) it wastes screen space and hides 6 pages behind a "More" menu. Desktop users must click "More" to reach Jobs, Agents, Analytics, Comms, Brain, and Shield — pages they use frequently.

## Solution
1. Create `components/ui/Sidebar.tsx` — vertical sidebar for desktop viewports (≥768px)
2. Show ALL nav items (Home, Tasks, Calendar, Jobs, Agents, Analytics, Comms, Brain, Shield, System, Settings) in a single vertical list with icons + labels
3. Collapsible to icon-only mode (56px wide) with a toggle button; expanded = 200px wide
4. Save collapsed/expanded preference in localStorage
5. Update `app/(dashboard)/layout.tsx` to conditionally render:
   - `<Sidebar>` on `md:` and above (hidden on mobile)
   - `<BottomNav>` on mobile only (hidden on `md:` and above)
6. Use CSS media queries or Tailwind `md:hidden` / `hidden md:flex` — no JS resize listeners
7. Active page highlighted with accent color + left border indicator

## Acceptance Criteria
- [ ] Desktop (≥768px): sidebar visible, BottomNav hidden
- [ ] Mobile (<768px): BottomNav visible, sidebar hidden
- [ ] All 11 pages accessible from sidebar without "More" menu
- [ ] Collapsed/expanded state persists across page loads
- [ ] Active page visually highlighted in sidebar
- [ ] Content area uses remaining width (flex layout)
- [ ] `npm run build` passes with no TypeScript errors
