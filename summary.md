# OpenComputer evaluation: SigNoz alert enricher

An OpenComputer agent that adds context to SigNoz alerts in the
`office-infra-alerts` Google Chat space. See [setup.md](setup.md) for how it
was built.

## Findings

- **Fast to get running.** `install → login → init → link → deploy` took
  minutes. `opencomputer doctor` caught structural mistakes before deploy
  (non-literal connection origins, tools outside `tools/`).
- **No Google Chat channel.** Chat integrations are Slack, Twilio (SMS/WhatsApp)
  and email, defined in code, plus Linear through a managed connection.
  Talking to the agent from Google Chat would need a Google Chat app pointed at
  a webhook.
- **SigNoz can call the agent directly.** The webhook accepts SigNoz's raw
  Alertmanager payload; it arrives as `input.payload`.
- **End to end works.** A real OOMKill in `office-k8s` fired the SigNoz rule;
  the agent enriched it and posted to `office-infra-alerts` within ~3 minutes.
- **Separate message, not a reply.** SigNoz's Google Chat post exposes no
  thread, so the agent cannot attach to the original alert.
- **Sessions are pinned to their deployment.** Follow-ups on old sessions run
  old code; only new sessions pick up a redeploy.
- **Behaviour is code, not prompts.** Branching on `input.source` decides which
  tools exist per run: webhook runs post the enrichment; terminal runs post
  only when asked.
- **Agent-level env vars failed** with "service unavailable"; project-level
  worked.
- **A built-in `execute` tool exists.** The agent used it unprompted to look
  for a project database; we never declared it.
- **Alert history is blocked** until the SigNoz service account gets a role
  (currently 403).

## Pros

- Agents as code: TypeScript, version-controlled, deployed with one command.
- Managed egress injects secrets per origin, path and method; secrets never
  sit in agent code.
- Detailed session events: every tool call, outbound request and model call is
  visible.
- Webhooks, `opencomputer run` and `session send` all reach the same agent.
- Fast iteration: redeploys take seconds.

## Cons

- No Google Chat channel; two-way chat needs custom setup.
- Secrets can only go in headers. Google Chat's webhook token sits in the query
  string, so it appears in egress logs.
- The webhook URL carries its token; anyone with the URL can trigger the agent.
- Old sessions do not pick up fixes after a redeploy.
- Models route through OpenRouter by default; free credits are small ($5).
- CLI rough edges: confusing agent ids, agent-level `env set` failing,
  `session inspect` not finding sessions.
- "Only post when asked" in terminal mode is enforced by the prompt, not a
  hard block.
