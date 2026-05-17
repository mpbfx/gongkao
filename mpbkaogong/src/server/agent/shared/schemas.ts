import { z } from "zod";

export const agentConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const mistakeCauseSchema = z.enum([
  "READING_MISS",
  "CONCEPT_GAP",
  "METHOD_GAP",
  "OPTION_TRAP",
  "CALCULATION_ERROR",
  "MATERIAL_LOCATION_ERROR",
  "LOGIC_CHAIN_BREAK",
  "TIME_STRATEGY_ERROR",
  "CARELESSNESS",
  "UNKNOWN",
]);

export type MistakeCause = z.infer<typeof mistakeCauseSchema>;

export const mistakeCauseLabels: Record<MistakeCause, string> = {
  READING_MISS: "审题漏条件",
  CONCEPT_GAP: "知识点不会",
  METHOD_GAP: "题型方法不会",
  OPTION_TRAP: "选项陷阱",
  CALCULATION_ERROR: "计算错误",
  MATERIAL_LOCATION_ERROR: "材料定位错误",
  LOGIC_CHAIN_BREAK: "推理链断裂",
  TIME_STRATEGY_ERROR: "时间策略失误",
  CARELESSNESS: "非知识性失误",
  UNKNOWN: "信息不足",
};

export const agentRecommendationStatusSchema = z.enum([
  "PENDING",
  "CLICKED",
  "STARTED",
  "COMPLETED",
  "DISMISSED",
]);

export const agentRecommendationActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SPECIAL_PRACTICE"),
    tagId: z.string().min(1),
    tagName: z.string().min(1),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD", "UNKNOWN"]).nullable().optional(),
    count: z.number().int().min(5).max(100),
  }),
  z.object({
    type: z.literal("WRONG_PRACTICE"),
    tagId: z.string().min(1).nullable().optional(),
    tagName: z.string().min(1),
    count: z.number().int().min(1).max(100),
  }),
  z.object({
    type: z.literal("WRONG_MEMORIZE"),
    tagId: z.string().min(1).nullable().optional(),
    tagName: z.string().min(1),
    count: z.number().int().min(1).max(100),
  }),
  z.object({
    type: z.literal("DAILY_PRACTICE"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
]);

export type AgentRecommendationAction = z.infer<typeof agentRecommendationActionSchema>;

export const agentRecommendationDtoSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  evidence: z.array(z.string()),
  action: agentRecommendationActionSchema,
  confidence: agentConfidenceSchema,
  status: agentRecommendationStatusSchema,
  clickedAt: z.string().nullable(),
  startedSessionId: z.string().nullable(),
  completedAt: z.string().nullable(),
});

export type AgentRecommendationDto = z.infer<typeof agentRecommendationDtoSchema>;

export const coachConfigSchema = z.object({
  recentSessionLimit: z.coerce.number().int().min(1).max(100).default(20),
  recentDays: z.coerce.number().int().min(1).max(90).default(7),
  minAnswersPerTag: z.coerce.number().int().min(1).max(100).default(5),
  maxRecommendations: z.coerce.number().int().min(1).max(10).default(3),
  slowTimeMultiplier: z.coerce.number().min(1).max(5).default(1.3),
});

export type CoachConfig = z.infer<typeof coachConfigSchema>;

export const coachDiagnosisDtoSchema = z.object({
  summary: z.object({
    title: z.string(),
    totalSessions: z.number().int().min(0),
    totalAnswers: z.number().int().min(0),
    recentSessionLimit: z.number().int().min(1),
    recentDays: z.number().int().min(1),
    sourceSessionId: z.string().nullable(),
  }),
  evidence: z.array(z.string()),
  recommendations: z.array(agentRecommendationDtoSchema),
  confidence: agentConfidenceSchema,
  configSnapshot: coachConfigSchema,
});

export type CoachDiagnosisDto = z.infer<typeof coachDiagnosisDtoSchema>;

export const tutorRequestSchema = z.object({
  sessionId: z.string().min(1).optional(),
  prompt: z.string().trim().min(1).max(500),
});

export const tutorResponseSchema = z.object({
  mistakeCause: mistakeCauseSchema,
  confidence: agentConfidenceSchema,
  causeSummary: z.string(),
  fastestPath: z.string(),
  transferRule: z.string(),
  answer: z.string(),
  suggestedPrompts: z.array(z.string()).min(1).max(5),
  messageId: z.string(),
});

export type TutorResponse = z.infer<typeof tutorResponseSchema>;

export const tutorModelOutputSchema = tutorResponseSchema.omit({ messageId: true });

export const agentFeedbackSchema = z.object({
  targetType: z.enum(["RECOMMENDATION", "TUTOR_MESSAGE"]),
  targetId: z.string().min(1),
  rating: z.enum(["HELPFUL", "NOT_HELPFUL", "NEUTRAL"]),
  reason: z.string().trim().max(500).optional(),
});

export type AgentFeedbackInput = z.infer<typeof agentFeedbackSchema>;
