# WI-033: Unified Page Header Component
**Priority:** MEDIUM
**Effort:** S
**Page:** components/ui/PageHeader.tsx + all pages

## Problem
Every page implements its own header with inconsistent styling. Some have sticky headers, some don't. Some show keyboard shortcuts, others don't. The header height, padding, font size, and border style vary across pages (Tasks uses px-4 py-3, Agents uses padding 16px, Jobs uses a different structure). This creates visual inconsistency.

## Solution
1. Create `components/ui/PageHeader.tsx` with props:
   - `title: string` — page title
   - `emoji?: string` — optional emoji prefix
   - `actions?: ReactNode` — right-side action buttons slot
   - `subtitle?: string` — optional subtitle/description
   - `sticky?: boolean` — defaults to true
2. Consistent styling: sticky top-0, z-40, bg `#1d2125`, border-bottom `#2c333a`, px-4 py-3
3. Replace custom headers in: Tasks, Agents, Jobs, Analytics, Brain, Comms, Shield, System
4. Keep page-specific action buttons by passing them via `actions` prop

## Acceptance Criteria
- [ ] All dashboard pages use `<PageHeader>` component
- [ ] Consistent header height, padding, and styling across all pages
- [ ] Page-specific action buttons still work (refresh, filters, etc.)
- [ ] Headers are sticky on scroll across all pages
- [ ] `npm run build` passes with no TypeScript errors
