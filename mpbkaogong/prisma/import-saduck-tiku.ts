import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../src/lib/db/prisma";

type SaduckTag = {
  id: string;
  parentId: string | null;
  sort?: number;
  count?: number;
  ise?: boolean;
  children?: SaduckTag[];
};

type SaduckOption = {
  label?: string;
  value?: string;
  text?: string;
};

type SaduckQuestion = {
  id: number | string;
  titleHtml?: string;
  type?: string;
  globalAccuracy?: number | string | null;
  correctAnswer?: string;
  options?: SaduckOption[];
  analysisHtml?: string;
  source?: string;
  tag?: string;
  materialHtml?: string;
};

type SaduckPaper = {
  sid: number;
  source?: string;
  model?: string;
  questions?: SaduckQuestion[];
};

type SaduckPaperIndexGroup = {
  title?: string;
  tkSources?: Array<{
    sid: number;
    source?: string;
    difficulty?: string;
    model?: string;
  }>;
};

type PaperMeta = {
  groupTitle?: string;
  source?: string;
  difficulty?: string;
  model?: string;
};

type Section = {
  name: string;
  snum: number;
  enum: number;
};

const defaultRoot = path.join(process.cwd(), "tools/saduck-scraper/saduck-tiku-json");
const sourceRoot = process.argv[2] ? path.resolve(process.argv[2]) : defaultRoot;
const sourceLabel = "SaDuck 真实题库";

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function stableId(prefix: string, value: string | number) {
  return `${prefix}_${String(value).trim()}`;
}

function hashId(prefix: string, value: string) {
  return `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 12)}`;
}

