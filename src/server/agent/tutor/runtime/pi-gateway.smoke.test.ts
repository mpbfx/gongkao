import { Agent, type AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { createTutorModel, getTutorApiKey } from "@/server/agent/tutor/models/pi-model";

const runSmoke = process.env.RUN_AGENT_INTEGRATION === "true";

describe.runIf(runSmoke)("Pi gateway integration", () => {
  it(
    "streams a real tool call through the configured OpenAI-compatible gateway",
    async () => {
      let called = false;
      const probe: AgentTool = {
        name: "gateway_probe",
        label: "Gateway probe",
        description: "Call this tool exactly once before answering.",
        parameters: Type.Object({ value: Type.Literal("ok") }),
        execute: async () => {
          called = true;
          return { content: [{ type: "text", text: "probe complete" }], details: {} };
        },
      };
      const agent = new Agent({
        initialState: {
          systemPrompt: "Call gateway_probe with value ok, then answer with the word complete.",
          model: createTutorModel(),
          tools: [probe],
          thinkingLevel: "off",
          messages: [],
        },
        getApiKey: getTutorApiKey,
        toolExecution: "sequential",
      });

      await agent.prompt("Run the probe.");

      expect(called).toBe(true);
      expect(agent.state.errorMessage).toBeUndefined();
    },
    60_000
  );
});
