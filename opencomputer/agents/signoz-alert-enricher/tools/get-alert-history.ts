import { defineConnection, defineTool, secretHeader, useSecret } from "@opencomputer/agent";

const signoz = defineConnection({
  id: "signoz-api",
  origin: "https://signoz.gaussb.io",
  methods: ["POST"],
  pathPrefix: "/api/v1/rules/",
  headers: {
    "SIGNOZ-API-KEY": secretHeader(useSecret("SIGNOZ_API_KEY")),
    "Content-Type": "application/json",
  },
});

const DAY_MS = 24 * 60 * 60 * 1000;

export const alertHistory = defineTool({
  name: "get_alert_history",
  description:
    "Fetch a SigNoz alert rule's firing stats and recent state transitions over the last 7 days.",
  input: {
    type: "object",
    properties: {
      ruleId: { type: "string", description: "SigNoz alert rule id (the ruleId label)." },
    },
    required: ["ruleId"],
    additionalProperties: false,
  },
  async run({ input }) {
    const ruleId = encodeURIComponent(String(input.ruleId));
    const end = Date.now();
    const start = end - 7 * DAY_MS;

    const post = async (path: string, body: object) => {
      const response = await signoz.fetch(`/api/v1/rules/${ruleId}/history/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const text = await response.text();
      if (!response.ok) return { error: `HTTP ${response.status}`, body: text.slice(0, 500) };
      try {
        return JSON.parse(text).data ?? null;
      } catch {
        return { error: "non-JSON response", body: text.slice(0, 500) };
      }
    };

    const [stats, timeline] = await Promise.all([
      post("stats", { start, end }),
      post("timeline", { start, end, order: "desc", limit: 30 }),
    ]);
    return { windowDays: 7, stats, timeline };
  },
});
