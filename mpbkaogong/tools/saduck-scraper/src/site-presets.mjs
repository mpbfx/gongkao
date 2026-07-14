export const SITE_ORIGIN = "https://saduck.top";

const PRESETS = {
  xingce: {
    id: "xingce",
    name: "行测",
    entryUrl: `${SITE_ORIGIN}/%E8%B5%84%E6%96%99%E5%88%86%E6%9E%90/%E8%B5%84%E6%96%99%E8%AF%B4%E6%98%8E.html`,
    allowedPrefixes: [
      "/资料分析/",
      "/言语理解/",
      "/数量关系/",
      "/常识判断/",
      "/判断推理/"
    ]
  },
  shenlun: {
    id: "shenlun",
    name: "申论",
    entryUrl: `${SITE_ORIGIN}/%E7%94%B3%E8%AE%BA/%E4%BB%80%E4%B9%88%E6%98%AF%E7%94%B3%E8%AE%BA.html`,
    allowedPrefixes: ["/申论/"]
  }
};

export function canonicalizeAllowedPrefix(value) {
  const trimmed = decodeURIComponent(value)
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  return `/${trimmed}/`;
}

export function getPreset(id = "xingce") {
  const preset = PRESETS[id];
  if (!preset) {
    throw new Error(`Unknown preset: ${id}`);
  }

  return {
    ...preset,
    allowedPrefixes: preset.allowedPrefixes.map(canonicalizeAllowedPrefix)
  };
}

export function buildOutputDirName({ id }) {
  return `saduck-${id}-md`;
}

export function getAllPresets() {
  return Object.keys(PRESETS);
}
