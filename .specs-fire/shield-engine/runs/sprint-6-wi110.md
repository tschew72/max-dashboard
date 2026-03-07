# Sprint 6: WI-110 — Browser Agent Hardening Mode

**Date:** 2026-02-26  
**Engineer:** Max (AI)  
**Engine:** v3.7.0 → v3.8.0  
**Status:** ✅ COMPLETE  
**Tests:** 74/74 (64 MCP + 10 multi-turn) — zero regressions

---

## What Shipped

### Engine v3.8.0 Changes (`shield-engine-core/src/index.ts`)

**New InputMode: `browser_agent`** (6th mode)
- Returns `attackSurface: 'browser'` in response
- Auto-inferred when input starts with `<!DOCTYPE html>` / `<html>` or contains >8 HTML tags

**New detection category: `html-injection`** (30th category, severity: critical, cluster: INDIRECT)
- 15 regex patterns covering 6 attack vectors:
  - HTML attribute injection (title, alt, aria-label, data-*, placeholder)
  - CSS `content:` / `::before` / `::after` injection
  - HTML comment injection (`<!-- OVERRIDE: ... -->`)
  - Meta / noscript / script comment injection
  - DOM exfiltration instructions (cookie/localStorage extraction)
  - Hidden text injection (display:none, visibility:hidden, color:white, font-size:0)

**`BROWSER_AGENT_BOOST` weight map:**
- `html-injection` 2.0×, `indirect-injection` 1.8×, `data-exfil` 1.5×, `pii-exfiltration` 1.4×
- Suppressed: `jailbreak-sequence` 0.3×, `persona-hijack` 0.35×

**`detectHtmlInjection()` heuristic function:**
- Extracts HTML attribute values (title, alt, aria-label, data-*, placeholder) and checks INJECTION_KEYWORDS
- Extracts CSS `content:` values and checks INJECTION_KEYWORDS
- Detects zero-width Unicode clusters (>5 chars) in HTML context
- Detects RTL/bidi override characters (>3 chars) in HTML context
- Returns synthetic Finding with category `html-injection`, confidence 70 + 8 per suspicious match

**`html-injection` added to FAST_PATH_IDS** — runs in pre-scan for early termination

**`inferMode()` updated:**
- Rich HTML (>8 tags or `<!DOCTYPE html>` or `<html>` prefix) → `browser_agent`
- Minimal HTML (1-8 tags) → `document` (preserves existing behavior)

**Academic suppressor disabled for `browser_agent` mode** — real HTML injection must not be downplayed by meta-discussion signals

### MCP Route (`app/api/mcp/route.ts`)
- `browser_agent` added to `VALID_MODES` array
- Mode forwarded to `analyzeText()` (fix from v3.7.0 retained)

### OpenClaw Plugin (`~/.openclaw/extensions/prompt-shield/index.ts`)
- `inferModeFromSource()` updated: source containing "browser", "page_source", "html", "dom" → `browser_agent`
- Text-based auto-detection: if text starts with `<!DOCTYPE html>` or has >10 HTML tags → `browser_agent`
- `mode` enum in tool schema now includes `browser_agent`

### IngestShield OpenAPI (`src/app/api/openapi/route.ts`)
- `browser_agent` added to mode enum (3 locations)
- `browser` added to attackSurface enum
- Engine version example: `3.8.0`

---

## Test Results

### New browser-agent test cases (5)
| TC | Input | Expected | Score | Result |
|---|---|---|---|---|
| B1 | HTML title-attribute injection | BLOCK | 76 | ✅ |
| B2 | HTML comment injection | BLOCK | 100 | ✅ |
| B3 | CSS ::before content injection | BLOCK | 100 | ✅ |
| B4 | Normal HTML page (no injection) | ALLOW | 0 | ✅ |
| B5 | Hidden span with cookie exfiltration | BLOCK | 57 | ✅ |

### Live MCP verification (6 additional)
| Test | Mode | Score | Result |
|---|---|---|---|
| HTML attr inject | browser_agent | 100 | BLOCK ✅ |
| Clean HTML page | browser_agent | 0 | ALLOW ✅ |
| Auto-infer HTML (no mode) | auto→browser_agent | 0 | ALLOW ✅ |
| CSS inject | browser_agent | 100 | BLOCK ✅ |
| Security article | web_search→document | 0 | ALLOW ✅ |
| Real attack | auto→user_prompt | 100 | BLOCK ✅ |

### Full regression suite
- Core: 53/53 ✅
- Profile: 6/6 ✅
- Browser: 5/5 ✅
- Multi-turn: 10/10 ✅
- **Total: 74/74** ✅

---

## Files Changed

| File | Change |
|---|---|
| `shield-engine-core/src/index.ts` | +1 category, +1 InputMode, +1 attackSurface, +1 boost map, +1 heuristic function, +1 fast-path ID |
| `shield-engine-core/package.json` | version 3.7.0 → 3.8.0 |
| `max-dashboard/app/api/mcp/route.ts` | browser_agent in VALID_MODES |
| `~/.openclaw/extensions/prompt-shield/index.ts` | inferModeFromSource + schema update |
| `ingestshield/src/app/api/openapi/route.ts` | browser_agent + browser in enums |
| `ingestshield/USER-GUIDE.md` | browser_agent section + cookbook + changelog |
| `ingestshield/.specs-fire/competitive-features/work-items.md` | WI-110 marked done |
| `/tmp/shield_test.py` | +5 browser tests, mode param support |
| `MEMORY.md` | v3.8.0, 74/74 tests |

## Commits
| Repo | What |
|---|---|
| shield-engine-core | `engine: release v3.8.0` |
