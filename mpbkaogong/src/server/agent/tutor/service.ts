import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { generateStructuredResponse } from "@/server/agent/shared/llm";
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
  title: string;
  material: string;
  options: Array<{ label: string; value: string; content: string }>;
  correctAnswer: string;
  analysis: string;
  userAnswer: string | null;
  tagName: string | null;
  difficulty: string;
  source: string | null;
  wrongCount: number;
  hasOfficialAnalysis: boolean;
  hasImageContent: boolean;
};

const TutorState = Annotation.Root({
  input: Annotation<TutorGraphInput>(),
  context: Annotation<TutorQuestionContext | undefined>(),
  output: Annotation<Omit<TutorResponse, "messageId"> | undefined>(),
});

function hasImageHtml(...values: Array<string | null | undefined>) {
  return values.some((value) => /<img\b/i.test(value ?? ""));
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
            tag: { select: { name: true } },
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

    return {
      questionId: answer.questionId,
      sessionId: answer.sessionId,
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
      tagName: answer.question.tag?.name ?? null,
      difficulty: answer.question.difficulty,
      source: answer.question.source,
      wrongCount: wrongQuestion?.wrongCount ?? 0,
      hasOfficialAnalysis: Boolean(stripHtml(answer.question.analysisHtml)),
      hasImageContent: hasImageHtml(answer.question.titleHtml, answer.question.material?.contentHtml, answer.question.analysisHtml),
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
          tag: { select: { name: true } },
          options: { orderBy: { sortOrder: "asc" } },
        },
      },
      lastAnswer: { select: { answer: true } },
    },
  });

  if (!wrongQuestion) {
    throw new NotFoundError("错题不存在或无权限");
  }

  return {
    questionId: wrongQuestion.questionId,
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
    tagName: wrongQuestion.question.tag?.name ?? null,
    difficulty: wrongQuestion.question.difficulty,
    source: wrongQuestion.question.source,
    wrongCount: wrongQuestion.wrongCount,
    hasOfficialAnalysis: Boolean(stripHtml(wrongQuestion.question.analysisHtml)),
    hasImageContent: hasImageHtml(
      wrongQuestion.question.titleHtml,
      wrongQuestion.question.material?.contentHtml,
      wrongQuestion.question.analysisHtml
    ),
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
    `正确答案：${context.correctAnswer || "暂无"}`,
    context.userAnswer ? `你的答案：${context.userAnswer}` : "你的答案：未作答或未记录",
    context.analysis ? `官方解析要点：${context.analysis}` : "",
    `追问重点：${prompt}`,
    "下次遇到同类题，先确认题干问法、限定条件和选项差异，再回到材料或题干验证。",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    answer,
    suggestedPrompts: ["为什么不选我选的这个？", "有没有更快的做法？", "这题考哪个知识点？"],
  };
}

async function generateTutorOutput(context: TutorQuestionContext, prompt: string) {
  const fallback = fallbackTutorOutput(context, prompt);

  return generateStructuredResponse({
    schema: tutorModelOutputSchema,
    name: "question_tutor_response",
    instructions:
      "你是公考行测讲题助教。只围绕给定题目、官方答案、用户答案和官方解析回答。不要修改标准答案，不要输出无关聊天，不要泄露模型推理过程。",
    input: JSON.stringify({
      question: context,
      userPrompt: prompt,
      requiredSections: ["结论", "关键思路", "错因分析", "易错点", "迁移提示"],
    }),
    fallback,
  });
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
  const assistantMessage = await prisma.agentTutorMessage.create({
    data: {
      userId: input.user.id,
      questionId: input.questionId,
      sessionId: input.sessionId,
      role: "ASSISTANT",
      content: result.output.answer,
      metadataJson: {
        suggestedPrompts: result.output.suggestedPrompts,
        userMessageId: userMessage.id,
        hasOfficialAnalysis: result.context.hasOfficialAnalysis,
        hasImageContent: result.context.hasImageContent,
      },
    },
  });

  return tutorResponseSchema.parse({
    ...result.output,
    messageId: assistantMessage.id,
  });
}
