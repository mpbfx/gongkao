function firstPresent(source, keys, fallback = null) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return fallback;
}

export function normalizeOptions(rawOptions) {
  if (Array.isArray(rawOptions)) {
    return rawOptions.map((option, index) => ({
      label: option.label ?? String.fromCharCode(65 + index),
      value: String(option.value ?? index),
      text: String(option.text ?? option.content ?? option.title ?? option)
    }));
  }

  if (typeof rawOptions === "string") {
    return rawOptions
      .split("#")
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, index) => ({
        label: String.fromCharCode(65 + index),
        value: String(index),
        text
      }));
  }

  return [];
}

export function normalizeQuestion(raw, context = {}) {
  return {
    id: firstPresent(raw, ["id", "qid", "questionId"]),
    titleHtml: firstPresent(raw, ["titleHtml", "title", "question", "content"], ""),
    type: firstPresent(raw, ["type", "questionType", "tkType"], "single"),
    globalAccuracy: firstPresent(raw, ["globalAccuracy", "accuracy", "rightRate"], ""),
    correctAnswer: String(firstPresent(raw, ["correctAnswer", "answer", "rightAnswer"], "")),
    options: normalizeOptions(firstPresent(raw, ["options", "option", "answers"], "")),
    analysisHtml: firstPresent(raw, ["analysisHtml", "analysis", "explain", "parse"], ""),
    source: firstPresent(raw, ["source"], context.source ?? ""),
    tag: firstPresent(raw, ["tag", "tagName", "category"], context.tag ?? ""),
    materialHtml: firstPresent(raw, ["materialHtml", "material", "materials"], context.materialHtml ?? ""),
    userAnswer: firstPresent(raw, ["userAnswer"], null),
    memorize: firstPresent(raw, ["memorize"], null)
  };
}

export function normalizePaper(rawPaper, meta = {}) {
  const questions = Array.isArray(rawPaper)
    ? rawPaper
    : firstPresent(rawPaper, ["questions", "list", "tkList", "result"], []);
  const source = firstPresent(rawPaper, ["source", "title", "name"], meta.source ?? "");
  return {
    id: firstPresent(rawPaper, ["id", "sid"], meta.id ?? null),
    sid: firstPresent(rawPaper, ["sid", "id"], meta.sid ?? null),
    source,
    model: firstPresent(rawPaper, ["model"], meta.model ?? null),
    questions: Array.isArray(questions)
      ? questions.map((question) => normalizeQuestion(question, { source }))
      : []
  };
}

export function normalizePaperIndex(rawIndex) {
  const groups = Array.isArray(rawIndex) ? rawIndex : [];
  return groups.map((group) => ({
    id: group.id,
    title: group.title ?? group.name ?? "",
    tkSources: Array.isArray(group.tkSources)
      ? group.tkSources.map((source) => ({
          id: source.id,
          sid: source.sid,
          source: source.source ?? source.title ?? source.name ?? "",
          difficulty: source.difficulty ?? null,
          model: source.model ?? null
        }))
      : []
  }));
}

export function flattenPaperIndex(index) {
  return index.flatMap((group) =>
    group.tkSources.map((source) => ({
      groupId: group.id,
      groupTitle: group.title,
      ...source
    }))
  );
}

export function normalizeTagTree(rawTags) {
  return Array.isArray(rawTags) ? rawTags : [];
}
