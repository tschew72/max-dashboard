# Copy Improvements — Max Dashboard
# Tone: Direct, competent, dry wit | Version: v2

---

## 1. Empty States

### Home — System Health (unavailable)
- Icon: `ServerOff`
- Headline: Health check failed.
- Subtext: Cannot reach the health endpoint. Check gateway status.

### Home — Upcoming 48h (empty)
- Icon: `CheckCircle2`
- Headline: Nothing on the clock.
- Subtext: No tasks due in the next 48 hours. Rare. Enjoy it.
*(current copy is close — refine emoji out, keep the sentiment)*

### Comms — Mentions (empty)
- Icon: `BellOff`
- Headline: All clear.
- Subtext: No mentions waiting. Max is either on top of things or nobody needs him.

### Brain — Memory (no files)
- Icon: `Brain`
- Headline: No memory files yet.
- Subtext: Run a learning cycle to generate the first entry.

### Brain — Knowledge (empty directory)
- Icon: `Folder`
- Headline: This folder is empty.
- Subtext: Add files to your knowledge base to see them here.

### Brain — Search (no results)
- Icon: `Search`
- Headline: No matches.
- Subtext: Try a shorter search term.

### Activity — All events (empty)
- Icon: `Radio`
- Headline: Waiting for a signal.
- Subtext: Cron runs, errors, and learning events appear here in real time.

### Activity — Errors filter (none)
- Icon: `CheckCircle2`
- Headline: Zero errors.
- Subtext: Clean run. Either everything worked or nothing has run yet.

### Tasks — Board (no tasks)
- Icon: `LayoutDashboard`
- Headline: Board is empty.
- Subtext: Add your first task to get moving.

### Jobs — List (no jobs)
- Icon: `Zap`
- Headline: No jobs scheduled.
- Subtext: Create a cron job to automate recurring work.

---

## 2. Loading States

| Panel | Current | Improved |
|-------|---------|----------|
| Comms mentions | pulse skeleton | "Checking mentions…" |
| Brain memory list | spinner (no text) | "Reading memory…" |
| Brain knowledge list | spinner (no text) | "Opening knowledge base…" |
| Activity feed | skeleton | "Fetching latest activity…" |
| Home stat chips | skeleton | *(keep skeleton — no text needed)* |
| Quick action in-flight | spinning icon | *(spinning icon is sufficient)* |

---

## 3. Page Titles & Descriptions (all 11 pages)

| Page | Title | 1-Line Description |
|------|-------|--------------------|
| Home | Max — Command Centre | Live task status, system health, and what needs your attention right now. |
| Comms | Comms | Pending mentions and quick controls. Everything Max needs actioned. |
| Brain | Brain | Max's memory logs and knowledge base, readable on demand. |
| Activity | Activity | Live stream of cron runs, errors, and learning events. |
| Tasks | Task Board | Create, track, and approve work across all projects. |
| Jobs | Cron Jobs | All scheduled automation — status, next run time, and error count. |
| Gmail | Inbox | Unread emails Max is monitoring, filtered to what matters. |
| Security | Security Alerts | PromptDome scan results and active threat signals. |
| Infra | Infrastructure | Real-time status of servers, containers, and services. |
| Agents | Agent Activity | What AI agents ran, what they did, and what they flagged. |
| Settings | Settings | Auth, integrations, and system configuration. |

---

## 4. Action Button Labels

| Current | Context | Improved |
|---------|---------|----------|
| Confirm | Generic confirm sheet | Yes, {verb} — e.g. "Yes, restart" |
| Done | Resolve a mention | Mark resolved |
| Snooze | Defer mention 30 min | Snooze 30m |
| Approve | Move task to Done | Approve |
| Reject | Push task to Backlog | Push back |
| View board → | Task ring link | Open Board |
| Run Learning\nCycle | Quick action | Run Learning |
| Refresh\nButtons | Quick action | Sync Buttons |
| View Memory | Quick action | Open Memory |
| +{N} more | Overflow link | View {N} more → |

---

## 5. Error Messages

| Scenario | Message |
|----------|---------|
| Tasks API down | Could not load tasks. Check your connection or gateway status. |
| Health API down | Health check failed. Gateway may be offline. |
| Comms API down | Mentions unavailable — will retry on next refresh. |
| Auth expired | Session expired. Log in again to continue. |
| Gateway restart failed | Restart did not complete. No changes were made — try again. |
| Quick action failed | Action failed. No changes were made. |
| Brain file open failed | Could not open this file. It may have moved or been deleted. |
| Empty API response | Got a response, but no data. Something is off on the server. |

---

## 6. Toast / Notification Copy

| Action | Toast |
|--------|-------|
| Task created | Task added. |
| Task approved | Approved — moved to Done. |
| Task rejected | Pushed back to Backlog. |
| Mention resolved | Marked resolved. |
| Mention snoozed | Snoozed for 30 minutes. |
| Learning cycle triggered | Learning cycle started. |
| Buttons synced | Buttons refreshed. |
| Gateway restarting | Restarting gateway — takes a few seconds. |
| Gateway back online | Gateway is back online. |
| Briefing triggered | Briefing running — check Activity for output. |
| Scan complete | PromptDome scan done. {N} alert(s) found. |
| Agent spawned | Agent started. Watch Activity for updates. |
| Email actioned | Done — email handled. |
| Copied to clipboard | Copied. |
