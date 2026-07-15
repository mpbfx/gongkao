SaDuck 行测、申论、题库抓取指南

本文档用于指导其他 agent 从 0 到 1 复现当前抓取工作流：登录 SaDuck、抓取行测/申论知识页为 Markdown，并导出题库为结构化 JSON。

注意：不要把真实 JWT、账号、Cookie 或 storage-state.json 提交到公开仓库。本文只描述流程，不包含任何真实 token。抓取应限定在授权范围和个人本地学习使用场景内。

目标产物

最终目录结构大致如下：

D:\gwy
├─ src\
│  ├─ scrape-saduck.mjs          # 行测/申论 Markdown 抓取器
│  ├─ scrape-tiku.mjs            # 题库 JSON 导出器
│  ├─ site-presets.mjs           # SaDuck 章节 preset
│  ├─ markdown-transform.mjs     # HTML -> Markdown 转换
│  ├─ tiku-auth.mjs              # 从 Playwright storage-state 读取 token
│  ├─ tiku-crypto.mjs            # SaDuck 题库 AES 加解密
│  └─ tiku-normalize.mjs         # 题库题目/试卷/分类标准化
├─ saduck-xingce-md\             # 行测 Markdown 输出
├─ saduck-shenlun-md\            # 申论 Markdown 输出
├─ saduck-tiku-json\             # 题库 JSON 输出
├─ tests\                        # node:test 测试
└─ package.json

环境准备

要求：

- Windows + PowerShell
- Node.js 22 或兼容版本
- npm
- Microsoft Edge
- 网络可访问 https://saduck.top

安装依赖：

cd D:\gwy
npm install

当前关键依赖：

- playwright：登录和页面抓取
- jsdom、turndown、turndown-plugin-gfm：Markdown 转换

登录态方案

项目支持两种登录态。

方案 A：可见 Edge 登录

行测：

npm run login

申论：

npm run login:shenlun

命令会打开持久 Edge profile。用户在窗口里完成登录后，关闭浏览器窗口。随后抓取器会用该 profile 导出 storage-state.json。

方案 B：JWT token 注入

推荐给自动化 agent 使用。不要把 token 写进源码。

行测：

$env:SADUCK_TOKEN="<jwt>"
npm run auth:token
Remove-Item Env:\SADUCK_TOKEN

申论：

$env:SADUCK_TOKEN="<jwt>"
npm run auth:token:shenlun
Remove-Item Env:\SADUCK_TOKEN

该命令会写入：

D:\gwy\saduck-xingce-md\storage-state.json
D:\gwy\saduck-shenlun-md\storage-state.json

写入的 localStorage 键包括：

- token
- email
- vipEndTime
- vipType

行测/申论 Markdown 抓取

核心文件：

- src/site-presets.mjs
- src/scrape-saduck.mjs
- src/markdown-transform.mjs

Preset

src/site-presets.mjs 维护站点边界：

- xingce
  - 输出目录：saduck-xingce-md
  - 入口：资料分析说明页
  - 允许前缀：资料分析、言语理解、数量关系、常识判断、判断推理
- shenlun
  - 输出目录：saduck-shenlun-md
  - 入口：申论说明页
  - 允许前缀：申论

新增章节时，增加 preset：

newSection: {
  id: "newSection",
  name: "章节名",
  entryUrl: `${SITE_ORIGIN}/...html`,
  allowedPrefixes: ["/章节名/"]
}

然后在 package.json 增加对应脚本。

抓取命令

使用浏览器登录态：

npm run scrape
npm run scrape:shenlun

使用 token 登录态：

npm run scrape:token
npm run scrape:token:shenlun

如果已经手动写好 storage-state.json，也可以跳过 profile 导出：

node src/scrape-saduck.mjs scrape --skip-profile-export
node src/scrape-saduck.mjs scrape --preset shenlun --skip-profile-export

Markdown 输出

每个输出目录包含：

saduck-<preset>-md\
├─ assets\             # 本地图片
├─ manifest.json       # 每页抓取状态
├─ index.md            # 本地索引
├─ storage-state.json  # Playwright 登录态
└─ <章节路径>\*.md

每个 Markdown 文件包含 frontmatter：

---
title: "页面标题"
source_url: "https://saduck.top/..."
category: "章节"
slug: "章节/页面"
fetched_at: "ISO 时间"
---

Markdown 抓取验证

npm run status
npm run status:shenlun
npm test

检查 manifest.json：

node -e "const fs=require('fs'); for (const f of ['D:/gwy/saduck-xingce-md/manifest.json','D:/gwy/saduck-shenlun-md/manifest.json']) { const m=JSON.parse(fs.readFileSync(f,'utf8')); console.log(f, m.length, m.filter(x=>x.status==='failed').length); }"

预期 failed 为 0。

题库 JSON 导出

