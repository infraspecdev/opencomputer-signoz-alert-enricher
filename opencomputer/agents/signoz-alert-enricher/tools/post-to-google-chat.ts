import { type DataValue, defineConnection, defineTool } from "@opencomputer/agent";

// Google Chat space for office-infra-alerts.
const CHAT_SPACE_PATH = "/v1/spaces/AAQAIf6D2JA/messages";

// Incoming-webhook auth lives in the query string (key + token), so it is
// read from the GOOGLE_CHAT_WEBHOOK_QUERY runtime variable, not a header secret.
const googleChat = defineConnection({
  id: "google-chat",
  origin: "https://chat.googleapis.com",
  methods: ["POST"],
  pathPrefix: "/v1/spaces/AAQAIf6D2JA/messages",
  headers: { "Content-Type": "application/json; charset=UTF-8" },
});

// Every message is threaded by session id: the alert post starts the thread,
// and follow-ups from the same session reply under it.
async function send(text: string, threadKey: string, replyOption: string): Promise<DataValue> {
  const query = process.env.GOOGLE_CHAT_WEBHOOK_QUERY;
  if (!query) return { ok: false, error: "GOOGLE_CHAT_WEBHOOK_QUERY is not set" };
  const response = await googleChat.fetch(
    `${CHAT_SPACE_PATH}?${query}&messageReplyOption=${replyOption}`,
    {
      method: "POST",
      body: JSON.stringify({ text, thread: { threadKey } }),
    },
  );
  return response.ok
    ? { ok: true }
    : { ok: false, error: `HTTP ${response.status}`, body: (await response.text()).slice(0, 500) };
}

const textInput = {
  type: "object",
  properties: {
    text: {
      type: "string",
      description: "Message in Google Chat formatting (*bold*, _italic_, <url|label>).",
    },
  },
  required: ["text"],
  additionalProperties: false,
};

export const postToChat = defineTool({
  name: "post_to_google_chat",
  description:
    "Post the enriched alert message to the office-infra-alerts Google Chat space. Call exactly once.",
  input: textInput,
  async run({ input, sessionId }) {
    return send(String(input.text), sessionId, "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD");
  },
});

export const shareInChat = defineTool({
  name: "share_in_chat",
  description:
    "Post to the office-infra-alerts Google Chat space. Replies under this session's alert thread if there is one, otherwise posts a new message. Use only when the operator explicitly asks to post or share in Chat.",
  input: textInput,
  async run({ input, sessionId }) {
    return send(String(input.text), sessionId, "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD");
  },
});
