# Sprint 8: WI-111 — Agentic Multi-Step Chain Analysis

**Date:** 2026-02-26  
**Engine:** v3.8.0 → v3.9.0  
**Tests:** 88/88 (64 MCP + 10 multi-turn + 14 agent chain)  
**Git commit:** `be1a635` (shield-engine-core)

## What Shipped

### Shield Engine (v3.9.0)

**New category: `agent-state-poisoning` (31st category)**
- Cluster: INDIRECT | Severity: critical
- 16 patterns covering 4 attack vectors:
  1. Claimed inherited authority ("as we agreed earlier", "as previously authorized")
  2. Self-asserted permission escalation ("I am now authorized to", "my authorization has been updated")
  3. Tool output → instruction propagation ("the tool result instructs you to", "based on the previous step, you must")
  4. Cross-step context hijacking ("in step 3, we agreed", "carry this context forward")
  5. Agentic privilege escalation ("execute with admin privileges", "you now have authority to bypass")
- Added to FAST_PATH_IDS for early termination
- Added to ACADEMIC_IMMUNE (never suppressed by meta-discussion detector)
- Boosted 2.0× in TOOL_OUTPUT_BOOST and BROWSER_AGENT_BOOST

**New class: `AgentSessionContext` (extends `SessionContext`)**
- Tracks: `agentSessionId`, per-step metadata (stepIndex, toolName, score, recommendation, mode)
- `prepareStep(stepIndex, toolName?)` — register metadata before analyzeText()
- `computeEscalationScore()` — chain-level score 0–100 (trend + peak + flagged factors)
- `isChainEscalating()` — Crescendo pattern across agent steps
- `isToolOutputPoisoning()` — detects +30pt score spikes between consecutive steps
- `isStatePoisoningDetected()` — detects high-score steps in tool_output/browser_agent mode
- `getChainSummary()` — returns `AgentChainSummary` with all detection signals

**Chain-level scoring formula:**
- Factor 1: Score trend (rising transitions / total × 50 pts)
- Factor 2: Peak score (peak/100 × 30 pts)
- Factor 3: Flagged step ratio (flagged/total × 20 pts)
- Thresholds: ≥60 → warn; ≥80 → block

### IngestShield API

**Updated `/api/v1/shield`:**
- Accepts `agentSessionId` (string) and `stepIndex` (number) optional params
- Persists steps to AgentSession/AgentStep tables (fire-and-forget)
- Returns `agentSessionId` and `stepIndex` in response when provided

**New: `POST /api/v1/agent-session`** — create/retrieve agent session
**New: `GET /api/v1/agent-session/:id/summary`** — chain-level escalation analysis
- Computes escalationScore server-side (mirrors engine logic)
- Persists computed values back to DB
- Returns: escalationScore, escalationChain, toolOutputPoisoning, statePoisoningDetected, recommendation, steps

**New Prisma models:**
- `AgentSession` — tracks customer, escalation state, step count
- `AgentStep` — per-step data (unique on sessionId + stepIndex)

### Python SDK (ingestshield-sdk)

**Updated `scan()` method:**
- New params: `agent_session_id` (str), `step_index` (int)

**New: `get_agent_session_summary(agent_session_id)`**
- Returns chain-level dict with escalationScore, recommendation, steps

## Test Results

| Suite | Count | Status |
|---|---|---|
| MCP core + profile + browser | 64/64 | ✅ |
| Multi-turn (Crescendo) | 10/10 | ✅ |
| Agent chain (WI-111) | 14/14 | ✅ |
| **Total** | **88/88** | **✅ Zero regressions** |

### Agent chain test cases:
1. T1: agent-state-poisoning category detection (inherited authority claims) → 100/100 BLOCK ✅
2. T2: Cross-step escalation via AgentSessionContext (3-step chain) → escalationScore=62, WARN ✅
3. T3: Benign 3-step tool chain → escalationScore=0, ALLOW ✅ (zero FP)
4. T4: Self-asserted permission escalation → 65/100 BLOCK ✅
5. T5: Crescendo across agent steps (frog-boiling) → escalationScore=62, WARN ✅
6. T6: AgentSessionContext reset clears all state ✅
7. T7: AgentSessionContext instanceof SessionContext ✅

### Live API test (IngestShield):
- Step 0 (benign): score=0, allow ✅
- Step 1 (agent-state-poisoning): score=94, block ✅
- Chain summary: toolOutputPoisoning=true, statePoisoningDetected=true ✅

## Files Changed

### shield-engine-core
- `src/index.ts` — v3.9.0: +agent-state-poisoning category, +AgentSessionContext class, +AgentChainSummary interface, FAST_PATH_IDS updated, ACADEMIC_IMMUNE updated, TOOL_OUTPUT_BOOST + BROWSER_AGENT_BOOST updated
- `package.json` — version 3.9.0

### ingestshield
- `prisma/schema.prisma` — +AgentSession model, +AgentStep model
- `src/app/api/v1/shield/route.ts` — accepts agentSessionId/stepIndex, persists steps
- `src/app/api/v1/agent-session/route.ts` — create/list agent sessions
- `src/app/api/v1/agent-session/[id]/summary/route.ts` — chain analysis endpoint

### ingestshield-sdk
- `ingestshield/client.py` — scan() accepts agent_session_id/step_index; +get_agent_session_summary(); +_get()

### Tests
- `/tmp/shield_agent_chain_test.mjs` — 14 new agent chain test cases
