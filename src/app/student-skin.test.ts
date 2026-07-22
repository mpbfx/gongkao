import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { practiceOptionButtonClassName } from "@/features/practice/practice-view-utils";

const globalsCss = readFileSync(resolve(import.meta.dirname, "globals.css"), "utf8");
const shellFrame = readFileSync(
  resolve(import.meta.dirname, "../components/layout/app-shell-frame.tsx"),
  "utf8"
);
const practiceRunner = readFileSync(
  resolve(import.meta.dirname, "../features/practice/practice-runner.tsx"),
  "utf8"
);

describe("student editorial skin contract", () => {
  it("exposes unified paper tokens and sharp component radius in student shell", () => {
    expect(globalsCss).toContain("--paper-desk:");
    expect(globalsCss).toContain("--paper-surface:");
    expect(globalsCss).toContain("--paper-sheet:");
    expect(globalsCss).toMatch(/\.student-shell-v2\s*\{[\s\S]*?--radius:\s*0\.15rem;/);
    expect(globalsCss).toContain('.student-shell-v2 [data-slot="button"]');
    expect(globalsCss).toContain('.student-shell-v2 [data-slot="card"]');
    expect(globalsCss).toContain("border-radius: var(--radius)");
    // Shell must not force a fixed desktop min-width (layout hard-scroll).
    expect(globalsCss).not.toMatch(/\.student-shell-v2\s*\{[^}]*min-width:\s*64rem/);
    expect(globalsCss).not.toContain("feTurbulence");
  });

  it("keeps practice workspace on the same paper desk color as the shell", () => {
    expect(globalsCss).toContain("background: var(--paper-desk)");
    expect(globalsCss).toContain("background-color: var(--paper-sheet)");
    expect(globalsCss).not.toMatch(/\.practice-workspace\s*\{[^}]*#ecebe6/);
  });

  it("keeps the original editorial spine density and brand block", () => {
    expect(shellFrame).toContain("min-h-[5.35rem]");
    expect(shellFrame).toContain("h-[7.25rem]");
    expect(shellFrame).toContain("STUDY FILE");
    expect(shellFrame).toContain("公考提分研究院");
    expect(globalsCss).toContain("linear-gradient(145deg, #e04d2c, #b93121)");
  });

  it("ships practice options through the paper-list class helper", () => {
    expect(practiceRunner).toContain("practiceOptionButtonClassName");
    expect(practiceRunner).not.toMatch(
      /flex min-h-12 w-full items-start gap-3 rounded-lg border bg-card/
    );

    const selected = practiceOptionButtonClassName("selected");
    expect(selected).toContain("practice-option-row");
    expect(selected).toContain("bg-transparent");
    expect(selected).not.toContain("rounded-lg");
  });
});
