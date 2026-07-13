const codeFragmentPattern = /(```[\s\S]*?```|`[^`\n]*`)/g;

export function normalizeLatexDelimiters(content: string) {
  return content
    .split(codeFragmentPattern)
    .map((fragment, index) => {
      if (index % 2 === 1) return fragment;

      return fragment
        .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula: string) => `$$${formula}$$`)
        .replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula: string) => `$${formula}$`);
    })
    .join("");
}
