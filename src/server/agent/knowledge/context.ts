import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, Message } from "@mariozechner/pi-ai";

import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/server/services/errors";

const emptyUsage: AssistantMessage["usage"] = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

function toAgentMessage(message: { role: string; content: string; createdAt: Date }): Message {
  if (message.role === "ASSISTANT") {
    return {
      role: "assistant",
      content: [{ type: "text", text: message.content }],
      api: "history",
      provider: "history",
      model: "history",
      usage: emptyUsage,
      stopReason: "stop",
      timestamp: message.createdAt.getTime(),
    };
  }
  return { role: "user", content: message.content, timestamp: message.createdAt.getTime() };
}

function completed(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return true;
  const status = (value as Record<string, unknown>).status;
  return typeof status !== "string" || status === "completed";
}

export async function loadKnowledgeConversation(userId: string, sessionId: string) {
  const session = await prisma.knowledgeChatSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new NotFoundError("知识问答会话不存在。");
  const messages = await prisma.knowledgeChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: 16,
  });
  return { session, messages: messages.reverse().filter((item) => completed(item.metadataJson)).map(toAgentMessage) };
}

function characters(message: AgentMessage) {
  if (message.role === "user") return typeof message.content === "string" ? message.content.length : 0;
  return message.content.reduce((total, item) => total + (item.type === "text" ? item.text.length : 0), 0);
}

export async function trimKnowledgeConversation(messages: AgentMessage[]) {
  const kept: AgentMessage[] = [];
  let size = 0;
  for (const message of [...messages].reverse()) {
    const next = characters(message);
    if (kept.length > 0 && size + next > 12_000) break;
    kept.push(message);
    size += next;
  }
  return kept.reverse();
}