核心文件：

- src/scrape-tiku.mjs
- src/tiku-auth.mjs
- src/tiku-crypto.mjs
- src/tiku-normalize.mjs

题库导出器读取：

D:\gwy\saduck-xingce-md\storage-state.json

因此必须先完成行测 token auth 或行测登录。

SaDuck 题库接口

已确认的接口：

用途
方法与路径
说明
历年试卷列表
POST /api/tk/itemizes?type=1
result 为 AES 加密字符串
历年试卷详情
POST /api/tk/sourceInfo
body 为 { id: encryptedSid }，需要 token
专项分类树
POST /api/tk/problemTagNew?type=1
明文 JSON，需要 token
专项练习出题
POST /api/tk/tagInfo
body 为 { reqs, difficulty }，需要 token
每日一练
POST /api/tk/getPractice
需要 token
练习记录
POST /api/tk/recordNew?type=1
需要 token
错题
POST /api/tk/getCt、POST /api/tk/getCtInfo
需要 token
提交记录
POST /api/tk/addRecord
原站记录写入接口；抓取流程不需要调用

AES 规则

前端 chunk 中可见两套 AES key：

// 请求参数加密，例如 sourceInfo 的 sid
requestKey = "kxZ17XQ8z6957n3S"

// itemizes result 解密
itemizesKey = "7SyqrN6925ZYb636"

模式：

- AES-128-ECB
- PKCS7 padding
- Base64 输出中 / 替换为 _，+ 替换为 -

实现位置：

src/tiku-crypto.mjs

导出命令

轻量 sample：

npm run scrape:tiku

输出：

- 完整试卷索引
- 完整专项分类树
- 1 套试卷详情
- 1 个专项练习 sample

全量试卷：

npm run scrape:tiku:all

输出：

saduck-tiku-json\
├─ manifest.json
├─ papers\
│  ├─ index.json
│  └─ <sid>.json
├─ tags.json
└─ samples\
   └─ special-practice.json

当前全量导出结果曾验证为：

- 153 套试卷
- 18025 道题
- 0 个空试卷
- 顶层专项分类 6 个

题目 JSON 字段

标准化后的题目字段：

{
  "id": 23491,
  "titleHtml": "...",
  "type": "single",
  "globalAccuracy": "...",
  "correctAnswer": "3",
  "options": [
    { "label": "A", "value": "0", "text": "1项" },
    { "label": "B", "value": "1", "text": "2项" }
  ],
  "analysisHtml": "...",
  "source": "2026年国家公务员录用考试《行测》（副省级）",
  "tag": "理论政策",
  "materialHtml": "",
  "userAnswer": null,
  "memorize": null
}

注意：

- 原站 options 是用 # 分隔的字符串，导出器会拆成数组。
- correctAnswer 使用 0、1、2、3 这种选项值，不是 A、B、C、D。
- 材料题的 materialHtml 可能很长。
- 原站富文本字段可能包含图片 URL，导出器会保留原始 HTML/URL。

验证流程

每次修改后至少运行：

npm test

题库导出验证：

npm run scrape:tiku
npm run scrape:tiku:all

检查输出摘要：

node -e "const fs=require('fs'); const path=require('path'); const root='D:/gwy/saduck-tiku-json'; const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')); const files=fs.readdirSync(path.join(root,'papers')).filter(f=>/^\\d+\\.json$/.test(f)); let q=0; let empty=[]; for(const f of files){ const p=JSON.parse(fs.readFileSync(path.join(root,'papers',f),'utf8')); q+=p.questions.length; if(!p.questions.length) empty.push(f); } console.log({mode:m.mode,total_papers:m.total_papers,exported_papers:m.exported_papers,paper_files:files.length,total_questions:q,empty_papers:empty.length});"

常见坑

PowerShell 中文显示乱码

Get-Content 有时会把中文显示为 mojibake，但 Node.js 按 UTF-8 读取是正常的。需要检查中文内容时，优先用：

node -e "const fs=require('fs'); console.log(fs.readFileSync('文件路径','utf8'))"

token 过期

JWT 可能 exp 未过期，但 vipEndTime 已过期。实际会员权限可能按 vipEndTime 判断。验证方式：

node -e "const fs=require('fs'); const s=JSON.parse(fs.readFileSync('D:/gwy/saduck-xingce-md/storage-state.json','utf8')); const ls=s.origins.find(o=>o.origin==='https://saduck.top').localStorage; console.log(ls.filter(x=>['email','vipType','vipEndTime'].includes(x.name)))"

scrape 意外打开 Edge

默认 npm run scrape 会先从持久 Edge profile 导出 storage-state.json。如果使用 token state，应该使用：

npm run scrape:token

或：

node src/scrape-saduck.mjs scrape --skip-profile-export

不要调用原站提交接口

