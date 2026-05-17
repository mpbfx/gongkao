import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import type { MistakeCause } from "@/generated/prisma/enums";
import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { createQuestionMistakeReview } from "@/server/agent/mistakes/service";
import { generateStructuredResponseWithStatus } from "@/server/agent/shared/llm";
import { tutorModelOutputSchema, tutorResponseSchema, type TutorResponse } from "@/server/agent/shared/schemas";
import { stripHtml, truncateText } from "@/server/agent/shared/text";
import { BusinessError, NotFoundError } from "@/server/services/errors";

type TutorGraphInput = {
  user: AuthenticatedUser;
  questionId: string;
  sessionId?: string;
  prompt: string;
};

type TutorQuestionContext = {
  questionId: string;
  sessionId?: string;
  practiceAnswerId: string | null;
  title: string;
  material: string;
  options: Array<{ label: string; value: string; content: string }>;
  correctAnswer: string;
  analysis: string;
  userAnswer: string | null;
  tagId: string | null;
  tagName: string | null;
  difficulty: string;
  source: string | null;
  wrongCount: number;
  timeSpentSeconds: number | null;
  sessionAverageTimeSeconds: number | null;
  userAverageTimeSeconds: number | null;
  tagAverageTimeSeconds: number | null;
  hasOfficialAnalysis: boolean;
  hasImageContent: boolean;
};

type TutorGraphOutput = {
  data: Omit<TutorResponse, "messageId">;
  usedFallback: boolean;
};

const TutorState = Annotation.Root({
  input: Annotation<TutorGraphInput>(),
  context: Annotation<TutorQuestionContext | undefined>(),
  output: Annotation<TutorGraphOutput | undefined>(),
});

function hasImageHtml(...values: Array<string | null | undefined>) {
  return values.some((value) => /<img\b/i.test(value ?? ""));
}

async function loadTimeAverages(userId: string, tagId: string | null, sessionId?: string | null) {
  const [sessionAverage, userAverage, tagAverage] = await Promise.all([
    sessionId
      ? prisma.practiceAnswer.aggregate({
          where: { userId, sessionId, timeSpentSeconds: { gt: 0 } },
          _avg: { timeSpentSeconds: true },
        })
      : null,
    prisma.practiceAnswer.aggregate({
      where: { userId, timeSpentSeconds: { gt: 0 } },
      _avg: { timeSpentSeconds: true },
    }),
    tagId
      ? prisma.practiceAnswer.aggregate({
          where: {
            userId,
            timeSpentSeconds: { gt: 0 },
            question: { tagId },
          },
          _avg: { timeSpentSeconds: true },
        })
      : null,
  ]);

  return {
    sessionAverageTimeSeconds: sessionAverage?._avg.timeSpentSeconds ? Math.round(sessionAverage._avg.timeSpentSeconds) : null,
    userAverageTimeSeconds: userAverage._avg.timeSpentSeconds ? Math.round(userAverage._avg.timeSpentSeconds) : null,
    tagAverageTimeSeconds: tagAverage?._avg.timeSpentSeconds ? Math.round(tagAverage._avg.timeSpentSeconds) : null,
  };
}

