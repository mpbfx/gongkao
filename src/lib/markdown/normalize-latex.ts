const codeFragmentPattern = /(```[\s\S]*?```|`[^`\n]*`)/g;

/**
 * Normalize model LaTeX into Streamdown/KaTeX-friendly delimiters.
 * Keeps code fences and inline code untouched.
 */
export function normalizeLatexDelimiters(content: string) {
  return content
    .split(codeFragmentPattern)
    .map((fragment, index) => {
      if (index % 2 === 1) {
        return fragment;
      }

      return fragment
        // Display / inline paren delimiters
        .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula: string) => `$$${formula.trim()}$$`)
        .replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula: string) => `$${formula.trim()}$`)
        // Bare common arrows outside math often appear in tutor notes
        .replace(/(?<!\$)\\rightarrow(?!\$)/g, "$\\rightarrow$")
        .replace(/(?<!\$)\\Rightarrow(?!\$)/g, "$\\Rightarrow$")
        .replace(/(?<!\$)\\to(?![a-zA-Z])(?!\$)/g, "$\\to$")
        // Collapse accidental nested dollars around a simple command: $\rightarrow$ already fine
        .replace(/\$\$+/g, (match) => (match.length % 2 === 0 ? "$$" : "$"));
    })
    .join("");
}