/api/tk/addRecord 会写原站练习记录。抓取题库内容不需要调用它，不要把测试行为提交回 SaDuck。

从 0 到 1 推荐执行顺序

1. 创建 Node 项目并安装依赖。
2. 实现 site-presets.mjs，定义行测/申论边界。
3. 实现 scrape-saduck.mjs 的 login、auth-token、scrape、status 模式。
4. 实现 markdown-transform.mjs，处理正文清洗、站内链接、图片本地化。
5. 用 npm run scrape:token 和 npm run scrape:token:shenlun 生成 Markdown。
6. 实现 tiku-crypto.mjs，处理 SaDuck AES 加解密。
7. 实现 tiku-auth.mjs，从 storage-state.json 读取 token。
8. 实现 tiku-normalize.mjs，标准化试卷、题目、分类树。
9. 实现 scrape-tiku.mjs，导出 sample 和全量 JSON。
10. 用 npm run scrape:tiku:all 生成 saduck-tiku-json。
11. 运行 npm test，并检查 manifest.json、Markdown 文件、题库 JSON 计数。

当前脚本清单

{
  "test": "node --test",
  "login": "node src/scrape-saduck.mjs login",
  "scrape": "node src/scrape-saduck.mjs scrape",
  "status": "node src/scrape-saduck.mjs status",
  "auth:token": "node src/scrape-saduck.mjs auth-token",
  "scrape:token": "node src/scrape-saduck.mjs auth-token && node src/scrape-saduck.mjs scrape --skip-profile-export",
  "scrape:tiku": "node src/scrape-tiku.mjs",
  "scrape:tiku:all": "node src/scrape-tiku.mjs --all-papers",
  "login:shenlun": "node src/scrape-saduck.mjs login --preset shenlun",
  "scrape:shenlun": "node src/scrape-saduck.mjs scrape --preset shenlun",
  "auth:token:shenlun": "node src/scrape-saduck.mjs auth-token --preset shenlun",
  "scrape:token:shenlun": "node src/scrape-saduck.mjs auth-token --preset shenlun && node src/scrape-saduck.mjs scrape --preset shenlun --skip-profile-export",
  "status:shenlun": "node src/scrape-saduck.mjs status --preset shenlun"
}

完整脚本实现

以下代码块直接对应当前仓库内实际可运行实现，方便其他 agent 从 0 到 1 复现。

src/site-presets.mjs

export const SITE_ORIGIN = "https://saduck.top";

const PRESETS = {
  xingce: {
    id: "xingce",
    name: "行测",
    entryUrl: `${SITE_ORIGIN}/%E8%B5%84%E6%96%99%E5%88%86%E6%9E%90/%E8%B5%84%E6%96%99%E8%AF%B4%E6%98%8E.html`,
    allowedPrefixes: [
      "/资料分析/",
      "/言语理解/",
      "/数量关系/",
      "/常识判断/",
      "/判断推理/"
    ]
  },
  shenlun: {
    id: "shenlun",
    name: "申论",
    entryUrl: `${SITE_ORIGIN}/%E7%94%B3%E8%AE%BA/%E4%BB%80%E4%B9%88%E6%98%AF%E7%94%B3%E8%AE%BA.html`,
    allowedPrefixes: ["/申论/"]
  }
};

export function getPreset(id) {
  const preset = PRESETS[id];
  if (!preset) {
    throw new Error(`Unknown preset: ${id}`);
  }
  return {
    ...preset,
    allowedPrefixes: [...preset.allowedPrefixes]
  };
}

export function canonicalizeAllowedPrefix(value) {
  const trimmed = decodeURIComponent(value).trim().replace(/^\/+/, "").replace(/\/+$/, "");
  return `/${trimmed}/`;
}

export function buildOutputDirName({ id }) {
  return `saduck-${id}-md`;
}

src/markdown-transform.mjs

import path from "node:path";
import TurndownService from "turndown";
import { gfm, tables } from "turndown-plugin-gfm";
import { JSDOM } from "jsdom";

const SITE_ORIGIN = "https://saduck.top";
const ALLOWED_CATEGORIES = new Set([
  "资料分析",
  "言语理解",
  "数量关系",
  "常识判断",
  "判断推理"
]);

function decodePath(urlPath) {
  return decodeURIComponent(urlPath);
}

function normalizeSiteUrl(targetUrl) {
  return new URL(targetUrl, SITE_ORIGIN);
}

export function categoryFromPath(urlPath) {
  const decoded = decodePath(urlPath).replace(/^\/+/, "");
  const [category] = decoded.split("/");
  return category;
}

export function localMarkdownPathFromUrlPath(urlPath) {
  const decoded = decodePath(urlPath).replace(/^\/+/, "");
  return decoded.replace(/\.html$/i, ".md");
}

