import { ConflictError } from "@/server/services/errors";

export function validateSubmittedQuestionIds({
  sessionQuestionIds,
  submittedQuestionIds,
}: {
  sessionQuestionIds: Iterable<string>;
  submittedQuestionIds: string[];
}) {
  if (new Set(submittedQuestionIds).size !== submittedQuestionIds.length) {
    throw new ConflictError("提交答案包含重复题目");
  }

  const allowedQuestionIds = new Set(sessionQuestionIds);
  if (submittedQuestionIds.some((questionId) => !allowedQuestionIds.has(questionId))) {
    throw new ConflictError("提交答案包含本练习之外的题目");
  }
}
