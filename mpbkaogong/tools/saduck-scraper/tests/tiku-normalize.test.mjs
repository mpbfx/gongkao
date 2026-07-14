import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOptions, normalizePaper, normalizeQuestion } from "../src/tiku-normalize.mjs";

test("splits hash-delimited options", () => {
  assert.deepEqual(normalizeOptions("甲#乙#丙"), [
    { label: "A", value: "0", text: "甲" },
    { label: "B", value: "1", text: "乙" },
    { label: "C", value: "2", text: "丙" }
  ]);
});

test("normalizes question fields", () => {
  assert.deepEqual(normalizeQuestion({
    id: 23491,
    title: "<p>题干</p>",
    answer: 3,
    option: "A项#B项",
    analysis: "<p>解析</p>"
  }), {
    id: 23491,
    titleHtml: "<p>题干</p>",
    type: "single",
    globalAccuracy: "",
    correctAnswer: "3",
    options: [
      { label: "A", value: "0", text: "A项" },
      { label: "B", value: "1", text: "B项" }
    ],
    analysisHtml: "<p>解析</p>",
    source: "",
    tag: "",
    materialHtml: "",
    userAnswer: null,
    memorize: null
  });
});

test("normalizes paper with question list", () => {
  const paper = normalizePaper({ sid: "s1", source: "试卷", questions: [{ id: 1, option: "A#B" }] });
  assert.equal(paper.sid, "s1");
  assert.equal(paper.questions.length, 1);
  assert.equal(paper.questions[0].source, "试卷");
});