export function relativeMarkdownLink({ fromPath, targetUrl }) {
  const absolute = normalizeSiteUrl(targetUrl);
  if (absolute.origin !== SITE_ORIGIN) {
    return targetUrl;
  }

  const category = categoryFromPath(absolute.pathname);
  if (!ALLOWED_CATEGORIES.has(category) || !absolute.pathname.endsWith(".html")) {
    return absolute.toString();
  }

  const fromDir = path.posix.dirname(fromPath);
  const targetMd = localMarkdownPathFromUrlPath(absolute.pathname);
  const relative = path.posix.relative(fromDir, targetMd) || path.posix.basename(targetMd);
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function createTurndownService({ localMarkdownPath, assetPathForUrl }) {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*"
  });

  service.use([gfm, tables]);

  service.keep(["table", "thead", "tbody", "tr", "th", "td"]);

  service.addRule("removeWordCountMeta", {
    filter: (node) => node.nodeType === 1 && node.classList?.contains("word"),
    replacement: () => ""
  });

  service.addRule("removeHeaderAnchor", {
    filter: (node) => node.nodeType === 1 && node.classList?.contains("header-anchor"),
    replacement: () => ""
  });

  service.addRule("siteLinks", {
    filter: (node) => node.nodeName === "A" && node.getAttribute("href"),
    replacement: (content, node) => {
      const href = node.getAttribute("href");
      const absolute = normalizeSiteUrl(href);
      const normalized =
        absolute.origin === SITE_ORIGIN
          ? relativeMarkdownLink({
              fromPath: localMarkdownPath,
              targetUrl: absolute.toString()
            })
          : href;
      const label = content.trim() || normalized;
      return `[${label}](${normalized})`;
    }
  });

  service.addRule("images", {
    filter: "img",
    replacement: (_content, node) => {
      const src = node.getAttribute("src");
      if (!src) {
        return "";
      }
      const resolved = normalizeSiteUrl(src).toString();
      const assetPath = assetPathForUrl(resolved);
      const target = assetPath
        ? path.posix.relative(
            path.posix.dirname(localMarkdownPath),
            assetPath
          )
        : resolved;
      const alt = node.getAttribute("alt") || "";
      return `![${alt}](${target})`;
    }
  });

  return service;
}

function collapseBlankLines(markdown) {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

export async function htmlToMarkdown({
  html,
  pageUrl,
  localMarkdownPath,
  assetPathForUrl
}) {
  const dom = new JSDOM(`<html><body>${html}</body></html>`);

  const doc = dom.window.document;
  doc.querySelectorAll("svg, button, script, style").forEach((node) => node.remove());

  for (const anchor of doc.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href) {
      continue;
    }
    anchor.setAttribute("href", normalizeSiteUrl(href).toString());
  }

  for (const image of doc.querySelectorAll("img[src]")) {
    image.setAttribute("src", normalizeSiteUrl(image.getAttribute("src")).toString());
  }

  const service = createTurndownService({ localMarkdownPath, assetPathForUrl });
  const markdown = service.turndown(doc.body.innerHTML);

  const frontmatter = [
    "---",
    `title: ${JSON.stringify(doc.querySelector("h1")?.textContent?.trim() || "")}`,
    `source_url: ${JSON.stringify(pageUrl)}`,
    `category: ${JSON.stringify(categoryFromPath(new URL(pageUrl).pathname))}`,
    `slug: ${JSON.stringify(localMarkdownPath.replace(/\.md$/i, ""))}`,
    `fetched_at: ${JSON.stringify(new Date().toISOString())}`,
    "---",
    ""
  ].join("\n");

  return frontmatter + collapseBlankLines(markdown);
}

src/scrape-saduck.mjs

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { chromium } from "playwright";
import { buildOutputDirName, getPreset, SITE_ORIGIN } from "./site-presets.mjs";
import {
  categoryFromPath,
  htmlToMarkdown,
  localMarkdownPathFromUrlPath
} from "./markdown-transform.mjs";

const ROOT_DIR = process.cwd();

function parseOptions(argv) {
  const options = { preset: "xingce", skipProfileExport: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--preset") {
      options.preset = argv[index + 1];
      index += 1;
    } else if (token === "--skip-profile-export") {
      options.skipProfileExport = true;
    }
  }
  return options;
}

function buildRuntimeConfig(options) {
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

function ensureAllowedPath(urlPath, allowedPrefixes) {
  const decoded = decodeURIComponent(urlPath);
  return allowedPrefixes.some((prefix) => decoded.startsWith(prefix));
}

function absoluteSiteUrl(href) {
  return new URL(href, SITE_ORIGIN).toString();
}

function canonicalizeSiteUrl(urlLike) {
  const parsed = new URL(urlLike, SITE_ORIGIN);
  parsed.hash = "";
  return parsed.toString();
}

function localPathFromPageUrl(pageUrl) {
  return localMarkdownPathFromUrlPath(new URL(pageUrl).pathname);
}

function sanitizeName(value) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-");
}

