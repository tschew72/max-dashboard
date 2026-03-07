# Work Items — Shield Engine

**Last updated:** 2026-02-26  
**Execution mode:** Autopilot (routine pattern updates) / Confirm (new categories) / Validate (scoring changes)

---

## Backlog

### WI-012: False positive reduction — meta-discussion detector
**Type:** Feature  
**Mode:** Validate  
**Status:** BACKLOG → consider tuning signal weights based on real-world data  
**Description:** ✅ Initial implementation shipped in v3.7.0. Monitor false negative rate — ensure academic framing doesn't protect actual attacks. Potential future work: ML-based classifier trained on labeled (attack vs description) corpus.  
**Tuning levers:** Signal count thresholds (currently 1/3), suppression factors (0.65/0.40), ACADEMIC_IMMUNE category set.

---

### ✅ WI-007: Nginx + api.vincechew.me SSL setup
**Completed:** 2026-02-26  
**Result:** Cert + Nginx config already provisioned. Reload confirmed. `https://api.vincechew.me/api/mcp` publicly callable. CORS open (*). SSL via Let's Encrypt (expires May 26, 2026).

---

### ✅ WI-008: Output scanning (llm_output mode) — Engine v3.6.0
**Completed:** 2026-02-26  
**Engine version:** v3.6.0  
**What shipped:**
- New `InputMode`: `'llm_output'` (5th mode alongside user_prompt/document/tool_output/auto)
- `LLM_OUTPUT_BOOST`: system-extraction 1.6×, pii-exfiltration 1.5×, data-exfil 1.4×; jailbreak-sequence 0.4× (suppressed — irrelevant in output)
- `attackSurface: 'output'` value for llm_output mode
- Output-specific `system-extraction` patterns: detects model echoing its own system prompt in responses
- `inferMode()` now auto-detects `llm_output` from "I am a helpful assistant...", "As an AI...", "Sure, I'd be happy..." patterns
- Bug fix: word boundary `\b` on AI pattern prevents "unconstrained" false match
- 69/69 tests passing

---

### ✅ WI-009: VAPT policy templates — IngestShield
**Completed:** 2026-02-26  
**What shipped:**
- `policy-templates.ts`: 4 pre-configured templates (vapt_research, strict_rag, customer_support, compliance_audit)
- `GET /api/v1/templates`: public endpoint, lists all templates with rule previews
- `POST /api/v1/templates/apply`: API key auth, idempotent (skips existing rules by name), scoped to apiKeyId optional
- `GET/POST /api/portal/templates`: portal session auth, shows applied status per rule
- Portal UI: `/dashboard/templates` page with apply button + rule preview expand
- PortalNav: Templates tab (FileStack icon)
- OpenAPI spec updated

---

### ✅ WI-010: Dashboard Shield page v2 — history + stats
**Completed:** 2026-02-25  
**Result:** Full analytics dashboard built — ShieldLog Postgres table, stats/logs API routes, 3-tab /shield page (Analytics/Flagged Log/Manual Scan), logging wired into MCP + dashboard actions.

---

### ✅ WI-011: Fix `engineVersion: undefined` in MCP response
**Type:** Bug  
**Mode:** Autopilot  
**Status:** DONE (2026-02-25)  
**Description:** Verified — `ENGINE_VERSION` is correctly exported and included in `analyzeText()` return; MCP route passes full result as JSON; plugin reads `result.engineVersion`. Was a transient issue during early draft, not present in v3.0.0.

---

## Daily Pattern Evolution (Recurring)

### WI-DAILY: Review + Apply Intelligence Feed
**Type:** Recurring  
**Mode:** Autopilot  
**Trigger:** Every morning heartbeat after 8 AM SGT (after daily research cron runs)  
**Steps:**
1. Check `03-EXECUTION/shield-intelligence/` for today's report
2. Review proposed patterns for quality + false positive risk
3. For each approved pattern: add to correct category in `shield-engine.ts`
4. Run `npx tsc --noEmit` → `npm run build` → `pm2 restart max-dashboard`
5. Run `/tmp/shield_test.py` (59/59) + `node /tmp/shield_multiturn_test.mjs` (10/10) = 69/69 total
6. Bump ENGINE_VERSION (minor: `3.x.0`, patch: `3.7.x` for pattern additions)
7. Log in `runs/YYYY-MM-DD.md`

