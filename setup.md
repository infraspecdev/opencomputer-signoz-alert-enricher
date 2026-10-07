# Setup

How the SigNoz alert enricher was set up, end to end.

```
SigNoz rule ──webhook──▶ OpenComputer agent ──▶ office-infra-alerts (Google Chat)
                               │
                               └──▶ SigNoz API (alert history)
```

## 1. Install and log in

```bash
npm i -g @opencomputer/cli
opencomputer login          # confirm the device code in the browser
opencomputer whoami
```

## 2. Create and link the project

```bash
opencomputer init .
npm install
opencomputer link --create-project opencomputer-sample
```

`init` creates a hello-world agent. It was replaced with
`opencomputer/agents/signoz-alert-enricher/`:

| File | Purpose |
|---|---|
| `agent.ts` | Prompt and tool selection. Branches on `input.source`. |
| `tools/get-alert-history.ts` | SigNoz `/api/v1/rules/{id}/history/{stats,timeline}` |
| `tools/post-to-google-chat.ts` | Posts to the Chat space, threaded by session id |
| `opencomputer.toml` | Stable agent id |

Constraints `opencomputer doctor` enforces:

- Tools must live in the agent's `tools/` directory.
- `defineConnection` origins must be literal `https://` strings.

## 3. Secrets and runtime variables

SigNoz API key (needs a service account with at least the **Viewer** role):

```bash
printf %s '<signoz-api-key>' | opencomputer secrets set SIGNOZ_API_KEY --value-stdin
```

Google Chat incoming-webhook auth is in the query string, so it is a runtime
variable rather than a header secret. Take `key` and `token` from the space's
webhook URL:

```bash
printf %s 'key=<key>&token=<token>' | opencomputer env set GOOGLE_CHAT_WEBHOOK_QUERY --value-stdin
```

Set it at project level. The agent-level variant (`--agent ...`) failed with
"service unavailable".

## 4. Deploy

```bash
opencomputer doctor
opencomputer deploy
opencomputer agents         # cloud agent id is `opencomputer-sample`
```

## 5. Create the webhook

```bash
opencomputer webhooks create signoz-alerts --agent opencomputer-sample
```

It prints the invocation URL once. The token is inside the URL, so store it
like a secret.

## 6. Wire SigNoz

1. **Alert Channels → New**: type *Webhook*, name `opencomputer-webhook`, URL
   from step 5, **send resolved off**.
2. Add `opencomputer-webhook` to a rule's threshold channels, next to its
   Google Chat channel. The original alert still comes from SigNoz; the agent
   adds a separate context message.

The demo rule `opencomputer-demo-oomkilled` watches
`k8s.container.status.reason = 'OOMKilled'` in namespace `opencomputer-demo`
on cluster `office-k8s`, and routes only to `opencomputer-webhook`.

## 7. Trigger a real alert

```bash
kubectl --context infraspec apply -f k8s/oom-demo.yaml
```

The pod allocates 200Mi against a 64Mi limit and stays `OOMKilled`
(`restartPolicy: Never`). The rule fires within ~3 minutes. To fire again,
apply the pod under a new name; the same pod only notifies once.

Check the run:

```bash
opencomputer session list --limit 5
opencomputer sessions tail <session-id> --no-follow
```

## 8. Ask follow-up questions

```bash
# fresh question; posts a new Chat message only if asked
opencomputer run opencomputer-sample "What usually causes OOMKilled? Post the answer to Chat."

# follow-up on an alert; posts under the alert's thread only if asked
opencomputer session send <alert-session-id> "Why would 64Mi OOM here? Post it to Chat."
```

Sessions are pinned to the deployment that created them. Follow-ups on
sessions from before a redeploy run the old code.

## Clean up

```bash
kubectl --context infraspec delete namespace opencomputer-demo
opencomputer webhooks disable <webhook-id>
```

Delete the `opencomputer-demo-oomkilled` rule and `opencomputer-webhook`
channel in SigNoz if no longer needed.
