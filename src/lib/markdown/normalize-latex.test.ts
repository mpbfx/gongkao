import { describe, expect, it } from "vitest";

import { normalizeLatexDelimiters } from "@/lib/markdown/normalize-latex";

describe("normalizeLatexDelimiters", () => {
  it("converts common inline and display LaTeX delimiters", () => {
    expect(normalizeLatexDelimiters("行内 \\(x+1\\)，块级 \\[x^2=4\\]")).toBe(
      "行内 $x+1$，块级 $$x^2=4$$"
    );
  });

  it("does not rewrite delimiters inside code", () => {
    expect(normalizeLatexDelimiters("`\\(code\\)` 和 \\(math\\)")).toBe(
      "`\\(code\\)` 和 $math$"
    );
  });

  it("wraps bare arrow commands for KaTeX", () => {
    expect(normalizeLatexDelimiters("左图昼更长 \\rightarrow 纬度更高")).toBe(
      "左图昼更长 $\\rightarrow$ 纬度更高"
    );
    expect(normalizeLatexDelimiters("已有 $\\rightarrow$ 保持")).toBe(
      "已有 $\\rightarrow$ 保持"
    );
  });
});
