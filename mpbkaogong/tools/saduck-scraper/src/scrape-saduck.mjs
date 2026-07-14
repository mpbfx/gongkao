import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { buildOutputDirName, getPreset, SITE_ORIGIN } from "./site-presets.mjs";
import {
  absoluteSiteUrl,
  categoryFromPath,
  htmlToMarkdown,
  localMarkdownPathFromUrlPath
} from "./markdown-transform.mjs";

const ROOT_DIR = process.cwd();
const MAX_RETRIES = 2;

function parseOptions(argv) {
  const options = { preset: "xingce", skipProfileExport: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--preset") {
      options.preset = argv[index + 1];
      index += 1;
    } else if (arg === "--skip-profile-export") {
      options.skipProfileExport = true;
    }
  }
  return options;
}

function runtimeFromOptions(options) {
  const preset = getPreset(options.preset);
  const outputDir = path.join(ROOT_DIR, buildOutputDirName(preset));
  return {
    preset,
    outputDir,
    profileDir: path.join(outputDir, ".playwright-profile"),
    assetRoot: path.join(outputDir, "assets"),
    manifestPath: path.join(outputDir, "manifest.json"),
    indexPath: path.join(outputDir, "index.md"),
    storageStatePath: path.join(outputDir, "storage-state.json")
  };
}

function isAllowedPath(urlPath, allowedPrefixes) {
  const decoded = decodeURIComponent(urlPath);
  return allowedPrefixes.some((prefix) => decoded.startsWith(prefix));
}

function normalizeDocUrl(href) {
  const parsed = new URL(href, SITE_ORIGIN);
  parsed.hash = "";
  parsed.search = "";
  if (parsed.pathname.endsWith(".md")) {
    parsed.pathname = parsed.pathname.replace(/\.md$/i, ".html");
  }
  return parsed.toString();
}

function isDocPath(pathname) {
  return /\.(html|md)$/i.test(pathname);
}

function localPathFromPageUrl(pageUrl) {
  return localMarkdownPathFromUrlPath(new URL(pageUrl).pathname);
}

function sanitizeName(value) {
  return decodeURIComponent(value || "asset").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-");
}

function assetRelativePathForUrl(pageUrl, assetUrl) {
  const category = sanitizeName(categoryFromPath(new URL(pageUrl).pathname) || "misc");
  const parsed = new URL(assetUrl);
  const ext = path.posix.extname(parsed.pathname) || ".bin";
  const base = sanitizeName(path.posix.basename(parsed.pathname, ext) || "asset");
  const hash = crypto.createHash("sha1").update(assetUrl).digest("hex").slice(0, 10);
  return path.posix.join("assets", category, `${base}-${hash}${ext}`);
}

async function ensureParent(targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
}

async function writeText(targetPath, content) {
  await ensureParent(targetPath);
  await fs.writeFile(targetPath, content, "utf8");
}

