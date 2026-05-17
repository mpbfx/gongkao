import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { tutorRequestSchema } from "@/server/agent/shared/schemas";
import {
  explainQuestionWithTutor,
  getQuestionTutorHistory,
  streamQuestionWithTutor,
  type TutorStreamEvent,
} from "@/server/agent/tutor/service";
import { apiErrorFromUnknown } from "@/server/services/api-errors";

type RouteContext = {
  params: Promise<{
    questionId: string;
  }>;
};

function encodeSse(event: TutorStreamEvent | { type: "error"; message: string }) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { questionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId")?.trim() || undefined;

    return apiOk(await getQuestionTutorHistory({ user, questionId, sessionId }));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { questionId } = await context.params;
    const body = tutorRequestSchema.parse(await request.json());

    if (request.headers.get("accept")?.includes("text/event-stream")) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const event of streamQuestionWithTutor({ user, questionId, ...body })) {
              controller.enqueue(encoder.encode(encodeSse(event)));
            }
          } catch (error) {
            const apiError = apiErrorFromUnknown(error);
            const payload = await apiError.json();
            const message =
              payload && typeof payload === "object" && "error" in payload
                ? (payload.error as { message?: string }).message
                : "讲题助教暂时不可用，请稍后重试。";

            controller.enqueue(encoder.encode(encodeSse({ type: "error", message: message ?? "讲题助教暂时不可用，请稍后重试。" })));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    return apiOk(await explainQuestionWithTutor({ user, questionId, ...body }));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
