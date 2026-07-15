import { describe, expect, it } from "vitest";

import { parseTutorCommand } from "@/server/agent/tutor/tutor-command";

describe("tutor slash commands", () => {
  it("parses explicit knowledge searches", () => {
    expect(parseTutorCommand("/knowledge 资料分析题速算")).toEqual({
      type: "knowledge",
      query: "资料分析题速算",
    });
  });

  it("keeps ordinary tutor questions as chat", () => {
    expect(parseTutorCommand("为什么不选 B？")).toEqual({
      type: "chat",
      prompt: "为什么不选 B？",
    });
  });
});