async function readJsonIfExists(targetPath) {
  try {
    return JSON.parse(await fs.readFile(targetPath, "utf8"));
  } catch {
    return null;
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function decodeJwtPayload(token) {
  const [, payload] = token.split(".");
  if (!payload) {
    throw new Error("SADUCK_TOKEN must be a JWT.");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function storageStateFromToken(token) {
  const payload = decodeJwtPayload(token);
  const entries = [
    ["token", token],
    ["email", payload.email],
    ["vipEndTime", payload.vipEndTime],
    ["vipType", payload.vipType]
  ]
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
    .map(([name, value]) => ({ name, value: String(value) }));

  return {
    cookies: [],
    origins: [{ origin: SITE_ORIGIN, localStorage: entries }]
  };
}

async function launchPersistentContext({ headed }) {
  const launchOptions = {
    headless: !headed,
    viewport: { width: 1440, height: 960 }
  };
  try {
    return await chromium.launchPersistentContext(runtime.profileDir, {
      ...launchOptions,
      channel: "msedge"
    });
  } catch {
    return chromium.launchPersistentContext(runtime.profileDir, launchOptions);
  }
}

async function launchScrapeContext() {
  const launchOptions = { headless: true };
  let browser;
  try {
    browser = await chromium.launch({ ...launchOptions, channel: "msedge" });
  } catch {
    browser = await chromium.launch(launchOptions);
  }

  const contextOptions = { viewport: { width: 1440, height: 960 } };
  if (await pathExists(runtime.storageStatePath)) {
    contextOptions.storageState = runtime.storageStatePath;
  }
  const context = await browser.newContext(contextOptions);
  return { browser, context };
}

async function extractLinksFromPage(page) {
  return page.evaluate(() => {
    const links = new Set();
    for (const anchor of document.querySelectorAll("a[href]")) {
      links.add(anchor.getAttribute("href"));
    }

    const raw = document.documentElement.innerHTML;
    for (const match of raw.matchAll(/"link"\s*:\s*"([^"]+\.(?:md|html))"/g)) {
      links.add(match[1]);
    }
    for (const match of raw.matchAll(/href="([^"]+\.(?:md|html))"/g)) {
      links.add(match[1]);
    }

    return [...links].filter(Boolean);
  });
}

async function discoverAllowedPages(context) {
  const page = await context.newPage();
  const queue = [runtime.preset.entryUrl];
  const seen = new Set();
  const found = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);

    try {
      await page.goto(current, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch {
      continue;
    }

    const hrefs = await extractLinksFromPage(page);
    for (const href of hrefs) {
      let normalized;
      try {
        normalized = normalizeDocUrl(href);
      } catch {
        continue;
      }

      const parsed = new URL(normalized);
      if (
        parsed.origin !== SITE_ORIGIN ||
        !isDocPath(parsed.pathname) ||
        !isAllowedPath(parsed.pathname, runtime.preset.allowedPrefixes)
      ) {
        continue;
      }

      if (!found.has(normalized)) {
        found.add(normalized);
        queue.push(normalized);
      }
    }
  }

  await page.close();
  return [...found].sort((left, right) =>
    decodeURIComponent(new URL(left).pathname).localeCompare(
      decodeURIComponent(new URL(right).pathname),
      "zh-Hans-CN"
    )
  );
}

async function extractPageModel(page) {
  return page.evaluate(() => {
    const container = document.querySelector("main .vp-doc");
    if (!container) {
      return null;
    }
    const clone = container.cloneNode(true);
    const images = [...clone.querySelectorAll("img[src]")].map((node) => node.getAttribute("src"));
    const title = clone.querySelector("h1")?.textContent?.replace(/\u200B/g, "").trim() || document.title;
    return {
      title,
      html: clone.innerHTML,
      images
    };
  });
}

async function downloadAsset(context, pageUrl, imageUrl, cache) {
  const absolute = absoluteSiteUrl(imageUrl);
  const parsed = new URL(absolute);
  if (parsed.origin !== SITE_ORIGIN) {
    return null;
  }
  if (cache.has(absolute)) {
    return cache.get(absolute);
  }

  const relativePath = assetRelativePathForUrl(pageUrl, absolute);
  const filePath = path.join(runtime.outputDir, relativePath);
  await ensureParent(filePath);

  const response = await context.request.get(absolute);
  if (!response.ok()) {
    cache.set(absolute, null);
    return null;
  }

  await fs.writeFile(filePath, await response.body());
  cache.set(absolute, relativePath);
  return relativePath;
}

async function scrapeOnePage(context, url, assetCache) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForSelector("main .vp-doc", { timeout: 30_000 });
      const model = await extractPageModel(page);
      if (!model) {
        throw new Error("Missing VitePress doc container.");
      }

      for (const image of model.images) {
        await downloadAsset(context, url, image, assetCache);
      }

      const localMarkdownPath = localPathFromPageUrl(url);
      const markdown = await htmlToMarkdown({
        html: model.html,
        pageUrl: url,
        localMarkdownPath,
        allowedCategories: new Set(runtime.preset.allowedPrefixes.map((prefix) => prefix.split("/")[1])),
        assetPathForUrl: (assetUrl) => assetCache.get(assetUrl) ?? null
      });

      await writeText(path.join(runtime.outputDir, localMarkdownPath), markdown);
      await page.close();
      return {
        title: model.title,
        source_url: url,
        local_path: localMarkdownPath,
        image_count: model.images.length,
        status: "ok"
      };
    } catch (error) {
      lastError = error;
      await page.close();
    }
  }

  return {
    title: decodeURIComponent(new URL(url).pathname),
    source_url: url,
    local_path: localPathFromPageUrl(url),
    image_count: 0,
    status: "failed",
    error: lastError instanceof Error ? lastError.message : String(lastError)
  };
}

