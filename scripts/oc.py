#!/usr/bin/env python3
"""Small helpers around the OpenComputer CLI for the Makefile.

  oc.py latest                 print the newest session id
  oc.py wait --since ISO       wait for a webhook session created after ISO
  oc.py summary SESSION_ID     print a readable summary of a session

Query strings are stripped from egress paths so webhook tokens never print.
"""

import argparse
import json
import re
import subprocess
import sys
import time

EVENT = re.compile(r"^(\d+) ([a-z_.]+) (\{.*\})\s*$")


def sessions(limit=10):
    out = subprocess.run(
        ["opencomputer", "session", "list", "--limit", str(limit), "--json"],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)["sessions"]


def latest(_args):
    items = sessions(1)
    if not items:
        sys.exit("No sessions yet.")
    print(items[0]["id"])


def wait(args):
    deadline = time.time() + args.timeout
    print(f"  Waiting up to {args.timeout // 60} min for SigNoz to call the agent", end="", flush=True)
    while time.time() < deadline:
        for s in sessions(5):
            if s["createdAt"] > args.since and s.get("source") == "webhook":
                print(f"\n  New session: {s['id']}")
                wait_idle(s["id"], deadline)
                return
        print(".", end="", flush=True)
        time.sleep(15)
    sys.exit("\n  Timed out. Check the rule in SigNoz, then run `make sessions`.")


def wait_idle(session_id, deadline):
    print("  Waiting for the agent to finish", end="", flush=True)
    while time.time() < deadline:
        current = next((s for s in sessions(10) if s["id"] == session_id), None)
        activity = (current or {}).get("activity") or {}
        if activity.get("lastSettledTurn") and not activity.get("activeTurnId") and not activity.get("queued"):
            print(" done")
            return
        print(".", end="", flush=True)
        time.sleep(5)
    sys.exit("\n  Timed out waiting for the agent to finish.")


def events(session_id):
    out = subprocess.run(
        ["opencomputer", "sessions", "tail", session_id, "--no-follow"],
        capture_output=True, text=True, check=True,
    ).stdout
    for line in out.splitlines():
        match = EVENT.match(line)
        if not match:
            continue
        try:
            yield match.group(2), json.loads(match.group(3))
        except json.JSONDecodeError:
            continue


def summary(args):
    for kind, data in events(args.session):
        if kind == "message.received":
            payload = data.get("payload") or {}
            alerts = payload.get("alerts") or []
            if alerts:
                labels = alerts[0].get("labels", {})
                where = labels.get("k8s.pod.name") or labels.get("k8s.node.name") or "?"
                print(f"  ← alert   {payload.get('status')}: {labels.get('alertname')} ({where})")
            else:
                print(f"  ← input   {data.get('input', '')[:100]}")
        elif kind == "tool.started":
            print(f"  ⚙ tool    {data.get('tool')}")
        elif kind == "egress.response":
            path = data.get("path", "").split("?", 1)[0]
            print(f"  → {data.get('connectionId'):<12} {data.get('method')} {path}  HTTP {data.get('status')}")
        elif kind == "turn.completed":
            print("  ✓ turn completed")
        elif kind == "turn.failed":
            print(f"  ✗ turn failed: {data}")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(required=True)
    sub.add_parser("latest").set_defaults(func=latest)
    p = sub.add_parser("wait")
    p.add_argument("--since", required=True)
    p.add_argument("--timeout", type=int, default=480)
    p.set_defaults(func=wait)
    p = sub.add_parser("summary")
    p.add_argument("session")
    p.set_defaults(func=summary)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
