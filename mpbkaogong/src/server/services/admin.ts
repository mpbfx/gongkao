import { z } from "zod";

import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { BadRequestError, NotFoundError } from "@/server/services/errors";
import {
  emptyStringToUndefined,
  getPagination,
  paginationQuerySchema,
} from "@/server/services/pagination";
import { decimalToString, normalizeAnswer } from "@/server/services/questions";

const questionTypeSchema = z.enum(["SINGLE", "MULTIPLE", "JUDGE"]);
const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD", "UNKNOWN"]);

const optionSchema = z.object({
  label: z.string().trim().min(1).max(12),
  value: z.string().trim().min(1).max(20),
  contentHtml: z.string().trim().min(1),
});

const questionInputSchema = z.object({
  type: questionTypeSchema,
  titleHtml: z.string().trim().min(1, "题干不能为空"),
  analysisHtml: z.string().trim().optional(),
  correctAnswer: z.string().trim().min(1, "正确答案不能为空"),
  difficulty: difficultySchema.default("UNKNOWN"),
  tagId: z.string().trim().optional(),
  source: z.string().trim().optional(),
  isVipOnly: z.boolean().default(false),
  isActive: z.boolean().default(true),
  options: z.array(optionSchema).min(2, "至少需要 2 个选项"),
});

const paperQuestionInputSchema = z.object({
  questionId: z.string().trim().min(1),
  sectionName: z.string().trim().optional(),
  score: z.coerce.number().positive().optional(),
});

const paperInputSchema = z.object({
  title: z.string().trim().min(1, "试卷标题不能为空"),
  slug: z.string().trim().optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  province: z.string().trim().optional(),
  examType: z.string().trim().optional(),
  difficultyScore: z.coerce.number().min(0).max(9.9).optional(),
  durationSeconds: z.coerce.number().int().min(600).max(18_000).optional(),
  isVipOnly: z.boolean().default(false),
  isActive: z.boolean().default(true),
  questions: z.array(paperQuestionInputSchema).min(1, "试卷至少需要 1 道题"),
});

export const adminListQuerySchema = paginationQuerySchema.extend({
  keyword: z.preprocess(emptyStringToUndefined, z.string().trim().optional()),
});

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

function nullable(value?: string) {
  return value && value.length > 0 ? value : null;
}

function checkbox(formData: FormData, name: string) {
  return formData.getAll(name).some((value) => value === "on" || value === "true");
}

function stripTags(html: string) {
  return html.replace(/<[^>]*>/g, "").trim();
}

function sanitizeHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function toHtml(value: string) {
  const sanitized = sanitizeHtml(value.trim());

  if (/<[a-z][\s\S]*>/i.test(sanitized)) {
    return sanitized;
  }

  return `<p>${sanitized}</p>`;
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `paper-${Date.now()}`;
}

function parseOptions(formData: FormData) {
  const labels = ["A", "B", "C", "D", "E", "F"];

  return labels
    .map((label, index) => ({
      label,
      value: String(formData.get(`optionValue${label}`) ?? label).trim(),
      contentHtml: String(formData.get(`optionContent${label}`) ?? "").trim(),
      sortOrder: index + 1,
    }))
    .filter((option) => option.contentHtml.length > 0);
}

export function questionInputFromFormData(formData: FormData) {
  const parsed = questionInputSchema.parse({
    type: formData.get("type"),
    titleHtml: toHtml(String(formData.get("titleHtml") ?? "")),
    analysisHtml: nullable(String(formData.get("analysisHtml") ?? "")),
    correctAnswer: normalizeAnswer(String(formData.get("correctAnswer") ?? "")),
    difficulty: formData.get("difficulty") || "UNKNOWN",
    tagId: nullable(String(formData.get("tagId") ?? "")),
    source: nullable(String(formData.get("source") ?? "")),
    isVipOnly: checkbox(formData, "isVipOnly"),
    isActive: checkbox(formData, "isActive"),
    options: parseOptions(formData).map((option) => ({
      ...option,
      contentHtml: toHtml(option.contentHtml),
    })),
  });
  const optionValues = new Set(parsed.options.map((option) => option.value));

  for (const answer of parsed.correctAnswer.split(",").filter(Boolean)) {
    if (!optionValues.has(answer)) {
      throw new BadRequestError(`正确答案 ${answer} 不在选项中`);
    }
  }

  return parsed;
}

