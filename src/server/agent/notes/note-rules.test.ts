import { describe, expect, it } from "vitest";

import { filterAllowedAgentNoteTagIds } from "@/server/agent/notes/enrichment";
import { agentNoteJobId } from "@/server/agent/notes/queue";
import {
  agentNoteGenerationSchema,
  listAgentNotesSchema,
} from "@/server/agent/notes/schemas";

describe("agent note rules", () => {
  it("accepts a complete structured learning note", () => {
    expect(
      agentNoteGenerationSchema.parse({
        title: "资料分析基期量速算",
        markdown: "先识别现期量与增长率，再使用对应公式。",
        keyPoints: ["基期量 = 现期量 ÷（1 + 增长率）"],
        pitfalls: ["增长率为负时注意符号"],
        applications: ["资料分析基期量题"],
        tagIds: ["tag-1"],
      })
    ).toMatchObject({ tagIds: ["tag-1"] });
  });

  it("keeps only unique server-approved leaf tag ids", () => {
    expect(
      filterAllowedAgentNoteTagIds(
        ["leaf-1", "parent", "leaf-1", "missing"],
        new Set(["leaf-1", "leaf-2"])
      )
    ).toEqual(["leaf-1"]);
  });

  it("normalizes list filters and caps page size", () => {
    expect(listAgentNotesSchema.parse({ trashed: "true", page: "2", pageSize: "50" })).toMatchObject({
      trashed: true,
      page: 2,
      pageSize: 50,
    });
    expect(listAgentNotesSchema.safeParse({ pageSize: "101" }).success).toBe(false);
  });

  it("builds a stable generation-specific BullMQ id without colon separators", () => {
    expect(agentNoteJobId({ noteId: "note-1", generationVersion: 3 })).toBe("note-1-3");
  });
});
