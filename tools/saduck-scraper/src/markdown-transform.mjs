import path from "node:path";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm, tables } from "turndown-plugin-gfm";
import { SITE_ORIGIN } from "./site-presets.mjs";

const DEFAULT_ALLOWED_CATEGORIES = new Set([
  "资料分析",
  "言语理解",
  "数量关系",
  "常识判断",
  "判断推理",
  "申论"
]);

export function decodePathname(urlPath) {
  return decodeURIComponent(urlPath).replace(/^\/+/, "");
}

export function categoryFromPath(urlPath) {
  return decodePathname(urlPath).split("/")[0] || "";
}

export function localMarkdownPathFromUrlPath(urlPath) {
  const decoded = decodePathname(urlPath);
  return decoded.replace(/\.(html|md)$/i, ".md");
}

export function absoluteSiteUrl(href) {
  return new URL(href, SITE_ORIGIN).toString();
}

export function relativeMarkdownLink({
  fromPath,
  targetUrl,
  allowedCategories = DEFAULT_ALLOWED_CATEGORIES
}) {
  const absolute = new URL(targetUrl, SITE_ORIGIN);
  if (absolute.origin !== SITE_ORIGIN) {
    return targetUrl;
  }

  const category = categoryFromPath(absolute.pathname);
  const isDoc = /\.(html|md)$/i.test(absolute.pathname);
  if (!allowedCategories.has(category) || !isDoc) {
    return absolute.toString();
  }

  const targetPath = localMarkdownPathFromUrlPath(absolute.pathname);
  const fromDir = path.posix.dirname(fromPath);
  const relative = path.posix.relative(fromDir, targetPath) || path.posix.basename(targetPath);
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function normalizeWhitespace(markdown) {
  return `${markdown
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

function frontmatterString(fields) {
  return [
    "---",
    `title: ${JSON.stringify(fields.title)}`,
    `source_url: ${JSON.stringify(fields.sourceUrl)}`,
    `category: ${JSON.stringify(fields.category)}`,
    `slug: ${JSON.stringify(fields.slug)}`,
    `fetched_at: ${JSON.stringify(fields.fetchedAt)}`,
    "---",
    ""
  ].join("\n");
}

function createTurndownService({ localMarkdownPath, assetPathForUrl, allowedCategories }) {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*"
  });

  service.use([gfm, tables]);
  service.keep(["table", "thead", "tbody", "tr", "th", "td"]);

  service.addRule("removeEmptyCommentArtifacts", {
    filter: (node) => node.nodeType === 8,
    replacement: () => ""
  });

  service.addRule("siteLinks", {
    filter: (node) => node.nodeName === "A" && node.getAttribute("href"),
    replacement: (content, node) => {
      const href = node.getAttribute("href");
      const absolute = new URL(href, SITE_ORIGIN);
      const normalized =
        absolute.origin === SITE_ORIGIN
          ? relativeMarkdownLink({
              fromPath: localMarkdownPath,
              targetUrl: absolute.toString(),
              allowedCategories
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

      const absolute = new URL(src, SITE_ORIGIN).toString();
      const assetPath = assetPathForUrl(absolute);
      const target = assetPath
        ? path.posix.relative(path.posix.dirname(localMarkdownPath), assetPath)
        : absolute;
      const alt = node.getAttribute("alt") || "";
      return `![${alt}](${target})`;
    }
  });

  return service;
}

export function cleanDocHtml(html) {
  const dom = new JSDOM(`<main>${html}</main>`);
  const doc = dom.window.document;

  doc.querySelectorAll([
    "script",
    "style",
    "button",
    "svg",
    ".header-anchor",
    ".word",
    ".wordC",
    ".edit-info",
    ".last-updated",
    ".VPDocFooter",
    ".VPLocalNav",
    ".outline-link",
    ".outline-marker"
  ].join(",")).forEach((node) => node.remove());

  for (const anchor of doc.querySelectorAll("a[href]")) {
    anchor.setAttribute("href", new URL(anchor.getAttribute("href"), SITE_ORIGIN).toString());
  }

  for (const image of doc.querySelectorAll("img[src]")) {
    image.setAttribute("src", new URL(image.getAttribute("src"), SITE_ORIGIN).toString());
  }

  return doc.querySelector("main").innerHTML;
}

export async function htmlToMarkdown({
  html,
  pageUrl,
  localMarkdownPath,
  assetPathForUrl = () => null,
  allowedCategories = DEFAULT_ALLOWED_CATEGORIES,
  fetchedAt = new Date().toISOString()
}) {
  const cleanHtml = cleanDocHtml(html);
  const dom = new JSDOM(`<body>${cleanHtml}</body>`);
  const doc = dom.window.document;
  const title = doc.querySelector("h1")?.textContent?.trim() || "";
  const service = createTurndownService({
    localMarkdownPath,
    assetPathForUrl,
    allowedCategories
  });
  const bodyMarkdown = normalizeWhitespace(service.turndown(doc.body.innerHTML));

  return frontmatterString({
    title,
    sourceUrl: pageUrl,
    category: categoryFromPath(new URL(pageUrl).pathname),
    slug: localMarkdownPath.replace(/\.md$/i, ""),
    fetchedAt
  }) + bodyMarkdown;
}
