#!/usr/bin/env python3
"""
Due Date Reminder — runs daily at 9 AM SGT
Alerts on tasks due within 24h or already overdue
Sends Discord notification via openclaw CLI
"""
import subprocess
import json
import sys
from datetime import datetime, timezone, timedelta

SGT = timezone(timedelta(hours=8))

def run_sql(query: str) -> list:
    """Run a SQL query against the max_dashboard DB and return rows as list of strings."""
    try:
        result = subprocess.run(
            ['psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'max_dashboard',
             '-c', query, '--csv', '-t'],
            capture_output=True, text=True,
            env={'PGPASSWORD': 'IttpQGczrT91qrdUEHENGsYvpnRIN6aa', 'PATH': '/usr/bin:/bin:/usr/local/bin'},
        )
        if result.returncode != 0:
            print(f"SQL error: {result.stderr}", file=sys.stderr)
            return []
        lines = [l.strip() for l in result.stdout.strip().split('\n') if l.strip()]
        return lines
    except Exception as e:
        print(f"run_sql error: {e}", file=sys.stderr)
        return []

def send_discord(message: str, channel_id: str = '1473990130468524063'):
    """Send a message to Discord via openclaw CLI."""
    try:
        result = subprocess.run(
            ['openclaw', 'message', 'send',
             '--channel', 'discord',
             '--target', channel_id,
             '--message', message],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            print(f"Discord send stderr: {result.stderr}", file=sys.stderr)
    except Exception as e:
        print(f"Discord send error: {e}", file=sys.stderr)

def main():
    now = datetime.now(SGT)
    now_utc = now.astimezone(timezone.utc)
    in_24h = now_utc + timedelta(hours=24)

    print(f"[{now.strftime('%Y-%m-%d %H:%M SGT')}] Running due date reminder check...")

    # Query overdue tasks (dueDate < now, not DONE, not archived)
    overdue_query = f"""SELECT id, title, "dueDate", priority, assignee, status FROM "Task" WHERE "dueDate" < '{now_utc.strftime('%Y-%m-%d %H:%M:%S')}+00' AND status != 'DONE' AND "deletedAt" IS NULL AND "parentId" IS NULL ORDER BY "dueDate" ASC;"""

    # Query due soon tasks (dueDate between now and now+24h, not DONE, not archived)
    due_soon_query = f"""SELECT id, title, "dueDate", priority, assignee, status FROM "Task" WHERE "dueDate" >= '{now_utc.strftime('%Y-%m-%d %H:%M:%S')}+00' AND "dueDate" <= '{in_24h.strftime('%Y-%m-%d %H:%M:%S')}+00' AND status != 'DONE' AND "deletedAt" IS NULL AND "parentId" IS NULL ORDER BY "dueDate" ASC;"""

    overdue_rows = run_sql(overdue_query)
    due_soon_rows = run_sql(due_soon_query)

    if not overdue_rows and not due_soon_rows:
        print("No tasks due or overdue. All clear!")
        return

    lines = ['## 📋 Daily Task Reminder', '']

    if overdue_rows:
        lines.append(f'**🔴 Overdue ({len(overdue_rows)} tasks)**')
        for row in overdue_rows[:10]:  # cap at 10
            parts = row.split(',')
            if len(parts) >= 6:
                title = parts[1].strip().strip('"')
                due_raw = parts[2].strip().strip('"')
                priority = parts[3].strip().strip('"')
                assignee = parts[4].strip().strip('"')
                try:
                    due_dt = datetime.fromisoformat(due_raw.replace(' ', 'T').split('+')[0]).replace(tzinfo=timezone.utc).astimezone(SGT)
                    due_str = due_dt.strftime('%d %b')
                    days_ago = (now_utc - due_dt.astimezone(timezone.utc)).days
                    lines.append(f'• {title} — due {due_str} ({days_ago}d ago) [{priority}] [{assignee}]')
                except Exception:
                    lines.append(f'• {title} [{priority}]')
        lines.append('')

    if due_soon_rows:
        lines.append(f'**🟡 Due in 24h ({len(due_soon_rows)} tasks)**')
        for row in due_soon_rows[:10]:
            parts = row.split(',')
            if len(parts) >= 6:
                title = parts[1].strip().strip('"')
                due_raw = parts[2].strip().strip('"')
                priority = parts[3].strip().strip('"')
                assignee = parts[4].strip().strip('"')
                try:
                    due_dt = datetime.fromisoformat(due_raw.replace(' ', 'T').split('+')[0]).replace(tzinfo=timezone.utc).astimezone(SGT)
                    due_str = due_dt.strftime('%d %b %H:%M')
                    lines.append(f'• {title} — due {due_str} [{priority}] [{assignee}]')
                except Exception:
                    lines.append(f'• {title} [{priority}]')
        lines.append('')

    lines.append('*Check your board: https://dash.vincechew.me/tasks*')

    message = '\n'.join(lines)
    print(f"Sending Discord alert:\n{message}")
    send_discord(message)
    print("Done.")

if __name__ == '__main__':
    main()
