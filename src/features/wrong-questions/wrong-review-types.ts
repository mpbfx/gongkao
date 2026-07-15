export type LatestMistakeReview = {
  id: string;
  mistakeCause: string;
  mistakeCauseLabel: string;
  confidence: string;
  causeSummary: string;
  fastestPath: string;
  transferRule: string;
  createdAt: string;
};

export type WrongQuestionDTO = {
  id: string;
  questionId: string;
  wrongCount: number;
  lastWrongAt: string;
  resolvedAt: string | null;
  latestMistakeReview: LatestMistakeReview | null;
  lastAnswer: {
    answer: string | null;
    sessionId: string;
    timeSpentSeconds: number;
  } | null;
  question: {
    id: string;
    titleHtml: string;
    material?: {
      id: string;
      title?: string | null;
      contentHtml: string;
    } | null;
    options: Array<{
      id: string;
      label: string;
      value: string;
      contentHtml: string;
    }>;
    correctAnswer?: string;
    analysisHtml?: string | null;
  };
};

export type WrongQuestionGroupDTO = {
  tagId: string | null;
  tagName: string;
  count: number;
  items: WrongQuestionDTO[];
};

export type WrongQuestionsData = {
  summary: {
    totalCount: number;
    unresolvedCount: number;
    resolvedCount: number;
  };
  groups: WrongQuestionGroupDTO[];
};

export type MistakeInsights = {
  summary: {
    dominantCause: { cause: string; label: string; count: number } | null;
  };
  knowledgePatterns: Array<{
    tagId: string | null;
    tagName: string;
    cause: string;
    label: string;
    count: number;
  }>;
};

export type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { message: string } };