function parsePaperQuestionText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [questionId, sectionName, score] = line.split("|").map((part) => part.trim());

      return {
        questionId,
        sectionName: nullable(sectionName),
        score: score ? Number(score) : undefined,
      };
    });
}

export function paperInputFromFormData(formData: FormData) {
  return paperInputSchema.parse({
    title: formData.get("title"),
    slug: nullable(String(formData.get("slug") ?? "")),
    year: nullable(String(formData.get("year") ?? "")) ?? undefined,
    province: nullable(String(formData.get("province") ?? "")),
    examType: nullable(String(formData.get("examType") ?? "")),
    difficultyScore: nullable(String(formData.get("difficultyScore") ?? "")) ?? undefined,
    durationSeconds: nullable(String(formData.get("durationMinutes") ?? ""))
      ? Number(formData.get("durationMinutes")) * 60
      : undefined,
    isVipOnly: checkbox(formData, "isVipOnly"),
    isActive: checkbox(formData, "isActive"),
    questions: parsePaperQuestionText(String(formData.get("questionsText") ?? "")),
  });
}

async function assertQuestionIds(questionIds: string[]) {
  const uniqueIds = Array.from(new Set(questionIds));

  if (uniqueIds.length !== questionIds.length) {
    throw new BadRequestError("试卷题目不能重复");
  }

  const existing = await prisma.question.findMany({
    where: {
      id: { in: uniqueIds },
      deletedAt: null,
    },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((question) => question.id));
  const missingId = uniqueIds.find((id) => !existingIds.has(id));

  if (missingId) {
    throw new BadRequestError(`题目不存在：${missingId}`);
  }
}

export async function adminOverview() {
  const [questionCount, paperCount, importJobCount, activeTagCount] = await Promise.all([
    prisma.question.count({ where: { deletedAt: null } }),
    prisma.paper.count({ where: { deletedAt: null } }),
    prisma.importJob.count(),
    prisma.questionTag.count({ where: { isActive: true } }),
  ]);

  return { questionCount, paperCount, importJobCount, activeTagCount };
}

export async function listAdminQuestions(query: AdminListQuery) {
  const where = {
    deletedAt: null,
    ...(query.keyword
      ? {
          OR: [
            { plainText: { contains: query.keyword } },
            { source: { contains: query.keyword } },
            { id: query.keyword },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        tag: { select: { id: true, name: true } },
        options: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.question.count({ where }),
  ]);

  return {
    items: items.map((question) => ({
      id: question.id,
      type: question.type,
      title: stripTags(question.titleHtml),
      correctAnswer: question.correctAnswer,
      difficulty: question.difficulty,
      tagName: question.tag?.name ?? "未分类",
      isActive: question.isActive,
      isVipOnly: question.isVipOnly,
      optionCount: question.options.length,
      createdAt: question.createdAt.toISOString(),
    })),
    pagination: getPagination(query.page, query.pageSize, total),
  };
}

export async function getAdminQuestion(questionId: string) {
  const question = await prisma.question.findFirst({
    where: { id: questionId, deletedAt: null },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
      tag: { select: { id: true, name: true } },
    },
  });

  if (!question) {
    throw new NotFoundError("题目不存在");
  }

  return {
    ...question,
    globalAccuracy: decimalToString(question.globalAccuracy),
  };
}

export async function createAdminQuestion(input: ReturnType<typeof questionInputFromFormData>) {
  return prisma.question.create({
    data: {
      type: input.type,
      titleHtml: input.titleHtml,
      plainText: stripTags(input.titleHtml),
      analysisHtml: input.analysisHtml ? toHtml(input.analysisHtml) : null,
      correctAnswer: input.correctAnswer,
      difficulty: input.difficulty,
      tagId: input.tagId,
      source: input.source,
      isVipOnly: input.isVipOnly,
      isActive: input.isActive,
      options: {
        create: input.options.map((option, index) => ({
          label: option.label,
          value: option.value,
          contentHtml: option.contentHtml,
          plainText: stripTags(option.contentHtml),
          sortOrder: index + 1,
        })),
      },
    },
    select: { id: true },
  });
}

export async function updateAdminQuestion(
  questionId: string,
  input: ReturnType<typeof questionInputFromFormData>
) {
  await getAdminQuestion(questionId);

  return prisma.$transaction(async (tx) => {
    await tx.questionOption.deleteMany({ where: { questionId } });

    return tx.question.update({
      where: { id: questionId },
      data: {
        type: input.type,
        titleHtml: input.titleHtml,
        plainText: stripTags(input.titleHtml),
        analysisHtml: input.analysisHtml ? toHtml(input.analysisHtml) : null,
        correctAnswer: input.correctAnswer,
        difficulty: input.difficulty,
        tagId: input.tagId,
        source: input.source,
        isVipOnly: input.isVipOnly,
        isActive: input.isActive,
        options: {
          create: input.options.map((option, index) => ({
            label: option.label,
            value: option.value,
            contentHtml: option.contentHtml,
            plainText: stripTags(option.contentHtml),
            sortOrder: index + 1,
          })),
        },
      },
      select: { id: true },
    });
  });
}

export async function softDeleteAdminQuestion(questionId: string) {
  await getAdminQuestion(questionId);

  return prisma.question.update({
    where: { id: questionId },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
    select: { id: true },
  });
}

export async function listAdminPapers(query: AdminListQuery) {
  const where = {
    deletedAt: null,
    ...(query.keyword
      ? {
          OR: [
            { title: { contains: query.keyword } },
            { province: { contains: query.keyword } },
            { examType: { contains: query.keyword } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.paper.findMany({
      where,
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { _count: { select: { questions: true } } },
    }),
    prisma.paper.count({ where }),
  ]);

  return {
    items: items.map((paper) => ({
      id: paper.id,
      title: paper.title,
      slug: paper.slug,
      year: paper.year,
      province: paper.province,
      examType: paper.examType,
      questionCount: paper._count.questions,
      isActive: paper.isActive,
      isVipOnly: paper.isVipOnly,
      createdAt: paper.createdAt.toISOString(),
    })),
    pagination: getPagination(query.page, query.pageSize, total),
  };
}

export async function getAdminPaper(paperId: string) {
  const paper = await prisma.paper.findFirst({
    where: { id: paperId, deletedAt: null },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: { question: { select: { id: true, plainText: true, titleHtml: true } } },
      },
    },
  });

  if (!paper) {
    throw new NotFoundError("试卷不存在");
  }

  return {
    ...paper,
    difficultyScore: decimalToString(paper.difficultyScore),
    questionsText: paper.questions
      .map((item) =>
        [item.questionId, item.sectionName ?? "", decimalToString(item.score) ?? ""].join(" | ")
      )
      .join("\n"),
  };
}

async function paperQuestionCreates(questions: z.infer<typeof paperQuestionInputSchema>[]) {
  await assertQuestionIds(questions.map((question) => question.questionId));

  return questions.map((question, index) => ({
    questionId: question.questionId,
    sortOrder: index + 1,
    sectionName: question.sectionName,
    score: question.score,
  }));
}

export async function createAdminPaper(input: ReturnType<typeof paperInputFromFormData>) {
  const questions = await paperQuestionCreates(input.questions);

  return prisma.paper.create({
    data: {
      title: input.title,
      slug: input.slug || `${slugify(input.title)}-${Date.now()}`,
      year: input.year,
      province: input.province,
      examType: input.examType,
      difficultyScore: input.difficultyScore,
      durationSeconds: input.durationSeconds,
      isVipOnly: input.isVipOnly,
      isActive: input.isActive,
      questions: {
        create: questions,
      },
    },
    select: { id: true },
  });
}

export async function updateAdminPaper(
  paperId: string,
  input: ReturnType<typeof paperInputFromFormData>
) {
  await getAdminPaper(paperId);
  const questions = await paperQuestionCreates(input.questions);

  return prisma.$transaction(async (tx) => {
    await tx.paperQuestion.deleteMany({ where: { paperId } });

    return tx.paper.update({
      where: { id: paperId },
      data: {
        title: input.title,
        slug: input.slug || `${slugify(input.title)}-${Date.now()}`,
        year: input.year,
        province: input.province,
        examType: input.examType,
        difficultyScore: input.difficultyScore,
        durationSeconds: input.durationSeconds,
        isVipOnly: input.isVipOnly,
        isActive: input.isActive,
        questions: {
          create: questions,
        },
      },
      select: { id: true },
    });
  });
}

export async function listAdminImportJobs() {
  return prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      filename: true,
      status: true,
      totalRows: true,
      successRows: true,
      failedRows: true,
      errorJson: true,
      createdAt: true,
    },
  });
}

