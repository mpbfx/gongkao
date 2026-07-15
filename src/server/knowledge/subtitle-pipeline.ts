import { createHash } from "node:crypto";

import { distance } from "fastest-levenshtein";
import SrtParser2 from "srt-parser-2";

export type SubtitleCue = {
  rawText: string;
  cleanText: string;
  startMs: number;
  endMs: number;
};

export type SubtitleChunkDraft = SubtitleCue & {
  chunkNo: number;
  contentHash: string;
  vectorPointId: string;
};

const musicOnlyPattern = /^(?:[♪♫♬🎵🎶\s]|\[(?:音乐|music)\]|【(?:音乐|music)】)+$/iu;
const musicWrappedPattern = /^[♪♫♬🎵🎶].*[♪♫♬🎵🎶]$/u;

export function normalizeSubtitleText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{\\[^}]+}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMusicCue(value: string) {
  const normalized = normalizeSubtitleText(value);
  return musicOnlyPattern.test(normalized) || musicWrappedPattern.test(normalized);
}

function similarity(left: string, right: string) {
  const longest = Math.max(left.length, right.length);
  return longest === 0 ? 1 : 1 - distance(left, right) / longest;
}

function chooseMergedText(left: SubtitleCue, right: SubtitleCue) {
  const leftText = left.cleanText.replace(/\s+/g, "");
  const rightText = right.cleanText.replace(/\s+/g, "");
  const contained = leftText.includes(rightText) || rightText.includes(leftText);
  const ratio = Math.min(leftText.length, rightText.length) / Math.max(leftText.length, rightText.length, 1);
  const nearDuplicate = similarity(leftText, rightText) >= 0.88 || (contained && ratio >= 0.6);

  if (!nearDuplicate || right.startMs - left.endMs > 2_000) return null;
  return right.cleanText.length >= left.cleanText.length ? right : left;
}

export function parseAndCleanSrt(value: string) {
  const parser = new SrtParser2();
  const parsed = parser.fromSrt(value);
  const cues: SubtitleCue[] = [];

  for (const item of parsed) {
    const rawText = item.text.trim();
    const cleanText = normalizeSubtitleText(rawText);
    if (!cleanText || isMusicCue(rawText)) continue;

    const next: SubtitleCue = {
      rawText,
      cleanText,
      startMs: Math.round(item.startSeconds * 1_000),
      endMs: Math.round(item.endSeconds * 1_000),
    };
    const previous = cues.at(-1);

    if (previous?.cleanText === next.cleanText && next.startMs - previous.endMs <= 2_000) {
      previous.endMs = Math.max(previous.endMs, next.endMs);
      continue;
    }

    if (previous) {
      const preferred = chooseMergedText(previous, next);
      if (preferred) {
        previous.rawText = preferred.rawText;
        previous.cleanText = preferred.cleanText;
        previous.endMs = Math.max(previous.endMs, next.endMs);
        continue;
      }
    }

    cues.push(next);
  }

  return cues;
}

function chunkHash(bvid: string, partNo: number, chunk: SubtitleCue) {
  return createHash("sha256")
    .update(`${bvid}\n${partNo}\n${chunk.startMs}\n${chunk.endMs}\n${chunk.cleanText}`)
    .digest("hex");
}

export function vectorPointIdFromHash(hash: string) {
  const value = hash.slice(0, 32).split("");
  value[12] = "4";
  value[16] = ((Number.parseInt(value[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const joined = value.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

export function buildSubtitleChunks(
  cues: SubtitleCue[],
  { bvid, partNo, targetCharacters = 450, maxCharacters = 800, overlapCharacters = 60, maxGapMs = 20_000 }:
  { bvid: string; partNo: number; targetCharacters?: number; maxCharacters?: number; overlapCharacters?: number; maxGapMs?: number }
) {
  const chunks: SubtitleCue[] = [];
  let current: SubtitleCue[] = [];

  function characterCount(values: SubtitleCue[]) {
    return values.reduce((total, item) => total + item.cleanText.length + 1, 0);
  }

  function flush(keepOverlap: boolean) {
    if (current.length === 0) return;
    chunks.push({
      rawText: current.map((item) => item.rawText).join("\n"),
      cleanText: current.map((item) => item.cleanText).join(" "),
      startMs: current[0]!.startMs,
      endMs: current.at(-1)!.endMs,
    });

    if (!keepOverlap) {
      current = [];
      return;
    }

    const overlap: SubtitleCue[] = [];
    let size = 0;
    for (const cue of [...current].reverse()) {
      if (overlap.length > 0 && size + cue.cleanText.length > overlapCharacters) break;
      overlap.unshift(cue);
      size += cue.cleanText.length;
    }
    current = overlap;
  }

  for (const cue of cues) {
    const previous = current.at(-1);
    if (previous && cue.startMs - previous.endMs > maxGapMs) flush(false);

    const nextSize = characterCount(current) + cue.cleanText.length + 1;
    if (current.length > 0 && (nextSize > maxCharacters || (characterCount(current) >= targetCharacters && nextSize > targetCharacters))) {
      flush(true);
    }
    current.push(cue);
  }
  flush(false);

  return chunks.map((chunk, index): SubtitleChunkDraft => {
    const contentHash = chunkHash(bvid, partNo, chunk);
    return {
      ...chunk,
      chunkNo: index + 1,
      contentHash,
      vectorPointId: vectorPointIdFromHash(contentHash),
    };
  });
}

export function sourceContentHash(value: string) {
  return createHash("sha256").update(value.normalize("NFC")).digest("hex");
}
