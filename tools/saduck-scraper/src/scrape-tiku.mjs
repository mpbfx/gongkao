import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { buildOutputDirName, getPreset, SITE_ORIGIN } from "./site-presets.mjs";
import { readSaduckTokenFromStorageState } from "./tiku-auth.mjs";
import { decryptSaduckJson, encryptRequestParam, ITEMIZES_KEY } from "./tiku-crypto.mjs";
import {
  flattenPaperIndex,
  normalizePaper,
  normalizePaperIndex,
  normalizeQuestion,
  normalizeTagTree
} from "./tiku-normalize.mjs";

const API_ORIGIN = `${SITE_ORIGIN}/api`;
const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "saduck-tiku-json");
const STORAGE_STATE = path.join(ROOT_DIR, buildOutputDirName(getPreset("xingce")), "storage-state.json");

function parseOptions(argv) {
  return {
    allPapers: argv.includes("--all-papers")
  };
}

async function ensureParent(targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
}

async function writeJson(targetPath, value) {
  await ensureParent(targetPath);
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function postApi(pathname, body = {}, token = null) {
  if (pathname.includes("/tk/addRecord")) {
    throw new Error("Refusing to call /api/tk/addRecord because it writes practice history.");
  }

  const response = await fetch(`${API_ORIGIN}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { token } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`${pathname} HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`${pathname} returned code ${data.code}: ${data.message ?? ""}`);
  }
  return data.result;
}

function findFirstLeaf(nodes) {
  for (const node of nodes ?? []) {
    if (node?.children?.length) {
      const child = findFirstLeaf(node.children);
      if (child) {
        return child;
      }
    } else if (node?.id) {
      return node;
    }
  }
  return null;
}

async function fetchPaperIndex() {
  const encrypted = await postApi("/tk/itemizes?type=1");
  return normalizePaperIndex(decryptSaduckJson(encrypted, ITEMIZES_KEY));
}

async function fetchPaperDetail(source, token) {
  const raw = await postApi(
    "/tk/sourceInfo",
    { id: encryptRequestParam(source.sid) },
    token
  );
  return normalizePaper(raw, source);
}

async function fetchTagTree(token) {
  return normalizeTagTree(await postApi("/tk/problemTagNew?type=1", {}, token));
}

async function fetchSpecialPracticeSample(tags, token) {
  const leaf = findFirstLeaf(tags);
  if (!leaf) {
    return { reqs: [], difficulty: null, questions: [], model: null, testName: "" };
  }

  const reqs = [{ name: leaf.id, num: "5" }];
  const result = await postApi("/tk/tagInfo", { reqs, difficulty: null }, token);
  return {
    reqs,
    difficulty: null,
    testName: result.testName ?? "",
    model: result.tl ?? null,
    questions: Array.isArray(result.resps)
      ? result.resps.map((question) => normalizeQuestion(question, { tag: leaf.id }))
      : []
  };
}

function buildManifest({ mode, paperIndex, exportedPapers, tags, sample }) {
  const totalQuestions = exportedPapers.reduce((sum, paper) => sum + paper.questions.length, 0);
  return {
    mode,
    generated_at: new Date().toISOString(),
    total_groups: paperIndex.length,
    total_papers: flattenPaperIndex(paperIndex).length,
    exported_papers: exportedPapers.length,
    total_questions: totalQuestions,
    empty_papers: exportedPapers.filter((paper) => paper.questions.length === 0).map((paper) => paper.sid ?? paper.id),
    top_level_tags: tags.length,
    sample_questions: sample?.questions?.length ?? 0
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const token = await readSaduckTokenFromStorageState(STORAGE_STATE);
  await fs.mkdir(path.join(OUTPUT_DIR, "papers"), { recursive: true });
  await fs.mkdir(path.join(OUTPUT_DIR, "samples"), { recursive: true });

  const paperIndex = await fetchPaperIndex();
  const sources = flattenPaperIndex(paperIndex);
  const selectedSources = options.allPapers ? sources : sources.slice(0, 1);
  const exportedPapers = [];

  await writeJson(path.join(OUTPUT_DIR, "papers", "index.json"), paperIndex);

  for (const source of selectedSources) {
    const paper = await fetchPaperDetail(source, token);
    exportedPapers.push(paper);
    await writeJson(path.join(OUTPUT_DIR, "papers", `${source.sid}.json`), paper);
  }

  const tags = await fetchTagTree(token);
  await writeJson(path.join(OUTPUT_DIR, "tags.json"), tags);

  const sample = await fetchSpecialPracticeSample(tags, token);
  await writeJson(path.join(OUTPUT_DIR, "samples", "special-practice.json"), sample);

  const manifest = buildManifest({
    mode: options.allPapers ? "all-papers" : "sample",
    paperIndex,
    exportedPapers,
    tags,
    sample
  });
  await writeJson(path.join(OUTPUT_DIR, "manifest.json"), manifest);
  console.log(JSON.stringify(manifest, null, 2));
}

await main();