type ImportQuestionRow = {
  type: "SINGLE" | "MULTIPLE" | "JUDGE";
  titleHtml: string;
  correctAnswer: string;
  analysisHtml?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "UNKNOWN";
  tagId?: string;
  source?: string;
  options: Array<{ label: string; value: string; contentHtml: string }>;
};

const importQuestionSchema: z.ZodType<ImportQuestionRow> = questionInputSchema.extend({
  options: z.array(optionSchema).min(2),
});

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsvQuestions(text: string) {
  const [headerLine, ...lines] = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = splitCsvLine(headerLine ?? "");

  return lines.map((line) => {
    const cells = splitCsvLine(line);
    const valueByHeader = new Map(headers.map((header, index) => [header, cells[index] ?? ""]));
    const options = ["A", "B", "C", "D", "E", "F"]
      .map((label) => ({
        label,
        value: label,
        contentHtml: valueByHeader.get(`option${label}`) ?? "",
      }))
      .filter((option) => option.contentHtml.length > 0);

    return {
      type: valueByHeader.get("type"),
      titleHtml: valueByHeader.get("titleHtml") ?? valueByHeader.get("title") ?? "",
      correctAnswer: valueByHeader.get("correctAnswer") ?? "",
      analysisHtml: valueByHeader.get("analysisHtml") ?? valueByHeader.get("analysis"),
      difficulty: valueByHeader.get("difficulty") || "UNKNOWN",
      tagId: valueByHeader.get("tagId") || undefined,
      source: valueByHeader.get("source") || undefined,
      options,
    };
  });
}

