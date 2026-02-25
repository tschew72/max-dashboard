# Intent: Prompt Shield Engine

**Product:** Max Dashboard — Prompt Shield  
**Component:** `lib/shield-engine.ts`  
**Owner:** Max  
**Flow:** FIRE (brownfield, iterative, daily evolution)  
**Created:** 2026-02-25  
**Current Version:** v3.0.0

---

## Objective

Build and continuously evolve a **real-time prompt injection detection engine** that protects AI agents (OpenClaw, MCP clients, web content pipelines) from adversarial inputs — including direct attacks, encoded evasion, indirect injection, social engineering, and command execution attempts.

The engine must:
- Score any text 0–100 for injection risk
- Classify into named categories with severity and mitigation
- Detect evasion techniques (encoding, obfuscation, multilingual)
- Keep zero false positives on benign content
- Serve three consumers: Dashboard UI (server action), external agents (MCP API), OpenClaw plugin

## Why It Matters

Every piece of web content Max fetches, every search result, every uploaded file — all are potential injection vectors. Without a fast, accurate shield, a poisoned article could redirect Max's behavior mid-task. The engine is the last line of defense before external content is processed.

## Evolution Model

The engine is designed to grow daily:
1. **Daily cron (8 AM SGT)** researches new injection techniques from the web
2. Reports land in `03-EXECUTION/shield-intelligence/YYYY-MM-DD.md`
3. **Heartbeat review**: Max evaluates proposed patterns, applies approved ones
4. New patterns → `tsc --noEmit` → `npm run build` → `pm2 restart` → test suite
5. Version bumped on each meaningful release

## Success Criteria

- Test suite: 100% pass rate maintained across all releases
- False positive rate: 0% on safe content
- p95 latency: <15ms per analysis call
- Daily improvement: at least 1 new pattern or refinement per week
- Coverage: all OWASP LLM Top 10 attack vectors detected

## Non-Goals

- No input storage (stateless by design — privacy)
- No ML model inference (pure regex + heuristics — fast, auditable, no API dependency)
- No output scanning (v1 scope, tracked in open question #1 of SPECS-PROMPT-SHIELD.md)

---

## Tech Stack

- **Runtime:** TypeScript (Next.js 15, Node 22)
- **Engine file:** `lib/shield-engine.ts` (single source of truth)
- **Consumers:**
  - `app/(dashboard)/shield/actions.ts` — server action (dashboard UI)
  - `app/api/mcp/route.ts` — MCP JSON-RPC server (external agents)
  - `~/.openclaw/extensions/prompt-shield/index.ts` — OpenClaw plugin (thin MCP client)
- **Test file:** `/tmp/shield_test.py` (Python, 29 test cases)
- **Intelligence feed:** `/root/.openclaw/workspace/03-EXECUTION/shield-intelligence/`

---

## Architecture Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-02-25 | Single engine, three consumers | No duplicate detection logic; one file to update |
| 2026-02-25 | MCP server = Next.js API route | No extra infra; reuses existing deployment |
| 2026-02-25 | Pure regex (no ML) | Zero latency, zero API dependency, fully auditable |
| 2026-02-25 | hasConfirmedCritical rule | Short precise injections scored too low via raw scoring alone |
| 2026-02-25 | Human-in-the-loop for pattern apply | Auto-patching TypeScript is risky; review adds safety |
