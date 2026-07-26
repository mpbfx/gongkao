import { describe, expect, it } from "vitest";

import { richHtmlToPlainText, sanitizeRichHtml, toRichHtml } from "./rich-html";

describe("sanitizeRichHtml", () => {
  it("移除不带引号的事件属性", () => {
    expect(sanitizeRichHtml("<img src=x onerror=alert(1)>")).not.toContain("onerror");
  });

  it("移除带引号的事件属性", () => {
    expect(sanitizeRichHtml('<p onclick="alert(1)">题干</p>')).toBe("<p>题干</p>");
  });

  it("移除 svg 与其事件属性", () => {
    const sanitized = sanitizeRichHtml("<svg onload=alert(1)></svg>");

    expect(sanitized).not.toContain("svg");
    expect(sanitized).not.toContain("onload");
  });

  it("移除 iframe 与 srcdoc", () => {
    const sanitized = sanitizeRichHtml('<iframe srcdoc="<script>alert(1)</script>"></iframe>');

    expect(sanitized).not.toContain("iframe");
    expect(sanitized).not.toContain("srcdoc");
  });

  it("移除 script 标签内容", () => {
    expect(sanitizeRichHtml("<p>a</p><script>alert(1)</script>")).toBe("<p>a</p>");
  });

  it("移除 javascript: 协议链接", () => {
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
  });

  it("移除内联样式，避免 CSS 注入", () => {
    expect(sanitizeRichHtml('<span style="color:red">x</span>')).toBe("<span>x</span>");
  });

  it("保留 MathML 公式结构与属性", () => {
    const html =
      '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>1</mn><mn>2</mn></mfrac>' +
      '<msqrt><mi mathvariant="normal">x</mi></msqrt></math>';
    const sanitized = sanitizeRichHtml(html);

    expect(sanitized).toContain("<math");
    expect(sanitized).toContain("<mfrac>");
    expect(sanitized).toContain("<msqrt>");
    expect(sanitized).toContain('mathvariant="normal"');
  });

  it("保留题干常用排版标签", () => {
    const html = "<p>下列<u>说法</u><b>正确</b>的是<br></p>";

    expect(sanitizeRichHtml(html)).toBe(html);
  });

  it("保留表格结构", () => {
    expect(sanitizeRichHtml("<table><tr><td>甲</td></tr></table>")).toContain("<td>甲</td>");
  });

  it("把协议相对图片地址升级为 https 并补齐安全属性", () => {
    const sanitized = sanitizeRichHtml('<img src="//cdn.example.com/a.png" width="100">');

    expect(sanitized).toContain('src="https://cdn.example.com/a.png"');
    expect(sanitized).toContain('width="100"');
    expect(sanitized).toContain('loading="lazy"');
    expect(sanitized).toContain('referrerpolicy="no-referrer"');
    expect(sanitized).toContain('alt=""');
  });

  it("不覆盖图片已有的 alt 与 loading", () => {
    const sanitized = sanitizeRichHtml('<img src="https://a.com/b.png" alt="图" loading="eager">');

    expect(sanitized).toContain('alt="图"');
    expect(sanitized).toContain('loading="eager"');
  });

  it("移除 data: 图片地址", () => {
    expect(sanitizeRichHtml('<img src="data:image/svg+xml,<svg onload=alert(1)>">')).not.toContain(
      "data:"
    );
  });

  it("重复消毒结果稳定", () => {
    const html = '<p>题干<img src="//cdn.example.com/a.png"></p>';
    const once = sanitizeRichHtml(html);

    expect(sanitizeRichHtml(once)).toBe(once);
  });

  it("空值透传", () => {
    expect(sanitizeRichHtml(null)).toBeNull();
    expect(sanitizeRichHtml(undefined)).toBeNull();
    expect(sanitizeRichHtml("")).toBe("");
  });
});

describe("toRichHtml", () => {
  it("纯文本补齐段落包裹", () => {
    expect(toRichHtml("这是题干")).toBe("<p>这是题干</p>");
  });

  it("已有标签时不重复包裹", () => {
    expect(toRichHtml("<p>这是题干</p>")).toBe("<p>这是题干</p>");
  });

  it("先消毒再判断是否需要包裹", () => {
    expect(toRichHtml("<script>alert(1)</script>纯文本")).toBe("<p>纯文本</p>");
  });
});

describe("richHtmlToPlainText", () => {
  it("提取纯文本用于检索", () => {
    expect(richHtmlToPlainText("<p>下列<u>说法</u>正确</p>")).toBe("下列说法正确");
  });

  it("空值返回空串", () => {
    expect(richHtmlToPlainText(null)).toBe("");
  });
});