function parseImportRows(text: string, filename: string) {
  if (filename.toLowerCase().endsWith(".csv")) {
    return parseCsvQuestions(text);
  }

  const parsed = JSON.parse(text) as unknown;
  return Array.isArray(parsed) ? parsed : [parsed];
}

export async function importQuestionsFromFile(user: AuthenticatedUser, file: File) {
  const text = await file.text();
  const rawRows = parseImportRows(text, file.name);
  const job = await prisma.importJob.create({
    data: {
      userId: user.id,
      type: "questions",
      filename: file.name,
      status: "RUNNING",
      totalRows: rawRows.length,
    },
    select: { id: true },
  });
  const errors: Array<{ row: number; message: string }> = [];
  let successRows = 0;

  for (const [index, row] of rawRows.entries()) {
    try {
      const parsed = importQuestionSchema.parse(row);
      await createAdminQuestion({
        ...parsed,
        titleHtml: toHtml(parsed.titleHtml),
        analysisHtml: parsed.analysisHtml ? toHtml(parsed.analysisHtml) : undefined,
        correctAnswer: normalizeAnswer(parsed.correctAnswer),
        difficulty: parsed.difficulty ?? "UNKNOWN",
        isVipOnly: false,
        isActive: true,
        options: parsed.options.map((option) => ({
          ...option,
          contentHtml: toHtml(option.contentHtml),
        })),
      });
      successRows += 1;
    } catch (error) {
      errors.push({
        row: index + 1,
        message: error instanceof Error ? error.message : "导入失败",
      });
    }
  }

  return prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: errors.length > 0 ? "PARTIAL" : "SUCCESS",
      successRows,
      failedRows: errors.length,
      errorJson: errors.length > 0 ? errors : undefined,
    },
    select: { id: true },
  });
}
