# WI-030: Global Toast Notification System
**Priority:** HIGH
**Effort:** S
**Page:** components/ui/Toast.tsx + layout

## Problem
No user feedback when actions complete or fail across the dashboard. PATCH/POST calls in tasks, jobs, and agents pages succeed or fail silently. Users have no confirmation that swipe actions, bulk operations, heal-all, or task creation actually worked.

## Solution
Build a lightweight toast notification system using React context:
1. Create `components/ui/Toast.tsx` — a `ToastProvider` context + `useToast()` hook
2. Toast types: `success`, `error`, `info` with auto-dismiss (3s for success, 5s for errors)
3. Position: bottom-center, above the BottomNav (offset by 80px from bottom)
4. Wrap the dashboard layout with `<ToastProvider>`
5. Add toast calls to key actions in tasks page: create, edit, delete, archive, bulk operations, ask-max
6. Add toast calls to jobs page: heal, trigger, create, edit
7. Max 3 toasts stacked, newest on top

## Acceptance Criteria
- [ ] `useToast()` hook available from any dashboard page
- [ ] Success toast appears after task creation, edit, delete, archive
- [ ] Error toast appears when any API call returns non-ok status
- [ ] Toasts auto-dismiss after configured timeout
- [ ] Toasts don't overlap with BottomNav on mobile
- [ ] `npm run build` passes with no TypeScript errors
