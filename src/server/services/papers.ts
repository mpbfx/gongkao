import { z } from "zod";

import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { MembershipRequiredError, NotFoundError } from "@/server/services/errors";
import { hasActiveMembership } from "@/server/services/membership";
import { assertPracticeQuestionsAccessible } from "@/server/services/practice-question-policy";
import {
  emptyStringToUndefined,
  getPagination,
  paginationQuerySchema,
} from "@/server/services/pagination";
import { decimalToString, toQuestionDto } from "@/server/services/questions";

export const paperListQuerySchema = paginationQuerySchema.extend({
  year: z.preprocess(emptyStringToUndefined, z.coerce.number().int().min(1900).max(2100).optional()),
  province: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(40).optional()),
  examType: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(40).optional()),
});

export type PaperListQuery = z.infer<typeof paperListQuerySchema>;

export function toPaperModel(
  paperQuestions: Array<{
    sortOrder: number;
    sectionName: string | null;
  }>
) {
  const sections = new Map<string, { name: string; snum: number; enum: number }>();

  for (const paperQuestion of paperQuestions.toSorted(
    (first, second) => first.sortOrder - second.sortOrder
  )) {
    const name = paperQuestion.sectionName ?? "综合";
    const current = sections.get(name);

    if (current) {
      current.snum = Math.min(current.snum, paperQuestion.sortOrder);
      current.enum = Math.max(current.enum, paperQuestion.sortOrder);
    } else {
      sections.set(name, {
        name,
        snum: paperQuestion.sortOrder,
        enum: paperQuestion.sortOrder,
      });
    }
  }

  return Array.from(sections.values());
}

export async function listPapers(query: PaperListQuery, userId?: string) {
  const where = {
    isActive: true,
    deletedAt: null,
    ...(query.year ? { year: query.year } : {}),
    ...(query.province ? { province: query.province } : {}),
    ...(query.examType ? { examType: query.examType } : {}),
  };

  const [items, total, years, provinces, examTypes] = await Promise.all([
    prisma.paper.findMany({
      where,
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        _count: {
          select: { questions: true },
        },
        sessions: userId
          ? {
              where: { userId, mode: "PAPER", status: "IN_PROGRESS" },
              orderBy: { updatedAt: "desc" },
              select: {
                id: true,
                purpose: true,
                timingMode: true,
                answeredCount: true,
                totalCount: true,
                elapsedSeconds: true,
                updatedAt: true,
              },
            }
          : false,
      },
    }),
    prisma.paper.count({ where }),
    prisma.paper.findMany({
      where: { isActive: true, deletedAt: null, year: { not: null } },
      distinct: ["year"],
      orderBy: { year: "desc" },
      select: { year: true },
    }),
    prisma.paper.findMany({
      where: { isActive: true, deletedAt: null, province: { not: null } },
      distinct: ["province"],
      orderBy: { province: "asc" },
      select: { province: true },
    }),
    prisma.paper.findMany({
      where: { isActive: true, deletedAt: null, examType: { not: null } },
      distinct: ["examType"],
      orderBy: { examType: "asc" },
      select: { examType: true },
    }),
  ]);

  return {
    items: items.map((paper) => ({
      id: paper.id,
      title: paper.title,
      year: paper.year,
      province: paper.province,
      examType: paper.examType,
      difficultyScore: decimalToString(paper.difficultyScore),
      durationSeconds: paper.durationSeconds,
      questionCount: paper._count.questions,
      isVipOnly: paper.isVipOnly,
      activeSessions: (paper.sessions ?? []).map((session) => ({
        ...session,
        updatedAt: session.updatedAt.toISOString(),
      })),
    })),
    pagination: getPagination(query.page, query.pageSize, total),
    filters: {
      years: years.map((item) => item.year).filter((year) => year !== null),
      provinces: provinces.map((item) => item.province).filter((province) => province !== null),
      examTypes: examTypes.map((item) => item.examType).filter((examType) => examType !== null),
    },
  };
}

export async function getPaperDetail(paperId: string, user: AuthenticatedUser) {
  const paper = await prisma.paper.findFirst({
    where: {
      id: paperId,
      isActive: true,
      deletedAt: null,
    },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          question: {
            include: {
              material: { select: { id: true, title: true, contentHtml: true } },
              tag: { select: { id: true, name: true } },
              options: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!paper) {
    throw new NotFoundError("试卷不存在");
  }

  if (paper.isVipOnly && !(await hasActiveMembership(user.id, user.role))) {
    throw new MembershipRequiredError("该试卷需要会员权限");
  }
  await assertPracticeQuestionsAccessible(
    user,
    paper.questions.map((paperQuestion) => paperQuestion.question)
  );

  return {
    id: paper.id,
    title: paper.title,
    year: paper.year,
    province: paper.province,
    examType: paper.examType,
    difficultyScore: decimalToString(paper.difficultyScore),
    durationSeconds: paper.durationSeconds,
    questionCount: paper.questions.length,
    isVipOnly: paper.isVipOnly,
    model: toPaperModel(paper.questions),
    questions: paper.questions.map((paperQuestion) => ({
      sortOrder: paperQuestion.sortOrder,
      sectionName: paperQuestion.sectionName,
      score: decimalToString(paperQuestion.score),
      ...toQuestionDto(paperQuestion.question, false),
    })),
  };
}