function buildIndexMarkdown(manifest) {
  const lines = [`# SaDuck ${runtime.preset.name}索引`, ""];
  const okEntries = manifest.filter((entry) => entry.status === "ok");
  const categories = [...new Set(okEntries.map((entry) => entry.local_path.split("/")[0]))].sort((a, b) =>
    a.localeCompare(b, "zh-Hans-CN")
  );

  for (const category of categories) {
    lines.push(`## ${category}`, "");
    for (const entry of okEntries
      .filter((item) => item.local_path.startsWith(`${category}/`))
      .sort((a, b) => a.local_path.localeCompare(b.local_path, "zh-Hans-CN"))) {
      lines.push(`- [${entry.title}](${entry.local_path})`);
    }
    lines.push("");
  }

  const failed = manifest.filter((entry) => entry.status === "failed");
  if (failed.length > 0) {
    lines.push("## 抓取失败", "");
    for (const entry of failed) {
      lines.push(`- ${entry.source_url}: ${entry.error}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

async function scrapeAll() {
  await fs.mkdir(runtime.outputDir, { recursive: true });
  if (!options.skipProfileExport) {
    await exportStorageStateFromProfile();
  }

  const { browser, context } = await launchScrapeContext();
  try {
    const pages = await discoverAllowedPages(context);
    if (pages.length === 0) {
      throw new Error(`No pages discovered for preset ${runtime.preset.id}.`);
    }

    const assetCache = new Map();
    const manifest = [];
    for (const url of pages) {
      manifest.push(await scrapeOnePage(context, url, assetCache));
    }

    await writeText(runtime.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeText(runtime.indexPath, buildIndexMarkdown(manifest));
    console.log(`Scraped ${manifest.filter((entry) => entry.status === "ok").length}/${manifest.length} pages.`);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function exportStorageStateFromProfile() {
  const context = await launchPersistentContext({ headed: false });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(runtime.preset.entryUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await context.storageState({ path: runtime.storageStatePath });
  } finally {
    await context.close();
  }
}

async function writeStorageStateFromToken() {
  const token = process.env.SADUCK_TOKEN;
  if (!token) {
    throw new Error("Set SADUCK_TOKEN before running auth-token.");
  }
  await writeText(runtime.storageStatePath, `${JSON.stringify(storageStateFromToken(token), null, 2)}\n`);
  console.log(`Wrote storage state: ${runtime.storageStatePath}`);
}

async function runLogin() {
  await fs.mkdir(runtime.outputDir, { recursive: true });
  const context = await launchPersistentContext({ headed: true });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(runtime.preset.entryUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  console.log("浏览器已打开。请登录 SaDuck，登录完成后关闭浏览器窗口。");
  console.log(`入口页: ${runtime.preset.entryUrl}`);
  await context.waitForEvent("close");
}

async function printStatus() {
  const manifest = await readJsonIfExists(runtime.manifestPath);
  const failed = manifest?.filter((entry) => entry.status === "failed") ?? [];
  console.log(JSON.stringify({
    preset: runtime.preset.id,
    output_dir: runtime.outputDir,
    storage_state: runtime.storageStatePath,
    manifest_entries: manifest?.length ?? 0,
    failed_entries: failed.length
  }, null, 2));
}

async function main() {
  const mode = process.argv[2];
  if (mode === "login") {
    await runLogin();
    return;
  }
  if (mode === "auth-token") {
    await writeStorageStateFromToken();
    return;
  }
  if (mode === "scrape") {
    await scrapeAll();
    return;
  }
  if (mode === "status") {
    await printStatus();
    return;
  }

  console.error("Usage: node src/scrape-saduck.mjs <login|auth-token|scrape|status> [--preset shenlun] [--skip-profile-export]");
  process.exitCode = 1;
}

const options = parseOptions(process.argv.slice(3));
const runtime = runtimeFromOptions(options);

await main();
