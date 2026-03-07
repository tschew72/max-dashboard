# Deploy Checklist — Max Dashboard Pages V2

**Feature:** Pages V2 (new dashboard panels with SSE live data)
**Build ID:** 83mMfhx2Xyf_GTRCEEuVE (built 2026-03-07 19:46 SGT)
**Service:** max-dashboard | Port: 3010 | Domain: dash.vincechew.me
**Author:** Dex 🚀 | Prepared: 2026-03-07

---

## ✅ Pre-Deploy Checks

### Code & Build
- [ ] QA signed off on Pages V2 feature
- [ ] All git changes committed and pushed (`git status` clean)
- [ ] `npm run build` passes without errors in `/root/projects/max-dashboard/`
- [ ] `.next/` directory exists and BUILD_ID is fresh (≤ 1h old):
      `stat /root/projects/max-dashboard/.next/BUILD_ID | grep Modify`
- [ ] No TypeScript / ESLint errors blocking build

### Environment
- [ ] `.env.local` or `.env.production` contains all required vars
  - `DATABASE_URL` (note: Postgres on port **5433**, not 5432)
  - `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
  - Any new env vars introduced in Pages V2
- [ ] Verify: `pm2 env max-dashboard` reflects correct env

### Infrastructure
- [ ] `pm2 status` — max-dashboard shows `online`
- [ ] nginx config valid: `nginx -t`
- [ ] Disk space: `df -h /` — at least 2 GB free
- [ ] Memory: `free -m` — at least 512 MB available

---

## 🚀 Deploy Steps

```bash
# 1. Navigate to project
cd /root/projects/max-dashboard

# 2. Pull latest code (if deploying from git)
git pull origin main

# 3. Install dependencies (if package.json changed)
npm ci --production

# 4. Build
npm run build

# 5. Restart PM2 with updated env
pm2 restart max-dashboard --update-env

# 6. Wait for startup
sleep 5

# 7. Verify PM2 status
pm2 status max-dashboard
```

---

## ✅ Post-Deploy Verification

### PM2 Health
```bash
pm2 status max-dashboard          # Status: online, no crash-loop
pm2 logs max-dashboard --lines 30 # No startup errors
```
Expected: `status: online`, restart count not increasing

### HTTP Health Check
```bash
curl -s -o /dev/null -w "%{http_code}" https://dash.vincechew.me/
# Expected: 200 or 307 (auth redirect — both OK)

curl -sv https://dash.vincechew.me/api/health 2>&1 | grep "< HTTP"
# Expected: HTTP/2 200
```

### SSE Endpoint (Pages V2 critical)
```bash
# Auth-protected — will redirect to /login (expected 307)
curl -sv -m 5 -N -H "Accept: text/event-stream" \
  http://127.0.0.1:3010/api/dashboard/stream 2>&1 | grep "< HTTP"
# Expected: 307 (auth redirect) — confirms endpoint is alive
```

### Browser Smoke Test
- [ ] Log in to dash.vincechew.me
- [ ] Navigate to new V2 pages — panels render without console errors
- [ ] SSE panels show live data (not stuck on "Loading...")
- [ ] No 502/504 errors in nginx error log: `tail -20 /var/log/nginx/dash_error.log`

### Static Assets
```bash
# Verify Next.js static assets served with immutable cache
curl -sv "https://dash.vincechew.me/_next/static/chunks/main.js" 2>&1 | \
  grep -i "cache-control"
# Expected: Cache-Control: public, max-age=31536000, immutable
```

---

## 🔴 Rollback Procedure

### Option A — Git Revert + Rebuild (preferred)

```bash
cd /root/projects/max-dashboard

# Identify last stable commit
git log --oneline -10

# Revert to last known-good commit
git revert HEAD --no-edit
# OR reset hard (destructive — only if revert fails):
# git reset --hard <commit-sha>

# Rebuild
npm run build

# Restart
pm2 restart max-dashboard --update-env

# Verify
sleep 5 && pm2 status max-dashboard
curl -s -o /dev/null -w "%{http_code}" https://dash.vincechew.me/
```

### Option B — PM2 Rollback (previous build still in .next/)

> Only works if `.next/` wasn't overwritten yet.

```bash
# If you have a backup of the previous .next/ dir:
cp -r /root/projects/max-dashboard/.next.bak /root/projects/max-dashboard/.next
pm2 restart max-dashboard --update-env
```

> **Best practice:** Before any deploy, backup current build:
> `cp -r /root/projects/max-dashboard/.next /root/projects/max-dashboard/.next.bak`

### Rollback Verification
```bash
pm2 status max-dashboard
curl -s -o /dev/null -w "%{http_code}" https://dash.vincechew.me/
pm2 logs max-dashboard --lines 20
```

---

## 🔧 Nginx Config Status (as of 2026-03-07)

| Check | Status | Notes |
|-------|--------|-------|
| Proxy pass → port 3010 | ✅ | Both HTTP + HTTPS blocks |
| WebSocket upgrade headers | ✅ | `Upgrade` + `Connection` headers set |
| `proxy_buffering off` | ✅ | Required for SSE |
| `proxy_read_timeout 3600s` | ✅ | **Added 2026-03-07** — SSE keep-alive |
| Gzip enabled | ✅ | Global in nginx.conf (comp level 8) |
| Static asset cache | ✅ | `/_next/static/` → immutable 1yr |
| HTML no-cache | ✅ | `no-store, no-cache, must-revalidate` |

---

## 📋 Infrastructure Snapshot (Pre-Deploy Baseline)

- **PM2 max-dashboard:** online | Restarts: 9 | Uptime: ~20 min | CPU: 0% | RAM: 67 MB
- **Build ID:** `83mMfhx2Xyf_GTRCEEuVE`
- **Build timestamp:** 2026-03-07 19:46 SGT
- **SSL:** Let's Encrypt — `dash.vincechew.me` (check expiry: `certbot certificates | grep -A3 dash`)
- **Nginx:** Reloaded 2026-03-07 after proxy_read_timeout fix

---

*Checklist prepared by Dex 🚀 — Evvo Labs DevOps*
