export function cleanLearningTitle(title: string) {
  const cleaned = title.replace(/^\s*P\d+\s+/, "").trim();

  return cleaned.length > 0 ? cleaned : title;
}
