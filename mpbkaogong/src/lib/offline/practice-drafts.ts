import Dexie, { type Table } from "dexie";

export type PracticeSubmitDraft = {
  elapsedSeconds: number;
  pauseCount: number;
  pausedSeconds: number;
  answers: Array<{
    questionId: string;
    answer: string | null;
    timeSpentSeconds: number;
    decisionNote?: string | null;
  }>;
  events?: PracticeEventDraft[];
  savedAt: string;
};

export type PracticeEventDraft = {
  questionId?: string | null;
  type: "QUESTION_VIEW" | "ANSWER_CHANGE" | "SKIP" | "RETURN" | "PAUSE" | "RESUME" | "TIME_EXPIRED";
  occurredAt: string;
  payload?: Record<string, unknown> | null;
};

export type PracticeScratchDraft = {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  updatedAt: string;
};

export type PracticeDraft = {
  sessionId: string;
  currentIndex: number;
  answers: Record<string, string>;
  elapsedSeconds: number;
  timeSpentByQuestionId: Record<string, number>;
  decisionNotesByQuestionId?: Record<string, string>;
  pauseCount?: number;
  pausedSeconds?: number;
  events?: PracticeEventDraft[];
  timeExpired?: boolean;
  scratchByQuestionId: Record<string, PracticeScratchDraft>;
  pendingSubmit?: PracticeSubmitDraft | null;
  updatedAt: string;
};

class PracticeOfflineDatabase extends Dexie {
  practiceDrafts!: Table<PracticeDraft, string>;

  constructor() {
    super("saduck-practice-offline");

    this.version(1).stores({
      practiceDrafts: "sessionId, updatedAt",
    });
  }
}

let database: PracticeOfflineDatabase | null = null;
let storageUnavailable = false;

function disableStorage(error: unknown) {
  storageUnavailable = true;
  database?.close();
  database = null;
  console.warn("练习草稿的本机存储暂时不可用。", error);
}

function getDatabase() {
  if (typeof window === "undefined" || storageUnavailable) {
    return null;
  }

  database ??= new PracticeOfflineDatabase();
  return database;
}

export async function getPracticeDraft(sessionId: string) {
  const db = getDatabase();

  if (!db) {
    return null;
  }

  try {
    return await db.practiceDrafts.get(sessionId);
  } catch (error) {
    disableStorage(error);
    return null;
  }
}

export async function savePracticeDraft(draft: Omit<PracticeDraft, "updatedAt">) {
  const db = getDatabase();

  if (!db) {
    return;
  }

  try {
    await db.practiceDrafts.put({
      ...draft,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    disableStorage(error);
  }
}

export async function clearPracticeDraft(sessionId: string) {
  const db = getDatabase();

  if (!db) {
    return;
  }

  try {
    await db.practiceDrafts.delete(sessionId);
  } catch (error) {
    disableStorage(error);
  }
}
