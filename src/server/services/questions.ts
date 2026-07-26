import { sanitizeRichHtml } from "@/server/content/rich-html";

type QuestionRow = {
  id: string;
  type: string;
  titleHtml: string;
  analysisHtml?: string | null;
  difficulty: string;
  globalAccuracy?: unknown;
  source?: string | null;
  correctAnswer?: string;
  material?: {
    id: string;
    title?: string | null;
    contentHtml: string;
  } | null;
  tag?: {
    id: string;
    name: string;
  } | null;
  options: Array<{
    id: string;
    label: string;
    value: string;
    contentHtml: string;
    sortOrder: number;
  }>;
};

export type QuestionDto = ReturnType<typeof toQuestionDto>;

export function decimalToString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

export function normalizeAnswer(answer?: string | null) {
  if (!answer) {
    return "";
  }

  return Array.from(
    new Set(
      answer
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    )
  )
    .sort()
    .join(",");
}

/**
 * 读取侧的兜底消毒：写入侧已统一消毒，这里再走一次白名单，防御历史脏数据。
 * 单次约 0.03ms，整卷读取的额外开销可以忽略。
 */
export function normalizeRichHtml(html?: string | null) {
  if (!html) {
    return html ?? null;
  }

  return sanitizeRichHtml(html);
}

export function toQuestionDto(question: QuestionRow, includeAnswer = false) {
  return {
    id: question.id,
    type: question.type,
    titleHtml: normalizeRichHtml(question.titleHtml) ?? "",
    material: question.material
      ? {
          id: question.material.id,
          title: question.material.title,
          contentHtml: normalizeRichHtml(question.material.contentHtml) ?? "",
        }
      : null,
    materialHtml: normalizeRichHtml(question.material?.contentHtml),
    options: question.options
      .toSorted((first, second) => first.sortOrder - second.sortOrder)
      .map((option) => ({
        id: option.id,
        label: option.label,
        value: option.value,
        contentHtml: normalizeRichHtml(option.contentHtml) ?? "",
      })),
    difficulty: question.difficulty,
    globalAccuracy: decimalToString(question.globalAccuracy),
    source: question.source,
    tag: question.tag
      ? {
          id: question.tag.id,
          name: question.tag.name,
        }
      : null,
    ...(includeAnswer
      ? {
          correctAnswer: question.correctAnswer,
          analysisHtml: normalizeRichHtml(question.analysisHtml),
        }
      : {}),
  };
}