---

## Completed

### ✅ WI-001: Engine v1.0 — Initial implementation
**Completed:** 2026-02-24  
**Categories:** 20 | **Pre-processing:** 12 steps | **Consumers:** 2

### ✅ WI-002: MCP server + shared engine extraction
**Completed:** 2026-02-25 ~09:00 SGT  
**Output:** `lib/shield-engine.ts` extracted as shared library; `app/api/mcp/route.ts` created  
**Test:** 10/10 MCP protocol tests passing

### ✅ WI-003: OpenClaw plugin refactor to MCP client
**Completed:** 2026-02-25 ~15:00 SGT  
**Output:** `~/.openclaw/extensions/prompt-shield/index.ts` → thin MCP client (~120 lines)  
**Fix:** `registerTool` API format (single object arg, not two-arg)

### ✅ WI-004: Web content safety rule enforcement
**Completed:** 2026-02-25 ~15:00 SGT  
**Output:** AGENTS.md updated; `prompt_shield` tool confirmed live in session

### ✅ WI-005: Engine v3.0 — 27 categories + new vectors
**Completed:** 2026-02-25 ~16:00 SGT  
**Output:** 6 new categories (payload-splitting, adversarial-suffix, command-execution, cross-plugin-forgery, fictional-framing, recursive-injection, multimodal-injection, nested-injection); entropy-based adversarial detection; semantic clusters; hasConfirmedCritical rule  
**Test:** 29/29 passing

### ✅ WI-006: Daily intelligence cron setup
**Completed:** 2026-02-25 ~16:10 SGT  
**Output:** Cron job `faa3e1c5` — 8 AM SGT daily; research + report + Discord notify  
**Integration:** Heartbeat review loop added

### ✅ WI-110: Browser Agent Hardening Mode — Engine v3.8.0
**Completed:** 2026-02-26  
**Engine version:** v3.8.0  
**What shipped:**
- `InputMode: 'browser_agent'` (6th mode), `attackSurface: 'browser'`
- `html-injection` category (30th) — 15 patterns: HTML attributes, CSS content, comments, meta/noscript, DOM exfil, hidden text
- `BROWSER_AGENT_BOOST`: html-injection 2.0×, indirect-injection 1.8×; jailbreak 0.3×
- `detectHtmlInjection()` heuristic — extracts attribute/CSS values, scans INJECTION_KEYWORDS
- Fast-path: html-injection in FAST_PATH_IDS
- `inferMode()`: >8 tags → browser_agent; minimal HTML → document
- All consumers updated (MCP, plugin, IngestShield OpenAPI)
- 74/74 tests (64 MCP + 10 multi-turn)

---

### ✅ WI-012: Meta-discussion / false positive reduction — Engine v3.7.0
**Completed:** 2026-02-26  
**Engine version:** v3.7.0  
**Problem solved:** Security articles and research papers were being blocked (e.g., "LLM Security Risks in 2026: Prompt Injection, RAG, and Shadow AI" → 77/100 BLOCK). Engine couldn't distinguish text that *describes* attacks from text that *performs* them.  
**What shipped:**
- `detectMetaDiscussion(text)` function — 9 linguistic signal detectors + 3 anti-signal detectors
- Returns suppression factor: 1.0 (no signals), 0.65 (1-2 signals, moderate), 0.40 (3+ signals, strong)
- Applied as `academicFactor` multiplier in `scoringFindings` computation alongside profileW × modeW
- `ACADEMIC_IMMUNE` set: pii-exfiltration, command-execution, data-exfil, cross-plugin-forgery, social-engineering — never suppressed regardless of context
- Anti-signals: direct imperative commands cancel academic framing; live exfil URLs +2 anti-signals each
- Processing note added when suppression fires: `📚 Academic/journalistic context detected...`
- MCP route updated to accept + forward `mode` argument to `analyzeText()`
- OpenClaw plugin updated: `inferModeFromSource()` auto-detects `document` mode from web source labels; `mode` exposed as explicit parameter
- **Result:** Same article 77/100 BLOCK → 17/100 ALLOW; real attacks unaffected (86-100/100 BLOCK)
- 69/69 tests passing
