#!/usr/bin/env python3
"""
Auto-Heal Jobs — runs nightly at 2 AM SGT
Clears consecutive errors on OpenClaw jobs and triggers re-runs.
Sends a Discord summary of what was healed.
"""
import json, subprocess, sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

SGT = timezone(timedelta(hours=8))
JOBS_PATH = Path('/root/.openclaw/cron/jobs.json')
DISCORD_CHANNEL = 'channel:1473990130468524063'
MAX_ERRORS_TO_HEAL = 10  # don't auto-heal jobs with >10 errors (likely broken permanently)

def send_discord(message: str):
    try:
        subprocess.run(
            ['openclaw', 'message', 'send', '--channel', 'discord',
             '--target', DISCORD_CHANNEL, '--message', message],
            timeout=15, check=False
        )
    except Exception as e:
        print(f'Discord send failed: {e}', file=sys.stderr)

def trigger_job(job_id: str) -> bool:
    try:
        subprocess.run(
            ['openclaw', 'cron', 'run', job_id, '--timeout', '30000'],
            timeout=35, check=False, capture_output=True
        )
        return True
    except Exception:
        return False

def main():
    now = datetime.now(SGT)
    print(f'[{now.isoformat()}] Auto-heal jobs starting...')

    if not JOBS_PATH.exists():
        print('jobs.json not found', file=sys.stderr)
        sys.exit(1)

    data = json.loads(JOBS_PATH.read_text())
    jobs = data.get('jobs', data) if isinstance(data, dict) else data

    healed = []
    skipped = []

    for job in jobs:
        state = job.get('state', {})
        consecutive_errors = int(state.get('consecutiveErrors', 0))
        last_status = state.get('lastStatus', 'ok')
        name = job.get('name', job.get('id', 'unknown'))
        job_id = job.get('id', '')
        enabled = job.get('enabled', True)

        if not enabled:
            continue

        if consecutive_errors > 0 or last_status == 'error':
            if consecutive_errors > MAX_ERRORS_TO_HEAL:
                skipped.append(f'• {name} ({consecutive_errors} errors — too many, manual review needed)')
                continue

            # Clear errors
            state['consecutiveErrors'] = 0
            state['lastStatus'] = 'ok'
            job['state'] = state

            # Trigger re-run
            triggered = trigger_job(job_id)
            healed.append({
                'name': name,
                'prev_errors': consecutive_errors,
                'triggered': triggered,
            })
            print(f'  Healed: {name} ({consecutive_errors} errors cleared, triggered={triggered})')

    # Write back
    JOBS_PATH.write_text(json.dumps(data, indent=2))

    # Report
    if not healed and not skipped:
        print('No jobs needed healing.')
        return

    lines = [f'🩹 **Nightly Job Auto-Heal** — {now.strftime("%b %d, %Y")}']
    if healed:
        lines.append(f'\n✅ **Healed {len(healed)} job{"s" if len(healed) != 1 else ""}:**')
        for h in healed:
            run_status = '▶ re-run triggered' if h['triggered'] else '⚠ re-run failed'
            lines.append(f'  • {h["name"]} — cleared {h["prev_errors"]} error{"s" if h["prev_errors"] != 1 else ""} · {run_status}')
    if skipped:
        lines.append(f'\n⚠️ **Skipped (too many errors — needs manual review):**')
        lines.extend(skipped)

    message = '\n'.join(lines)
    print(message)
    send_discord(message)

if __name__ == '__main__':
    main()
