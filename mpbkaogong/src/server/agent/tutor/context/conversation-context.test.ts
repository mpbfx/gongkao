import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";

import { trimConversationContext } from "@/server/agent/tutor/context/conversation-context";

describe("trimConversationContext", () => {
  it("keeps the newest messages inside the configured context budget", async () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "旧".repeat(20_000), timestamp: 1 },
      { role: "user", content: "中".repeat(10_000), timestamp: 2 },
      { role: "user", content: "最新追问", timestamp: 3 },
    ];

    const result = await trimConversationContext(messages);

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ role: "user", content: "最新追问" });
  });
});
