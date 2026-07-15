import { tutorRuntimeLimits } from "@/server/agent/tutor/runtime/runtime-limits";

export function toolText(value: unknown) {
  const text = JSON.stringify(value);
  return text.length > tutorRuntimeLimits.toolResultCharacters
    ? `${text.slice(0, tutorRuntimeLimits.toolResultCharacters)}…`
    : text;
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Tutor request was cancelled.", "AbortError");
  }
}
