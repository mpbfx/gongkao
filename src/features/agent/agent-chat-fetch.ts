/**
 * 给 DefaultChatTransport 用的 fetch 包装。
 *
 * 助教与知识问答的入口现在有限流与额度校验，超限时返回的是 JSON 错误体而不是
 * 流式响应。默认实现会把整段 JSON 当作错误信息展示给学员，这里把它还原成
 * 服务端写好的中文提示。
 */
type ApiErrorBody = {
  ok?: boolean;
  error?: { code?: string; message?: string } | null;
};

const FALLBACK_MESSAGE = "AI 服务暂时不可用，请稍后再试。";

export const agentChatFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);

  if (response.ok) {
    return response;
  }

  let message = "";

  try {
    const body = (await response.clone().json()) as ApiErrorBody;
    message = body.error?.message?.trim() ?? "";
  } catch {
    message = (await response.clone().text()).trim();
  }

  throw new Error(message || FALLBACK_MESSAGE);
};