function stripHtml(html?: string | null) {
  if (!html) {
    return null;
  }

  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mapQuestionType(type?: string) {
  switch (type) {
    case "multiple":
      return "MULTIPLE";
    case "judge":
      return "JUDGE";
    case "single":
    default:
      return "SINGLE";
  }
}

function normalizeAnswer(answer?: string | null) {
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

function parseDecimal(value?: number | string | null) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : undefined;
}

function parseDifficulty(value?: string) {
  if (!value) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(1) : undefined;
}

function parseYear(title: string) {
  const match = title.match(/(\d{4})年/);
  return match ? Number(match[1]) : undefined;
}

function parseExamType(title: string) {
  if (title.includes("行测")) {
    return "行测";
  }

  if (title.includes("申论")) {
    return "申论";
  }

  return undefined;
}

function parseProvince(groupTitle?: string, title?: string) {
  if (groupTitle && groupTitle !== "国考") {
    return groupTitle;
  }

  return title?.includes("国家公务员") ? "国考" : groupTitle;
}

function parseSections(model?: string): Section[] {
  if (!model) {
    return [];
  }

  try {
    const parsed = JSON.parse(model) as Array<{ name?: string; snum?: number; enum?: number }>;
    return parsed
      .filter((section) => section.name && section.snum && section.enum)
      .map((section) => ({
        name: section.name ?? "",
        snum: Number(section.snum),
        enum: Number(section.enum),
      }));
  } catch {
    return [];
  }
}

function sectionForIndex(sections: Section[], index: number) {
  const questionNumber = index + 1;
  return sections.find((section) => questionNumber >= section.snum && questionNumber <= section.enum);
}

function flattenTags(tags: SaduckTag[]) {
  const rows: Array<SaduckTag & { parentName: string | null }> = [];

  function visit(nodes: SaduckTag[], parentName: string | null) {
    for (const tag of nodes) {
      rows.push({ ...tag, parentName });
      visit(tag.children ?? [], tag.id);
    }
  }

  visit(tags, null);
  return rows;
}

function loadPaperMeta() {
  const groups = readJson<SaduckPaperIndexGroup[]>(path.join(sourceRoot, "papers", "index.json"));
  const metaBySid = new Map<number, PaperMeta>();

  for (const group of groups) {
    for (const paper of group.tkSources ?? []) {
      metaBySid.set(Number(paper.sid), {
        groupTitle: group.title?.trim(),
        source: paper.source?.trim(),
        difficulty: paper.difficulty,
        model: paper.model,
      });
    }
  }

  return metaBySid;
}

async function ensureTags() {
  const rawTags = readJson<SaduckTag[]>(path.join(sourceRoot, "tags.json"));
  const rows = flattenTags(rawTags);
  const knownNames = new Set(rows.map((tag) => tag.id));
  const tagIdByName = new Map<string, string>();

  for (const tag of rows.filter((row) => !row.parentName)) {
    const id = hashId("saduck_tag", tag.id);
    tagIdByName.set(tag.id, id);
    await prisma.questionTag.upsert({
      where: { id },
      update: {
        name: tag.id,
        sortOrder: tag.sort ?? 0,
        isMaterialOnly: Boolean(tag.ise),
        isActive: true,
      },
      create: {
        id,
        name: tag.id,
        slug: id,
        sortOrder: tag.sort ?? 0,
        isMaterialOnly: Boolean(tag.ise),
        isActive: true,
      },
    });
  }

  for (const tag of rows.filter((row) => row.parentName)) {
    const id = hashId("saduck_tag", tag.id);
    tagIdByName.set(tag.id, id);
    await prisma.questionTag.upsert({
      where: { id },
      update: {
        name: tag.id,
        parentId: tag.parentName ? tagIdByName.get(tag.parentName) : null,
        sortOrder: tag.sort ?? 0,
        isMaterialOnly: Boolean(tag.ise),
        isActive: true,
      },
      create: {
        id,
        name: tag.id,
        slug: id,
        parentId: tag.parentName ? tagIdByName.get(tag.parentName) : null,
        sortOrder: tag.sort ?? 0,
        isMaterialOnly: Boolean(tag.ise),
        isActive: true,
      },
    });
  }

  return { knownNames, tagIdByName };
}

async function ensureFallbackTag(name: string, tagIdByName: Map<string, string>) {
  const id = hashId("saduck_tag", name);
  if (tagIdByName.has(name)) {
    return tagIdByName.get(name);
  }

  await prisma.questionTag.upsert({
    where: { id },
    update: {
      name,
      isActive: true,
    },
    create: {
      id,
      name,
      slug: id,
      sortOrder: 1000,
      isActive: true,
    },
  });

  tagIdByName.set(name, id);
  return id;
}

async function upsertQuestion(question: SaduckQuestion, questionId: string, tagIdByName: Map<string, string>) {
  const tagId = question.tag ? await ensureFallbackTag(question.tag, tagIdByName) : undefined;
  const materialId = question.materialHtml ? questionId.replace("saduck_q_", "saduck_material_") : undefined;

  if (materialId && question.materialHtml) {
    await prisma.material.upsert({
      where: { id: materialId },
      update: {
        contentHtml: question.materialHtml,
        plainText: stripHtml(question.materialHtml),
        source: question.source ?? sourceLabel,
      },
      create: {
        id: materialId,
        contentHtml: question.materialHtml,
        plainText: stripHtml(question.materialHtml),
        source: question.source ?? sourceLabel,
      },
    });
  }

  await prisma.$transaction([
    prisma.question.upsert({
      where: { id: questionId },
      update: {
        type: mapQuestionType(question.type),
        titleHtml: question.titleHtml ?? "",
        plainText: stripHtml(question.titleHtml),
        analysisHtml: question.analysisHtml || null,
        correctAnswer: normalizeAnswer(question.correctAnswer),
        globalAccuracy: parseDecimal(question.globalAccuracy),
        source: question.source ?? sourceLabel,
        tagId,
        materialId,
        isActive: true,
      },
      create: {
        id: questionId,
        type: mapQuestionType(question.type),
        titleHtml: question.titleHtml ?? "",
        plainText: stripHtml(question.titleHtml),
        analysisHtml: question.analysisHtml || null,
        correctAnswer: normalizeAnswer(question.correctAnswer),
        globalAccuracy: parseDecimal(question.globalAccuracy),
        source: question.source ?? sourceLabel,
        tagId,
        materialId,
        isActive: true,
      },
    }),
    prisma.questionOption.deleteMany({ where: { questionId } }),
    prisma.questionOption.createMany({
      data: (question.options ?? []).map((option, index) => ({
        id: `${questionId}_${option.value ?? option.label ?? index}`,
        questionId,
        label: option.label ?? String(index + 1),
        value: option.value ?? option.label ?? String(index),
        contentHtml: option.text ?? "",
        plainText: stripHtml(option.text),
        sortOrder: index,
      })),
    }),
  ]);

  return questionId;
}

async function main() {
  const manifest = readJson<{ total_questions?: number }>(path.join(sourceRoot, "manifest.json"));
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true },
  });

  if (!admin) {
    throw new Error("No admin user found. Run prisma seed first.");
  }

  const job = await prisma.importJob.create({
    data: {
      userId: admin.id,
      type: "saduck-tiku",
      filename: sourceRoot,
      status: "RUNNING",
      totalRows: manifest.total_questions ?? 0,
    },
    select: { id: true },
  });

  let successRows = 0;
  const errors: Array<{ file: string; row?: number; message: string }> = [];
  const { tagIdByName } = await ensureTags();
  const metaBySid = loadPaperMeta();
  const paperFiles = readdirSync(path.join(sourceRoot, "papers"))
    .filter((file) => /^\d+\.json$/.test(file))
    .sort((first, second) => Number(first.replace(".json", "")) - Number(second.replace(".json", "")));

  for (const file of paperFiles) {
    const paper = readJson<SaduckPaper>(path.join(sourceRoot, "papers", file));
    const meta = metaBySid.get(Number(paper.sid)) ?? {};
    const title = (paper.source ?? meta.source ?? `SaDuck 试卷 ${paper.sid}`).trim();
    const model = paper.model ?? meta.model;
    const sections = parseSections(model);
    const paperId = stableId("saduck_paper", paper.sid);

    await prisma.paper.upsert({
      where: { id: paperId },
      update: {
        title,
        year: parseYear(title),
        province: parseProvince(meta.groupTitle, title),
        examType: parseExamType(title),
        difficultyScore: parseDifficulty(meta.difficulty),
        isActive: true,
      },
      create: {
        id: paperId,
        title,
        slug: paperId,
        year: parseYear(title),
        province: parseProvince(meta.groupTitle, title),
        examType: parseExamType(title),
        difficultyScore: parseDifficulty(meta.difficulty),
        isActive: true,
      },
    });

    const relations = [];
    const questionOccurrences = new Map<string, number>();

    for (const [index, question] of (paper.questions ?? []).entries()) {
      try {
        const rawQuestionId = String(question.id);
        const occurrence = questionOccurrences.get(rawQuestionId) ?? 0;
        questionOccurrences.set(rawQuestionId, occurrence + 1);
        const questionId =
          occurrence === 0
            ? stableId("saduck_q", rawQuestionId)
            : stableId("saduck_q", `${rawQuestionId}_${paper.sid}_${index + 1}`);

        await upsertQuestion(question, questionId, tagIdByName);
        const section = sectionForIndex(sections, index);
        relations.push({
          id: stableId("saduck_pq", `${paper.sid}_${index + 1}`),
          paperId,
          questionId,
          sortOrder: index + 1,
          sectionName: section?.name,
          sectionStart: section?.snum,
          sectionEnd: section?.enum,
        });
        successRows += 1;
      } catch (error) {
        errors.push({
          file,
          row: index + 1,
          message: error instanceof Error ? error.message : "Unknown import error",
        });
      }
    }

    for (let index = 0; index < relations.length; index += 500) {
      await prisma.paperQuestion.createMany({
        data: relations.slice(index, index + 500),
        skipDuplicates: true,
      });
    }

    console.log(`Imported ${file}: ${relations.length} questions linked`);
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: errors.length > 0 ? "PARTIAL" : "SUCCESS",
      successRows,
      failedRows: errors.length,
      errorJson: errors.length > 0 ? errors.slice(0, 200) : undefined,
    },
  });

  console.log(
    JSON.stringify(
      {
        status: errors.length > 0 ? "PARTIAL" : "SUCCESS",
        paperFiles: paperFiles.length,
        successRows,
        failedRows: errors.length,
      },
      null,
      2
    )
  );
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
