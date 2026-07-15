export type TutorCommand =
  | { type: "knowledge"; query: string }
  | { type: "chat"; prompt: string };

export function parseTutorCommand(prompt: string): TutorCommand {
  const trimmed = prompt.trim();
  const match = /^\/knowledge(?:\s+([\s\S]*))?$/i.exec(trimmed);

  if (!match) {
    return { type: "chat", prompt: trimmed };
  }

  return { type: "knowledge", query: match[1]?.trim() ?? "" };
}
