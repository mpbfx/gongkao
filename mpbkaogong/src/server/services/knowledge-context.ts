import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { stripHtml, truncateText } from "@/server/agent/shared/text";

export async function buildQuestionKnowledgePrompt(user: AuthenticatedUser, questionId?: string) {
  if (!questionId) return undefined;
  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      OR: [
        { wrongQuestions: { some: { userId: user.id } } },
        { practiceAnswers: { some: { userId: user.id } } },
      ],
    },
    include: {
      tag: { select: { name: true, path: true } },
      options: { orderBy: { sortOrder: "asc" }, select: { label: true, contentHtml: true } },
      wrongQuestions: {
        where: { userId: user.id },
        take: 1,
        select: { lastAnswer: { select: { answer: true } } },
      },
      mistakeReviews: {
        where: { userId: user.id, isLatestForQuestion: true },
        take: 1,
        select: { causeSummary: true },
      },
    },
  });
  if (!question) return undefined;
  const options = question.options
    .map((option) => `${option.label}. ${stripHtml(option.contentHtml)}`)
    .join("；");
  return truncateText(
    [
      `请结合课程资料讲解这道题对应的知识点和标准方法。`,
      `题型：${question.tag?.path ?? question.tag?.name ?? "未分类"}`,
      `题目：${stripHtml(question.titleHtml)}`,
      `选项：${options}`,
      `我的答案：${question.wrongQuestions[0]?.lastAnswer?.answer ?? "未记录"}`,
      question.mistakeReviews[0]?.causeSummary ? `已有错因：${question.mistakeReviews[0].causeSummary}` : "",
    ].filter(Boolean).join("\n"),
    6000
  );
}
