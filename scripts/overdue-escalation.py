#!/usr/bin/env python3
"""
Overdue Escalation — runs every 6 hours
Auto-bumps tasks overdue 3+ days to URGENT priority
"""
import subprocess
import sys
from datetime import datetime, timezone, timedelta

SGT = timezone(timedelta(hours=8))

def run_sql(query: str) -> str:
    """Run a SQL query against the max_dashboard DB and return raw output."""
    try:
        result = subprocess.run(
            ['psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'max_dashboard', '-c', query],
            capture_output=True, text=True,
            env={'PGPASSWORD': 'IttpQGczrT91qrdUEHENGsYvpnRIN6aa', 'PATH': '/usr/bin:/bin:/usr/local/bin'},
        )
        if result.returncode != 0:
            print(f"SQL error: {result.stderr}", file=sys.stderr)
        return result.stdout
    except Exception as e:
        print(f"SQL error: {e}", file=sys.stderr)
        return ''

def main():
    now = datetime.now(timezone.utc)
    three_days_ago = now - timedelta(days=3)
    cutoff = three_days_ago.strftime('%Y-%m-%d %H:%M:%S')
    ts = datetime.now(SGT).strftime('%Y-%m-%d %H:%M SGT')

    print(f"[{ts}] Running overdue escalation check...")

    # Find tasks to escalate
    find_query = f"""SELECT id, title, priority FROM "Task" WHERE "dueDate" < '{cutoff}+00' AND status != 'DONE' AND priority != 'URGENT' AND "deletedAt" IS NULL AND "parentId" IS NULL;"""

    result = run_sql(find_query)

    # Count affected rows — filter out header/divider/count lines
    lines = [
        l for l in result.strip().split('\n')
        if l.strip()
        and '---' not in l
        and 'row' not in l.lower()
        and l.strip().lower() not in ('id | title | priority', 'id', '')
        and not l.startswith(' id ')
    ]

    if not lines:
        print(f"[{ts}] No tasks to escalate.")
        return

    # Escalate them all
    escalate_query = f"""UPDATE "Task" SET priority = 'URGENT', "updatedAt" = NOW() WHERE "dueDate" < '{cutoff}+00' AND status != 'DONE' AND priority != 'URGENT' AND "deletedAt" IS NULL AND "parentId" IS NULL;"""

    run_sql(escalate_query)
    print(f"[{ts}] Escalated {len(lines)} task(s) to URGENT.")

if __name__ == '__main__':
    main()