async function loadTutorContext(input: TutorGraphInput) {
  if (input.sessionId) {
    const answer = await prisma.practiceAnswer.findFirst({
      where: {
        sessionId: input.sessionId,
        questionId: input.questionId,
        userId: input.user.id,
      },
      include: {
        session: { select: { id: true, status: true, mode: true } },
        question: {
          include: {
            material: { select: { contentHtml: true, plainText: true } },
            tag: { select: { id: true, name: true } },
            options: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    if (!answer) {
      throw new NotFoundError("题目不存在或无权限");
    }

    if (answer.session.status !== "SUBMITTED" && answer.session.mode !== "MEMORIZE") {
      throw new BusinessError("未提交练习不开放讲题助教");
    }

    const wrongQuestion = await prisma.wrongQuestion.findUnique({
      where: {
        userId_questionId: {
          userId: input.user.id,
          questionId: input.questionId,
        },
      },
      select: { wrongCount: true },
    });
    const tagId = answer.question.tag?.id ?? answer.question.tagId ?? null;
    const timeAverages = await loadTimeAverages(input.user.id, tagId, answer.sessionId);

    return {
      questionId: answer.questionId,
      sessionId: answer.sessionId,
      practiceAnswerId: answer.id,
      title: truncateText(stripHtml(answer.question.titleHtml)),
      material: truncateText(stripHtml(answer.question.material?.plainText ?? answer.question.material?.contentHtml)),
      options: answer.question.options.map((option) => ({
        label: option.label,
        value: option.value,
        content: stripHtml(option.plainText ?? option.contentHtml),
      })),
      correctAnswer: answer.question.correctAnswer,
      analysis: truncateText(stripHtml(answer.question.analysisHtml)),
      userAnswer: answer.answer,
      tagId,
      tagName: answer.question.tag?.name ?? null,
      difficulty: answer.question.difficulty,
      source: answer.question.source,
      wrongCount: wrongQuestion?.wrongCount ?? 0,
      timeSpentSeconds: answer.timeSpentSeconds,
      hasOfficialAnalysis: Boolean(stripHtml(answer.question.analysisHtml)),
      hasImageContent: hasImageHtml(answer.question.titleHtml, answer.question.material?.contentHtml, answer.question.analysisHtml),
      ...timeAverages,
    } satisfies TutorQuestionContext;
  }

  const wrongQuestion = await prisma.wrongQuestion.findUnique({
    where: {
      userId_questionId: {
        userId: input.user.id,
        questionId: input.questionId,
      },
    },
    include: {
      question: {
        include: {
          material: { select: { contentHtml: true, plainText: true } },
          tag: { select: { id: true, name: true } },
          options: { orderBy: { sortOrder: "asc" } },
        },
      },
      lastAnswer: { select: { id: true, sessionId: true, answer: true, timeSpentSeconds: true } },
    },
  });

  if (!wrongQuestion) {
    throw new NotFoundError("错题不存在或无权限");
  }

  const tagId = wrongQuestion.question.tag?.id ?? wrongQuestion.question.tagId ?? wrongQuestion.tagId ?? null;
  const timeAverages = await loadTimeAverages(input.user.id, tagId, wrongQuestion.lastAnswer?.sessionId);

  return {
    questionId: wrongQuestion.questionId,
    sessionId: wrongQuestion.lastAnswer?.sessionId,
    practiceAnswerId: wrongQuestion.lastAnswer?.id ?? null,
    title: truncateText(stripHtml(wrongQuestion.question.titleHtml)),
    material: truncateText(stripHtml(wrongQuestion.question.material?.plainText ?? wrongQuestion.question.material?.contentHtml)),
    options: wrongQuestion.question.options.map((option) => ({
      label: option.label,
      value: option.value,
      content: stripHtml(option.plainText ?? option.contentHtml),
    })),
    correctAnswer: wrongQuestion.question.correctAnswer,
    analysis: truncateText(stripHtml(wrongQuestion.question.analysisHtml)),
    userAnswer: wrongQuestion.lastAnswer?.answer ?? null,
    tagId,
    tagName: wrongQuestion.question.tag?.name ?? null,
    difficulty: wrongQuestion.question.difficulty,
    source: wrongQuestion.question.source,
    wrongCount: wrongQuestion.wrongCount,
    timeSpentSeconds: wrongQuestion.lastAnswer?.timeSpentSeconds ?? null,
    hasOfficialAnalysis: Boolean(stripHtml(wrongQuestion.question.analysisHtml)),
    hasImageContent: hasImageHtml(
      wrongQuestion.question.titleHtml,
      wrongQuestion.question.material?.contentHtml,
      wrongQuestion.question.analysisHtml
    ),
    ...timeAverages,
  } satisfies TutorQuestionContext;
}

function fallbackTutorOutput(context: TutorQuestionContext, prompt: string) {
  const warning = [
    context.hasOfficialAnalysis ? "" : "当前题缺少官方解析，我会基于题干和选项辅助分析。",
    context.hasImageContent ? "题目包含图片内容，若图片缺少可读文本，讲解可能不完整。" : "",
  ]
    .filter(Boolean)
    .join("\n");
  const answer = [
    warning,
    "## 本题错因",
    "信息不足，暂不强判。",
    "## 最快路径",
    context.analysis || "先抓题干限定条件，再逐项排除与限定条件不符的选项。",
    "## 下次识别规则",
    "同类题先确认问法、限定条件和选项差异，再回到材料或题干验证。",
    `## 追问回应\n${prompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    mistakeCause: "UNKNOWN" as const,
    confidence: "LOW" as const,
    causeSummary: "模型暂时不可用，无法稳定判断本题错因。",
    fastestPath: context.analysis || "先抓题干限定条件，再逐项排除与限定条件不符的选项。",
    transferRule: "同类题先确认问法、限定条件和选项差异，再回到材料或题干验证。",
    answer,
    suggestedPrompts: ["为什么不选我选的这个？", "有没有更快的做法？", "这题考哪个知识点？"],
  };
}

function buildTutorInstructions() {
  return [
    "你是公考行测讲题助教。只围绕给定题目、官方答案、用户答案、官方解析和真实作答用时回答。",
    "你必须输出三段式错题复盘：错因判断、最快路径、迁移规则。",
    "mistakeCause 必须从枚举中选择一个；不要修改标准答案，不要输出无关聊天，不要泄露模型推理过程。",
    "TIME_STRATEGY_ERROR 只有在 timeSpentSeconds 存在，且明显高于本场/个人/知识点平均，并且存在更快路径时才能选择；没有可靠时间数据时禁止选择。",
    "confidence 为 LOW 时，causeSummary 必须表达为可能原因，不要强判。",
    "answer 用 Markdown 输出，先展示本题错因、最快路径、下次识别规则，再补充必要讲解。",
  ].join("\n");
}

function buildTutorInput(context: TutorQuestionContext, prompt: string) {
  return JSON.stringify({
    question: context,
    userPrompt: prompt,
    mistakeCauseRubric: {
      READING_MISS: "审题漏条件、问法看反或关键词没抓住。",
      CONCEPT_GAP: "知识点本身不会或记错。",
      METHOD_GAP: "知道知识点，但不会这类题的标准解法或题型方法。",
      OPTION_TRAP: "被干扰项吸引，排除选项时没识别陷阱。",
      CALCULATION_ERROR: "计算、换算或数值比较错误。",
      MATERIAL_LOCATION_ERROR: "资料分析或材料题定位错段落、错数据、漏比较对象。",
      LOGIC_CHAIN_BREAK: "推理链断裂，前提、结论、因果或充分必要关系处理错。",
      TIME_STRATEGY_ERROR: "时间策略问题：该跳没跳、方法太慢、先后顺序不合理。",
      CARELESSNESS: "非知识性失误：抄错、看错数字、选项点错、漏看不/最/不能。",
      UNKNOWN: "信息不足，不能强判。",
    },
    requiredSections: ["本题错因", "最快路径", "下次识别规则", "完整讲解"],
  });
}

async function generateTutorOutput(context: TutorQuestionContext, prompt: string) {
  const fallback = fallbackTutorOutput(context, prompt);
  const result = await generateStructuredResponseWithStatus({
    schema: tutorModelOutputSchema,
    name: "question_tutor_response",
    instructions: buildTutorInstructions(),
    input: buildTutorInput(context, prompt),
    fallback,
  });

  if (result.data.mistakeCause === "TIME_STRATEGY_ERROR" && !context.timeSpentSeconds) {
    return {
      data: {
        ...result.data,
        mistakeCause: "UNKNOWN" as const,
        confidence: "LOW" as const,
        causeSummary: "本题缺少可靠作答用时，不能强判为时间策略问题。",
      },
      usedFallback: result.usedFallback,
    };
  }

  return result;
}

async function runTutorGraph(input: TutorGraphInput) {
  const graph = new StateGraph(TutorState)
    .addNode("load_context", async (state) => ({
      context: await loadTutorContext(state.input),
    }))
    .addNode("answer", async (state) => {
      if (!state.context) {
        throw new Error("Tutor context was not loaded.");
      }

      return {
        output: await generateTutorOutput(state.context, state.input.prompt),
      };
    })
    .addEdge(START, "load_context")
    .addEdge("load_context", "answer")
    .addEdge("answer", END)
    .compile();
  const result = await graph.invoke({ input });

  if (!result.context || !result.output) {
    throw new Error("Tutor graph did not produce an answer.");
  }

  return {
    context: result.context,
    output: result.output,
  };
}

function shouldCreateMistakeReview(output: Omit<TutorResponse, "messageId">, usedFallback: boolean) {
  if (usedFallback) {
    return false;
  }

  return Boolean(output.causeSummary.trim() && output.fastestPath.trim() && output.transferRule.trim());
}

async function persistTutorResult({
  input,
  context,
  output,
  userMessageId,
}: {
  input: TutorGraphInput;
  context: TutorQuestionContext;
  output: TutorGraphOutput;
  userMessageId: string;
}) {
  const assistantMessage = await prisma.agentTutorMessage.create({
    data: {
      userId: input.user.id,
      questionId: input.questionId,
      sessionId: context.sessionId ?? input.sessionId,
      role: "ASSISTANT",
      content: output.data.answer,
      metadataJson: {
        mistakeCause: output.data.mistakeCause,
        confidence: output.data.confidence,
        causeSummary: output.data.causeSummary,
        fastestPath: output.data.fastestPath,
        transferRule: output.data.transferRule,
        suggestedPrompts: output.data.suggestedPrompts,
        userMessageId,
        hasOfficialAnalysis: context.hasOfficialAnalysis,
        hasImageContent: context.hasImageContent,
        usedFallback: output.usedFallback,
      },
    },
  });

  if (shouldCreateMistakeReview(output.data, output.usedFallback)) {
    await createQuestionMistakeReview({
      userId: input.user.id,
      questionId: input.questionId,
      sessionId: context.sessionId ?? input.sessionId,
      practiceAnswerId: context.practiceAnswerId,
      tutorMessageId: assistantMessage.id,
      tagId: context.tagId,
      mistakeCause: output.data.mistakeCause as MistakeCause,
      confidence: output.data.confidence,
      causeSummary: output.data.causeSummary,
      fastestPath: output.data.fastestPath,
      transferRule: output.data.transferRule,
      timeSpentSeconds: context.timeSpentSeconds,
    });
  }

  return assistantMessage;
}

export async function explainQuestionWithTutor(input: TutorGraphInput) {
  const userMessage = await prisma.agentTutorMessage.create({
    data: {
      userId: input.user.id,
      questionId: input.questionId,
      sessionId: input.sessionId,
      role: "USER",
      content: input.prompt,
    },
  });
  const result = await runTutorGraph(input);
  const assistantMessage = await persistTutorResult({
    input,
    context: result.context,
    output: result.output,
    userMessageId: userMessage.id,
  });

  return tutorResponseSchema.parse({
    ...result.output.data,
    messageId: assistantMessage.id,
  });
}

export type TutorStreamEvent =
  | { type: "token"; content: string }
  | { type: "done"; messageId: string; suggestedPrompts: string[] }
  | { type: "review"; mistakeCause: string; confidence: string; causeSummary: string; fastestPath: string; transferRule: string };

export async function* streamQuestionWithTutor(input: TutorGraphInput): AsyncGenerator<TutorStreamEvent> {
  const userMessage = await prisma.agentTutorMessage.create({
    data: {
      userId: input.user.id,
      questionId: input.questionId,
      sessionId: input.sessionId,
      role: "USER",
      content: input.prompt,
    },
  });
  const result = await runTutorGraph(input);

  yield {
    type: "review",
    mistakeCause: result.output.data.mistakeCause,
    confidence: result.output.data.confidence,
    causeSummary: result.output.data.causeSummary,
    fastestPath: result.output.data.fastestPath,
    transferRule: result.output.data.transferRule,
  };

  for (const chunk of result.output.data.answer.split(/(\n\n+)/)) {
    if (chunk) {
      yield { type: "token", content: chunk };
    }
  }

  const assistantMessage = await persistTutorResult({
    input,
    context: result.context,
    output: result.output,
    userMessageId: userMessage.id,
  });

  yield {
    type: "done",
    messageId: assistantMessage.id,
    suggestedPrompts: result.output.data.suggestedPrompts,
  };
}

const autoReviewPrompt = "请根据本题题干、选项、正确答案、我的答案、官方解析和作答用时，自动判断这道错题的主要错因，并给出最快路径和下次识别规则。";

export async function autoAnalyzeSubmittedSessionMistakes(
  user: AuthenticatedUser,
  sessionId: string,
  {
    maxQuestions,
  }: {
    maxQuestions: number;
  }
) {
  const session = await prisma.practiceSession.findFirst({
    where: {
      id: sessionId,
      userId: user.id,
      status: "SUBMITTED",
    },
    select: { id: true },
  });

  if (!session) {
    return { analyzed: 0, skipped: 0, failed: 0 };
  }

  const wrongAnswers = await prisma.practiceAnswer.findMany({
    where: {
      sessionId,
      userId: user.id,
      isCorrect: false,
      answer: { not: null },
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      questionId: true,
    },
  });
  const existingReviews =
    wrongAnswers.length > 0
      ? await prisma.questionMistakeReview.findMany({
          where: {
            practiceAnswerId: { in: wrongAnswers.map((answer) => answer.id) },
          },
          select: { practiceAnswerId: true },
        })
      : [];
  const reviewedAnswerIds = new Set(existingReviews.map((review) => review.practiceAnswerId).filter(Boolean));
  const candidates = wrongAnswers
    .filter((answer) => !reviewedAnswerIds.has(answer.id))
    .slice(0, Math.max(0, maxQuestions));
  let analyzed = 0;
  let failed = 0;

  for (const answer of candidates) {
    try {
      const result = await runTutorGraph({
        user,
        sessionId,
        questionId: answer.questionId,
        prompt: autoReviewPrompt,
      });

      if (!shouldCreateMistakeReview(result.output.data, result.output.usedFallback)) {
        failed += 1;
        continue;
      }

      await createQuestionMistakeReview({
        userId: user.id,
        questionId: answer.questionId,
        sessionId: result.context.sessionId ?? sessionId,
        practiceAnswerId: result.context.practiceAnswerId,
        tagId: result.context.tagId,
        mistakeCause: result.output.data.mistakeCause as MistakeCause,
        confidence: result.output.data.confidence,
        causeSummary: result.output.data.causeSummary,
        fastestPath: result.output.data.fastestPath,
        transferRule: result.output.data.transferRule,
        timeSpentSeconds: result.context.timeSpentSeconds,
      });
      analyzed += 1;
    } catch (error) {
      failed += 1;
      console.error("Auto mistake review failed", {
        sessionId,
        questionId: answer.questionId,
        error,
      });
    }
  }

  return {
    analyzed,
    skipped: wrongAnswers.length - candidates.length,
    failed,
  };
}
