# Demo script

A 10-minute live demo: a real OOMKill in `office-k8s` becomes an enriched
alert in Google Chat, then we ask the agent a follow-up from the terminal.

Every step is a `make` target that prints what it is doing. Run `make help` to
see them all.

## Before the demo

Do these once, a few minutes before you present.

| Check | Command | Expect |
|---|---|---|
| Logged in | `make whoami` | Your user and workspace |
| Agent deployed | `make deploy` | `Doctor passed` and `Deployed` |
| Secrets, webhook and pods | `make status` | `SIGNOZ_API_KEY`, `GOOGLE_CHAT_WEBHOOK_QUERY`, webhook `enabled` |
| Cluster access | `kubectl --context infraspec get nodes` | Nodes `Ready` |

Also:

- Open the `office-infra-alerts` space in Google Chat on a second screen.
- Open the `opencomputer-demo-oomkilled` rule in SigNoz.
- Tell the space a demo is running, so nobody acts on the test alert.

## 1. Show the moving parts (1 min)

```bash
make status
```

> "This is one agent on OpenComputer. It has a SigNoz API key and a Google
> Chat token, both held by OpenComputer, not in the code. SigNoz calls it
> through this webhook."

Show `opencomputer/agents/signoz-alert-enricher/agent.ts` briefly:

> "The agent is a TypeScript function. It picks the model, the tools and the
> prompt on each turn. Alerts get the 'post to Chat' tool; terminal questions
> only post when asked."

## 2. Break something on purpose (1 min)

```bash
make oom
```

> "This pod tries to allocate 200Mi with a 64Mi limit. Kubernetes kills it
> immediately — you can see `OOMKilled`."

## 3. Wait for the alert (~3 min)

```bash
make wait-alert
```

> "SigNoz evaluates the rule every minute. When it fires, it calls the
> agent's webhook. That starts a new session on OpenComputer."

While it waits, show the rule in SigNoz: it routes to the
`opencomputer-webhook` channel.

Shortcut: `make demo` runs steps 2–4 in one go.

## 4. Show what the agent did (1 min)

```bash
make summary
```

> "Here is the whole run: the alert came in, the agent called SigNoz for the
> alert history, then posted to Google Chat — HTTP 200."

Switch to Google Chat and show the message: what fired, likely cause, next
steps, and a link back to SigNoz.

## 5. Ask a follow-up (2 min)

```bash
make follow-up Q="Why would a 64Mi limit OOM for this container?"
```

> "The follow-up goes into the same session, so the agent still knows which
> alert we mean. Because I asked, it posts the answer as a reply in the alert's
> thread."

Show the threaded reply in Google Chat, then:

```bash
make summary
```

> "The new turn used `share_in_chat` and posted under the same thread."

Optional — a terminal-only question, nothing posted:

```bash
make ask Q="What usually causes OOMKilled?"
```

## 6. Wrap up (1 min)

Sum up the findings:

- **Good:** deploys in seconds, secrets handled by the platform, full session
  history.
- **Gaps:** no Google Chat channel, conversations only resume on built-in
  integrations, Codex is the only subscription you can bring.

## Clean up

```bash
make clean
```

Deletes the `opencomputer-demo` namespace and its pods. The SigNoz rule and
the webhook stay for the next demo.

## If something goes wrong

| Problem | Fix |
|---|---|
| `make wait-alert` times out | Check the rule in SigNoz is enabled and routes to `opencomputer-webhook`. Run `make sessions`. |
| `History unavailable (403)` in the message | The SigNoz service account needs the Viewer role. The rest of the demo still works. |
| No Chat message | `make summary` — look for the `google-chat` line and its HTTP status. |
| Follow-up does not post | `make sessions` and pass the alert's session: `make follow-up SESSION=<id> Q="..."` |
| Pod never gets OOMKilled | `kubectl --context infraspec -n opencomputer-demo describe pod <name>` |
