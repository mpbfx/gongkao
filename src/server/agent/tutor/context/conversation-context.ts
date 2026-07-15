import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, Message } from "@mariozechner/pi-ai";

import { prisma } from "@/lib/db/prisma";
import { tutorRuntimeLimits } from "@/server/agent/tutor/runtime/runtime-limits";

const emptyUsage: AssistantMessage["usage"] = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

function metadataStatus(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const status = (value as Record<string, unknown>).status;
  return typeof status === "string" ? status : null;
}

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

export async function loadConversationMessages(userId: string, questionId: string, sessionId?: string) {
  const rows = await prisma.agentTutorMessage.findMany({
    where: { userId, questionId, ...(sessionId ? { sessionId } : {}) },
    orderBy: { createdAt: "desc" },
    take: tutorRuntimeLimits.historyMessages,
  });

  return rows
    .reverse()
    .filter((message) => !["failed", "cancelled", "pending"].includes(metadataStatus(message.metadataJson) ?? ""))
    .map(toAgentMessage);
}

function messageCharacters(message: AgentMessage) {
  if (message.role === "user") {
    return typeof message.content === "string"
      ? message.content.length
      : message.content.reduce((total, item) => total + (item.type === "text" ? item.text.length : 0), 0);
  }

  if (message.role === "assistant") {
    return message.content.reduce((total, item) => total + (item.type === "text" ? item.text.length : 0), 0);
  }

  return message.content.reduce((total, item) => total + (item.type === "text" ? item.text.length : 0), 0);
}

export async function trimConversationContext(messages: AgentMessage[]) {
  const kept: AgentMessage[] = [];
  let characters = 0;

  for (const message of [...messages].reverse()) {
    const size = messageCharacters(message);

    if (kept.length > 0 && characters + size > tutorRuntimeLimits.contextCharacters) {
      break;
    }

    kept.push(message);
    characters += size;
  }

  return kept.reverse();
}
