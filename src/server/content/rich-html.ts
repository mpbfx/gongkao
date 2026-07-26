import type { Element, Nodes, Parents } from "hast";
import { fromHtml } from "hast-util-from-html";
import { defaultSchema, sanitize, type Schema } from "hast-util-sanitize";
import { toHtml } from "hast-util-to-html";

/**
 * 题库富文本（题干、材料、选项、解析）统一的消毒与规范化入口。
 *
 * 题库内容来自第三方抓取与管理端录入，必须视为不可信输入；页面通过
 * dangerouslySetInnerHTML 渲染，所以写入与读取两侧都要经过本模块。
 */

/** 题库大量使用 MathML 表达公式，白名单必须覆盖，否则数学题会被清空。 */
const MATHML_TAG_NAMES = [
  "annotation",
  "maction",
  "math",
  "merror",
  "mfrac",
  "mi",
  "mmultiscripts",
  "mn",
  "mo",
  "mover",
  "mpadded",
  "mphantom",
  "mprescripts",
  "mroot",
  "mrow",
  "ms",
  "mspace",
  "msqrt",
  "mstyle",
  "msub",
  "msubsup",
  "msup",
  "mtable",
  "mtd",
  "mtext",
  "mtr",
  "munder",
  "munderover",
  "semantics",
];

const MATHML_COMMON_ATTRIBUTES = ["displaystyle", "mathvariant", "scriptlevel"];

/**
 * 基于 hast 默认（GitHub）白名单裁剪：
 * - 去掉 `input`，题库内容不需要表单控件；
 * - 补上 `u`/`font` 等抓取内容里实际出现的排版标签与 MathML；
 * - 不放行 `style`，避免 CSS 注入与布局破坏。
 */
export const richHtmlSchema: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []).filter((tagName) => tagName !== "input"),
    ...MATHML_TAG_NAMES,
    "u",
    "font",
    "caption",
    "colgroup",
    "col",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className"],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "decoding",
      "loading",
      "referrerPolicy",
    ],
    math: ["xmlns", "display", ...MATHML_COMMON_ATTRIBUTES],
    mi: [...MATHML_COMMON_ATTRIBUTES],
    mo: ["fence", "separator", "stretchy", ...MATHML_COMMON_ATTRIBUTES],
    mn: [...MATHML_COMMON_ATTRIBUTES],
    mrow: [...MATHML_COMMON_ATTRIBUTES],
    mfrac: ["linethickness", ...MATHML_COMMON_ATTRIBUTES],
    mspace: ["depth", "height", "width"],
    mstyle: [...MATHML_COMMON_ATTRIBUTES],
    mtable: ["columnalign", "rowalign", ...MATHML_COMMON_ATTRIBUTES],
    mtd: ["columnalign", "columnspan", "rowspan"],
    annotation: ["encoding"],
    font: ["color", "face", "size"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https"],
  },
};

function isElement(node: Nodes): node is Element {
  return node.type === "element";
}

/**
 * 抓取内容里的图片大量使用协议相对地址（`//host/path`）。消毒本身放行这类
 * 地址，这里统一升级为 https，并补齐懒加载与防泄漏 referrer 的属性。
 */
function normalizeImage(node: Element) {
  const properties = node.properties ?? (node.properties = {});
  const src = properties.src;

  if (typeof src === "string" && src.startsWith("//")) {
    properties.src = `https:${src}`;
  }

  properties.loading ??= "lazy";
  properties.decoding ??= "async";
  properties.referrerPolicy ??= "no-referrer";
  properties.alt ??= "";
}

function normalizeTree(node: Nodes) {
  if (!("children" in node)) {
    return;
  }

  for (const child of (node as Parents).children) {
    if (isElement(child)) {
      if (child.tagName === "img") {
        normalizeImage(child);
      }

      normalizeTree(child);
    }
  }
}

/**
 * 解析 → 白名单消毒 → 图片规范化 → 序列化。
 *
 * 相比正则黑名单，这里按标签与属性白名单工作，无引号事件属性、`<svg onload>`、
 * `<iframe srcdoc>`、`javascript:` 链接等绕过手法都会被移除。
 */
export function sanitizeRichHtml(html: string): string;
export function sanitizeRichHtml(html: string | null | undefined): string | null;
export function sanitizeRichHtml(html: string | null | undefined) {
  if (html === null || html === undefined) {
    return null;
  }

  if (html.length === 0) {
    return "";
  }

  const tree = sanitize(fromHtml(html, { fragment: true }), richHtmlSchema);

  normalizeTree(tree);

  return toHtml(tree);
}

/** 管理端录入允许纯文本，缺少标签时补一层段落包裹。 */
export function toRichHtml(value: string) {
  const sanitized = sanitizeRichHtml(value.trim());

  if (/<[a-z][\s\S]*>/i.test(sanitized)) {
    return sanitized;
  }

  return `<p>${sanitized}</p>`;
}

/** 生成检索用纯文本，与富文本存储保持同一入口。 */
export function richHtmlToPlainText(html?: string | null) {
  if (!html) {
    return "";
  }

  return sanitizeRichHtml(html)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}
