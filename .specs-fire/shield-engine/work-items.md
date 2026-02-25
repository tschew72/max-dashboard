# Work Items — Shield Engine

**Last updated:** 2026-02-25  
**Execution mode:** Autopilot (routine pattern updates) / Confirm (new categories) / Validate (scoring changes)

---

## Backlog

### WI-007: Nginx + api.vincechew.me SSL setup
**Type:** Infrastructure  
**Mode:** Confirm  
**Status:** BACKLOG  
**Description:** Create Nginx server block for `api.vincechew.me`, provision SSL via certbot HTTP-01, test all 3 MCP endpoints over HTTPS.  
**Steps:**
1. Write `/etc/nginx/sites-available/api.vincechew.me` (proxy → 127.0.0.1:3010)
2. Symlink to sites-enabled, reload Nginx
3. `certbot --nginx -d api.vincechew.me`
4. Test: GET, tools/list, tools/call with injection payload
5. Update OpenClaw plugin MCP URL to `https://api.vincechew.me/api/mcp`

---

### WI-008: Output scanning support (open question #1)
**Type:** Feature  
**Mode:** Validate  
**Status:** BACKLOG  
**Description:** Add `analyzeOutput()` function to engine to scan AI responses for data exfil patterns (secrets, PII, encoded content) before delivery to user.  
**Dependencies:** Vince decision on open question #1 in SPECS-PROMPT-SHIELD.md

---

### WI-009: VAPT chatbot threshold policy (open question #2)
**Type:** Configuration  
**Mode:** Confirm  
**Status:** BACKLOG  
**Description:** Define per-consumer threshold profiles. VAPT chatbot sees intentional security research queries — needs lower sensitivity than general web content.  
**Approach:** Add `profile: 'strict' | 'research' | 'permissive'` param to `analyzeText()`

---

### WI-010: Dashboard Shield page v2 — history + stats
**Type:** Feature  
**Mode:** Autopilot  
**Status:** BACKLOG  
**Description:** Add scan history table, category breakdown pie chart, daily volume stats to `/shield` page. Store last 100 scans in localStorage (no backend required).

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
5. Run `/tmp/shield_test.py` to confirm 29/29 still pass
6. Bump ENGINE_VERSION (minor: `3.0.x`, major: `3.x.0` for new categories)
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