function assetRelativePathForUrl(pageUrl, assetUrl) {
  const category = categoryFromPath(new URL(pageUrl).pathname);
  const basename = path.posix.basename(new URL(assetUrl).pathname) || "image";
  const hash = crypto.createHash("sha1").update(assetUrl).digest("hex").slice(0, 8);
  return path.posix.join("assets", sanitizeName(category), `${hash}-${sanitizeName(basename)}`);
}

async function ensureDirectory(targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
}

async function writeTextFile(targetPath, content) {
  await ensureDirectory(targetPath);
  await fs.writeFile(targetPath, content, "utf8");
}

async function readJsonIfExists(targetPath) {
  try {
    return JSON.parse(await fs.readFile(targetPath, "utf8"));
  } catch {
    return null;
  }
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new Error("SADUCK_TOKEN must be a JWT with three dot-separated parts");
  }

  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch (error) {
    throw new Error(`Unable to decode SADUCK_TOKEN payload: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function storageStateFromToken(token) {
  const payload = decodeJwtPayload(token);
  const localStorage = [
    ["token", token],
    ["vipEndTime", String(payload.vipEndTime ?? "")],
    ["email", String(payload.email ?? "")],
    ["vipType", String(payload.vipType ?? "")]
  ]
    .filter(([, value]) => value.length > 0)
    .map(([name, value]) => ({ name, value }));

  return {
    cookies: [],
    origins: [
      {
        origin: SITE_ORIGIN,
        localStorage
      }
    ]
  };
}

async function launchContext({ headed }) {
  return chromium.launchPersistentContext(runtime.profileDir, {
    channel: "msedge",
    headless: !headed,
    viewport: { width: 1440, height: 960 }
  });
}

async function launchScrapeContext() {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true
  });

  const context = await browser.newContext({
    storageState: runtime.storageStatePath,
    viewport: { width: 1440, height: 960 }
  });

  return { browser, context };
}

async function waitForDocPage(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("main .vp-doc", { timeout: 30000 });
}

async function extractPageModel(page) {
  return page.evaluate(() => {
    const container = document.querySelector("main .vp-doc");
    if (!container) {
      return null;
    }

    const clone = container.cloneNode(true);
    clone.querySelectorAll(
      ".header-anchor,.word,.edit-info,.last-updated,.VPDocFooter,.VPLocalNav,.outline-link,.outline-marker"
    ).forEach((node) => node.remove());

    const links = Array.from(clone.querySelectorAll("a[href]"))
      .map((node) => node.getAttribute("href"))
      .filter(Boolean);

    const images = Array.from(clone.querySelectorAll("img[src]"))
      .map((node) => node.getAttribute("src"))
      .filter(Boolean);

    return {
      title: clone.querySelector("h1")?.textContent?.trim() || document.title,
      html: clone.innerHTML,
      links,
      images
    };
  });
}

async function discoverAllowedPages(context) {
  const page = await context.newPage();
  const queue = [SITE_ORIGIN];
  const seen = new Set();
  const found = new Set();

  while (queue.length > 0) {
    const url = queue.shift();
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const hrefs = await page.locator("a[href]").evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute("href"))
        .filter(Boolean)
    );

    for (const href of hrefs) {
      const absolute = canonicalizeSiteUrl(absoluteSiteUrl(href));
      const parsed = new URL(absolute);
      if (parsed.origin !== SITE_ORIGIN) {
        continue;
      }
      if (ensureAllowedPath(parsed.pathname, runtime.preset.allowedPrefixes)) {
        if (!found.has(absolute)) {
          found.add(absolute);
          queue.push(absolute);
        }
      }
    }
  }

  await page.close();
  return Array.from(found).sort((left, right) =>
    decodeURIComponent(new URL(left).pathname).localeCompare(decodeURIComponent(new URL(right).pathname), "zh-Hans-CN")
  );
}

async function downloadAsset(context, pageUrl, assetUrl, cache) {
  const absolute = absoluteSiteUrl(assetUrl);
  const parsed = new URL(absolute);
  if (parsed.origin !== SITE_ORIGIN) {
    return null;
  }

  if (cache.has(absolute)) {
    return cache.get(absolute);
  }

  const relativePath = assetRelativePathForUrl(pageUrl, absolute);
  const filePath = path.join(runtime.outputDir, relativePath);
  await ensureDirectory(filePath);

  const response = await context.request.get(absolute);
  if (!response.ok()) {
    cache.set(absolute, null);
    return null;
  }

  await fs.writeFile(filePath, await response.body());
  cache.set(absolute, relativePath.replaceAll("\\", "/"));
  return cache.get(absolute);
}

async function verifyAuthenticated(context) {
  const page = await context.newPage();
  await page.goto(runtime.preset.entryUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  const hasDoc = await page.locator("main .vp-doc").count();
  const currentUrl = page.url();
  await page.close();

  if (!hasDoc || currentUrl.includes("login")) {
    throw new Error(`登录态校验失败，当前地址: ${currentUrl}`);
  }
}

async function scrapeAll() {
  await fs.mkdir(runtime.outputDir, { recursive: true });
  if (!options.skipProfileExport) {
    await exportStorageStateFromProfile();
  }
  const { browser, context } = await launchScrapeContext();

  try {
    await verifyAuthenticated(context);

    const pages = await discoverAllowedPages(context);
    const assetCache = new Map();
    const manifest = [];

    for (const url of pages) {
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await waitForDocPage(page);
        const model = await extractPageModel(page);
        if (!model) {
          throw new Error("未找到正文容器");
        }

        for (const imageUrl of model.images) {
          await downloadAsset(context, url, imageUrl, assetCache);
        }

        const localMarkdownPath = localPathFromPageUrl(url);
        const markdown = await htmlToMarkdown({
          html: model.html,
          pageUrl: url,
          localMarkdownPath,
          assetPathForUrl: (assetUrl) => assetCache.get(assetUrl) ?? null
        });

        await writeTextFile(path.join(runtime.outputDir, localMarkdownPath), markdown);

        manifest.push({
          title: model.title,
          source_url: url,
          local_path: localMarkdownPath.replaceAll("\\", "/"),
          image_count: model.images.length,
          status: "ok"
        });
      } catch (error) {
        manifest.push({
          title: decodeURIComponent(new URL(url).pathname),
          source_url: url,
          local_path: localPathFromPageUrl(url).replaceAll("\\", "/"),
          image_count: 0,
          status: "failed",
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        await page.close();
      }
    }

    await writeTextFile(runtime.manifestPath, JSON.stringify(manifest, null, 2));
    await writeTextFile(runtime.indexPath, buildIndexMarkdown(manifest));
  } finally {
    await context.close();
    await browser.close();
  }
}

async function exportStorageStateFromProfile() {
  const context = await launchContext({ headed: true });
  try {
    await verifyAuthenticated(context);
    await context.storageState({ path: runtime.storageStatePath });
  } finally {
    await context.close();
  }
}

async function writeStorageStateFromToken() {
  const token = process.env.SADUCK_TOKEN;
  if (!token) {
    throw new Error("Set SADUCK_TOKEN before running auth-token");
  }

  await writeTextFile(runtime.storageStatePath, `${JSON.stringify(storageStateFromToken(token), null, 2)}\n`);
  console.log(`Wrote storage state: ${runtime.storageStatePath}`);
}

function buildIndexMarkdown(manifest) {
  const okEntries = manifest.filter((entry) => entry.status === "ok");
  const grouped = new Map();
  for (const entry of okEntries) {
    const category = entry.local_path.split("/")[0];
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category).push(entry);
  }

  const lines = [`# SaDuck ${runtime.preset.name}索引`, ""];
  for (const category of [...grouped.keys()].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))) {
    lines.push(`## ${category}`, "");
    for (const entry of grouped.get(category).sort((a, b) => a.local_path.localeCompare(b.local_path, "zh-Hans-CN"))) {
      lines.push(`- [${entry.title}](${entry.local_path})`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

async function runLogin() {
  await fs.mkdir(runtime.outputDir, { recursive: true });
  const context = await launchContext({ headed: true });
  const page = context.pages()[0] ?? (await context.newPage());
  try {
    await page.goto(runtime.preset.entryUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (error) {
    console.log("目标页自动打开失败，但浏览器会保持打开。你可以手动访问目标站点并完成登录。");
    console.log(error instanceof Error ? error.message : String(error));
  }

  console.log("浏览器已打开。请在弹出的窗口中完成登录，登录后关闭浏览器窗口。");
  console.log(`如需手动访问，请打开: ${runtime.preset.entryUrl}`);

  await new Promise((resolve) => {
    context.once("close", resolve);
    setInterval(() => {}, 60_000);
  });
}

async function printStatus() {
  const manifest = await readJsonIfExists(runtime.manifestPath);
  console.log(
    JSON.stringify(
      {
        preset: runtime.preset.id,
        output_dir: runtime.outputDir,
        profile_dir: runtime.profileDir,
        storage_state: runtime.storageStatePath,
        manifest_entries: manifest?.length ?? 0
      },
      null,
      2
    )
  );
}

async function main() {
  const mode = process.argv[2];
  if (mode === "login") {
    await runLogin();
    return;
  }
  if (mode === "scrape") {
    await scrapeAll();
    return;
  }
  if (mode === "auth-token") {
    await writeStorageStateFromToken();
    return;
  }
  if (mode === "status") {
    await printStatus();
    return;
  }

  console.error("Usage: node src/scrape-saduck.mjs <login|scrape|auth-token|status> [--preset xingce|shenlun] [--skip-profile-export]");
  process.exitCode = 1;
}

const options = parseOptions(process.argv.slice(3));
const runtime = buildRuntimeConfig(options);

await main();

src/tiku-auth.mjs

import fs from "node:fs/promises";

const SADUCK_ORIGIN = "https://saduck.top";

export async function readSaduckTokenFromStorageState(storageStatePath) {
  const storageState = JSON.parse(await fs.readFile(storageStatePath, "utf8"));
  const saduckOrigin = storageState.origins?.find((origin) => origin.origin === SADUCK_ORIGIN);
  const token = saduckOrigin?.localStorage?.find((entry) => entry.name === "token")?.value;

  if (!token) {
    throw new Error(`No saduck.top token found in ${storageStatePath}`);
  }

  return token;
}

src/tiku-crypto.mjs

import crypto from "node:crypto";

export const TIKU_REQUEST_KEY = "kxZ17XQ8z6957n3S";

function normalizeEncryptedBase64(value) {
  return value.replaceAll("-", "+").replaceAll("_", "/");
}

export function encryptSaduckValue(value, key = TIKU_REQUEST_KEY) {
  const cipher = crypto.createCipheriv("aes-128-ecb", Buffer.from(key, "utf8"), null);
  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final()
  ]);

  return encrypted.toString("base64").replaceAll("/", "_").replaceAll("+", "-");
}

export function decryptSaduckPayload(value, key) {
  const decipher = crypto.createDecipheriv("aes-128-ecb", Buffer.from(key, "utf8"), null);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(normalizeEncryptedBase64(value), "base64")),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

src/tiku-normalize.mjs

export function splitQuestionOptions(options) {
  if (Array.isArray(options)) {
    return options;
  }

  if (typeof options !== "string" || options.trim() === "") {
    return [];
  }

  return options.split("#").map((text, index) => ({
    label: String.fromCharCode(65 + index),
    value: String(index),
    text
  }));
}

function parseModelSections(model) {
  if (typeof model !== "string" || model.trim() === "") {
    return [];
  }

  try {
    return JSON.parse(model).map((section) => ({
      name: section.name,
      start: section.snum,
      end: section.enum
    }));
  } catch {
    return [];
  }
}

export function normalizeQuestion(question) {
  return {
    id: question.id,
    titleHtml: question.title ?? "",
    type: question.type ?? "",
    globalAccuracy: question.globalAccuracy ?? null,
    correctAnswer: question.correctAnswer ?? "",
    options: splitQuestionOptions(question.options),
    analysisHtml: question.analysis ?? "",
    source: question.source ?? "",
    tag: question.tag ?? "",
    materialHtml: question.material ?? "",
    userAnswer: question.userAnswer ?? null,
    memorize: question.memorize ?? null
  };
}

export function normalizePaper(paper, group) {
  return {
    id: paper.sid ?? paper.id,
    group,
    title: paper.source ?? "",
    type: paper.type ?? null,
    difficulty: paper.difficulty ?? null,
    fraction: paper.fraction ?? null,
    sections: parseModelSections(paper.model)
  };
}

export function normalizeTagTree(nodes) {
  return (nodes ?? []).map((node) => ({
    id: node.id,
    name: node.id,
    count: node.count ?? 0,
    children: normalizeTagTree(node.children ?? [])
  }));
}

src/scrape-tiku.mjs

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readSaduckTokenFromStorageState } from "./tiku-auth.mjs";
import {
  decryptSaduckPayload,
  encryptSaduckValue
} from "./tiku-crypto.mjs";
import {
  normalizePaper,
  normalizeQuestion,
  normalizeTagTree
} from "./tiku-normalize.mjs";

const SITE_ORIGIN = "https://saduck.top";
const API_ORIGIN = `${SITE_ORIGIN}/api`;
const ITEMIZES_KEY = "7SyqrN6925ZYb636";

export function parseTikuOptions(argv) {
  const options = {
    allPapers: false,
    samplePapers: 1
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--all-papers") {
      options.allPapers = true;
    } else if (token === "--sample-papers") {
      options.samplePapers = Number.parseInt(argv[index + 1], 10);
      index += 1;
    }
  }

  if (!Number.isInteger(options.samplePapers) || options.samplePapers < 1) {
    throw new Error("--sample-papers must be a positive integer");
  }

  return options;
}

export function buildTikuRuntimeConfig({ cwd, allPapers, samplePapers }) {
  const outputDir = path.join(cwd, "saduck-tiku-json");
  return {
    allPapers,
    samplePapers,
    outputDir,
    papersDir: path.join(outputDir, "papers"),
    samplesDir: path.join(outputDir, "samples"),
    manifestPath: path.join(outputDir, "manifest.json"),
    paperIndexPath: path.join(outputDir, "papers", "index.json"),
    tagTreePath: path.join(outputDir, "tags.json"),
    storageStatePath: path.join(cwd, "saduck-xingce-md", "storage-state.json")
  };
}

async function writeJsonFile(targetPath, value) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function postApi(pathname, body, token) {
  const response = await fetch(`${API_ORIGIN}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { token } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok()) {
    throw new Error(`HTTP ${response.status} from ${pathname}`);
  }

  const payload = await response.json();
  if (payload.code !== 0) {
    throw new Error(`SaDuck API ${pathname} failed with code ${payload.code}: ${payload.message ?? ""}`.trim());
  }

  return payload.result;
}

function flattenPapers(groups) {
  return groups.flatMap((group) =>
    (group.tkSources ?? []).map((paper) => normalizePaper(paper, group.title ?? group.id ?? ""))
  );
}

function firstPracticeLeaf(nodes) {
  for (const node of nodes ?? []) {
    if (node.children?.length) {
      const found = firstPracticeLeaf(node.children);
      if (found) {
        return found;
      }
    } else if ((node.count ?? 0) >= 5) {
      return node;
    }
  }
  return null;
}

async function fetchPaperQuestions(paper, token) {
  const questions = await postApi("/tk/sourceInfo", { id: encryptSaduckValue(paper.id) }, token);
  return {
    ...paper,
    questions: (questions ?? []).map(normalizeQuestion)
  };
}

async function exportTiku(config) {
  const token = await readSaduckTokenFromStorageState(config.storageStatePath);
  await fs.mkdir(config.outputDir, { recursive: true });

  const encryptedItemizes = await postApi("/tk/itemizes?type=1", {}, null);
  const itemizeGroups = decryptSaduckPayload(encryptedItemizes, ITEMIZES_KEY);
  const papers = flattenPapers(itemizeGroups);

  const tagTreeRaw = await postApi("/tk/problemTagNew?type=1", {}, token);
  const tagTree = normalizeTagTree(tagTreeRaw);
  const sampleLeaf = firstPracticeLeaf(tagTreeRaw);
  const samplePractice = sampleLeaf
    ? await postApi("/tk/tagInfo", { reqs: [{ name: sampleLeaf.id, num: 5 }], difficulty: null }, token)
    : null;

  const papersToExport = config.allPapers ? papers : papers.slice(0, config.samplePapers);
  const exportedPapers = [];
  for (const paper of papersToExport) {
    const paperWithQuestions = await fetchPaperQuestions(paper, token);
    const paperPath = path.join(config.papersDir, `${paper.id}.json`);
    await writeJsonFile(paperPath, paperWithQuestions);
    exportedPapers.push({
      id: paper.id,
      title: paper.title,
      group: paper.group,
      question_count: paperWithQuestions.questions.length,
      local_path: path.posix.join("papers", `${paper.id}.json`)
    });
  }

  await writeJsonFile(config.paperIndexPath, {
    source_url: `${SITE_ORIGIN}/questionBank/overTheYears.html`,
    total_papers: papers.length,
    exported_papers: exportedPapers,
    papers
  });

  await writeJsonFile(config.tagTreePath, {
    source_url: `${SITE_ORIGIN}/questionBank/specialProject.html`,
    tags: tagTree
  });

  if (samplePractice) {
    await writeJsonFile(path.join(config.samplesDir, "special-practice.json"), {
      source_endpoint: "/api/tk/tagInfo",
      selected_tag: sampleLeaf.id,
      test_name: samplePractice.testName,
      model: samplePractice.tl ?? null,
      questions: (samplePractice.resps ?? []).map(normalizeQuestion)
    });
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    source_origin: SITE_ORIGIN,
    output_dir: config.outputDir,
    mode: config.allPapers ? "all-papers" : "sample",
    total_papers: papers.length,
    exported_papers: exportedPapers.length,
    tag_top_level_count: tagTree.length,
    files: [
      "papers/index.json",
      "tags.json",
      ...(samplePractice ? ["samples/special-practice.json"] : []),
      ...exportedPapers.map((paper) => paper.local_path)
    ]
  };
  await writeJsonFile(config.manifestPath, manifest);

  return manifest;
}

async function main() {
  const options = parseTikuOptions(process.argv.slice(2));
  const config = buildTikuRuntimeConfig({ cwd: process.cwd(), ...options });
  const manifest = await exportTiku(config);
  console.log(
    JSON.stringify(
      {
        output_dir: manifest.output_dir,
        mode: manifest.mode,
        total_papers: manifest.total_papers,
        exported_papers: manifest.exported_papers,
        tag_top_level_count: manifest.tag_top_level_count
      },
      null,
      2
    )
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
