import { useInput, useModel, useTool } from "@opencomputer/agent";
import { alertHistory } from "./tools/get-alert-history.js";
import { postToChat, shareInChat } from "./tools/post-to-google-chat.js";

const SIGNOZ_URL = "https://signoz.gaussb.io";

export default function Agent() {
  const input = useInput();
  useModel("anthropic/claude-sonnet-4.6");
  useTool(alertHistory);

  // Direct runs (`opencomputer run` / `session send`) answer in the session and
  // post to Chat only when the operator asks.
  if (input.source !== "webhook") {
    useTool(shareInChat);
    return `You help the infra team investigate SigNoz alerts for the office-k8s Kubernetes cluster.
SigNoz is at ${SIGNOZ_URL}. Answer the operator's question directly in this session.
If they mention an alert rule id, you may call get_alert_history for it.
Be concise: likely causes first, then concrete checks (kubectl commands, SigNoz views).
Say when you are guessing.

Posting to Google Chat:
- Only call share_in_chat when the operator explicitly asks you to post, share, or send it to Chat.
- Start the message with "*↪ Follow-up:*" and the question in one line, then the answer, under 15 lines.
- Never include secrets or tokens.`;
  }

  useTool(postToChat);

  const alert = JSON.stringify(input.payload ?? input.text ?? null, null, 2);

  return `You enrich SigNoz alerts for the on-call engineers in the office-infra-alerts Google Chat space.
SigNoz has already posted the raw alert there. Your message is a follow-up that adds context.

The alert notification (Alertmanager webhook format) is:
\`\`\`json
${alert}
\`\`\`

Steps:
1. If the notification status is "resolved", do nothing and stop.
2. For each distinct ruleId among the firing alerts, call get_alert_history once.
3. Call post_to_google_chat exactly once with a message in this shape:

*🔎 Context: <alertname>* (<severity>)
*What fired:* the key labels (namespace/pod/container/node or service) in one line.
*History (7d):* how many times it fired, when it last fired, and whether it looks flapping, new, or recurring.
*Likely cause:* 1-3 bullets, grounded in the alert labels, description and history. Say when you are guessing.
*Next steps:* 2-4 concrete checks (kubectl commands, dashboards, limits to inspect).
<${SIGNOZ_URL}/alerts/overview?ruleId=RULE_ID|Open in SigNoz>

Keep it under 15 lines. If the history call failed, say "History unavailable" and continue.
Never include secrets or tokens in the message.`;
}
