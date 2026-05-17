export function stripHtml(value?: string | null) {
  return (
    value
      ?.replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

export function truncateText(value: string, maxLength = 2400) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

