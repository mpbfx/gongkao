import Dexie, { type Table } from "dexie";

export type PracticeSubmitDraft = {
  elapsedSeconds: number;
  answers: Array<{
    questionId: string;
    answer: string | null;
    timeSpentSeconds: number;
  }>;
  savedAt: string;
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

function getDatabase() {
  if (typeof window === "undefined") {
    return null;
  }

  database ??= new PracticeOfflineDatabase();
  return database;
}

export async function getPracticeDraft(sessionId: string) {
  return getDatabase()?.practiceDrafts.get(sessionId) ?? null;
}

export async function savePracticeDraft(draft: Omit<PracticeDraft, "updatedAt">) {
  const db = getDatabase();

  if (!db) {
    return;
  }

  await db.practiceDrafts.put({
    ...draft,
    updatedAt: new Date().toISOString(),
  });
}

export async function clearPracticeDraft(sessionId: string) {
  await getDatabase()?.practiceDrafts.delete(sessionId);
}
