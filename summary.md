# OpenComputer evaluation

Findings from building a SigNoz alert enricher on OpenComputer. See
[setup.md](setup.md) for how it was built.

## TL;DR

- OpenComputer feels like **Vercel for agents**: link a project, deploy from
  code with one command, and manage env, secrets and logs from the CLI.
- Getting a working agent took minutes; the SigNoz → agent → Google Chat flow
  worked end to end on a real alert.
- Strong on developer experience: secrets, observability, and many ways to
  trigger the agent.
- Gaps: Codex is the only subscription you can bring, no Google Chat channel,
  secrets only in headers, and some CLI rough edges.

## What it looks like

- [Alert enrichment](docs/images/alert-enrichment.png): the agent's context
  message in Google Chat for a real OOMKilled alert from this sample.
- [Follow-up reply](docs/images/follow-up-reply.png): a question asked from the
  terminal with `opencomputer session send`, posted as a thread reply under
  the alert.

## Findings

- **Quick to start.** Install, login, init, link and deploy took minutes.
  Redeploys take seconds.
- **`opencomputer doctor` catches mistakes early.** It flags structural
  problems (tool placement, connection origins, missing secrets) before deploy.
- **Agents are TypeScript.** The agent is a function that runs before each
  model call and picks the model, tools and prompt for that turn. Tool access
  can depend on where the input came from (webhook, terminal, channel).
- **Many ways in.** Webhooks, `opencomputer run`, interactive sessions,
  schedules, and channels all reach the same agent.
- **Webhooks accept any JSON.** A third-party payload (SigNoz's Alertmanager
  format) worked as-is and arrived as `input.payload`.
- **Channels:** Slack, Twilio (SMS/WhatsApp) and email are defined in code;
  Linear connects as a managed service. No Google Chat.
- **Managed egress for secrets.** Outbound calls go through a gateway that
  injects secrets per origin, path and method. Secrets never reach agent code.
  Secrets can only be injected into headers.
- **Full observability.** Session events show every model call, tool call and
  outbound request with status codes.
- **Sessions are pinned to their deployment.** A redeploy does not change
  existing sessions; only new sessions run new code.
- **Built-in tools exist beyond what you declare.** The agent used a
  platform `execute` tool on its own to look for a project database.
- **Models route through OpenRouter** by default, on managed credits.
  You can bring a Codex subscription, an OpenRouter key, or any
  OpenAI-compatible endpoint (read from CLI help; not tested).

## Pros

- Agents as code: version-controlled, reviewable, one-command deploys.
- Secrets handled by the platform, scoped per destination.
- Detailed, inspectable session history for debugging.
- Flexible triggers: webhook, CLI, sessions, schedules, channels.
- Fast feedback loop.

## Cons

- **Codex is the only subscription you can bring.** Other models need an
  OpenRouter key or an OpenAI-compatible endpoint.
- No Google Chat channel.
- **Conversations only resume on built-in integrations.** On Slack, Twilio,
  email or Linear, a reply continues the same session. Elsewhere (like Google
  Chat via webhook) every message starts a new session; follow-ups need
  `opencomputer session send <id>` from the CLI or custom session mapping.
- **Not self-hostable outside Enterprise.** Running in your own cloud or VPC
  is an Enterprise (custom pricing) feature; other plans run on OpenComputer's
  cloud.
- Secrets only in headers; APIs that authenticate via query string (like
  Google Chat webhooks) need a plain runtime variable, and the value shows up
  in egress logs.
- Old sessions keep running old code after a redeploy.
- Undeclared built-in tools make the agent's reach less obvious.
- CLI rough edges: agent ids differ from local names, agent-level `env set`
  failed while project-level worked, `session inspect` could not find
  sessions that `sessions tail` could.
