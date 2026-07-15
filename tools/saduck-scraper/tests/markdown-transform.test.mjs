import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryFromPath,
  htmlToMarkdown,
  localMarkdownPathFromUrlPath,
  relativeMarkdownLink
} from "../src/markdown-transform.mjs";

test("maps SaDuck paths to local Markdown paths", () => {
  assert.equal(categoryFromPath("/%E8%B5%84%E6%96%99%E5%88%86%E6%9E%90/%E5%BC%80%E7%AF%87.html"), "资料分析");
  assert.equal(
    localMarkdownPathFromUrlPath("/%E8%B5%84%E6%96%99%E5%88%86%E6%9E%90/%E5%BC%80%E7%AF%87.html"),
    "资料分析/开篇.md"
  );
});

test("converts allowed site links to relative markdown links", () => {
  assert.equal(
    relativeMarkdownLink({
      fromPath: "资料分析/资料说明.md",
      targetUrl: "https://saduck.top/%E8%B5%84%E6%96%99%E5%88%86%E6%9E%90/%E5%BC%80%E7%AF%87.html"
    }),
    "./开篇.md"
  );
});

test("converts cleaned VitePress html to markdown with frontmatter and assets", async () => {
  const markdown = await htmlToMarkdown({
    html: `
      <h1 id="前言">前言 <a class="header-anchor" href="#前言">#</a></h1>
      <div class="word">字数: 10 字</div>
      <p><a href="/资料分析/开篇.html">开篇</a></p>
      <p><img src="/assets/demo.png" alt="图"></p>
    `,
    pageUrl: "https://saduck.top/%E8%B5%84%E6%96%99%E5%88%86%E6%9E%90/%E8%B5%84%E6%96%99%E8%AF%B4%E6%98%8E.html",
    localMarkdownPath: "资料分析/资料说明.md",
    fetchedAt: "2026-05-12T00:00:00.000Z",
    assetPathForUrl: () => "assets/资料分析/demo.png"
  });

  assert.match(markdown, /title: "前言"/);
  assert.match(markdown, /category: "资料分析"/);
  assert.doesNotMatch(markdown, /字数/);
  assert.match(markdown, /\[开篇\]\(\.\/开篇\.md\)/);
  assert.match(markdown, /!\[图\]\(\.\.\/assets\/资料分析\/demo\.png\)/);
});
