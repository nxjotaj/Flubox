import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { requireAccountPermission } from '@/modules/identity/service';
import { assistantErrorResponse } from '@/modules/assistant/http';
import {
  completeAssistantRun,
  failAssistantRun,
  prepareAssistantStream,
} from '@/modules/assistant/service';
import { z } from 'zod';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
    const account = await requireAccountPermission(user, 'assistant.use');
    const input = z
      .object({
        conversationId: z.uuid(),
        message: z.string().trim().min(1).max(2000),
      })
      .parse(await request.json());
    const prepared = await prepareAssistantStream(
      account,
      input.conversationId,
      input.message,
    );
    const encoder = new TextEncoder();
    let content = '';
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of prepared.stream) {
            content += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
          await completeAssistantRun({
            account,
            conversationId: input.conversationId,
            runId: prepared.runId,
            startedAt: prepared.startedAt,
            content,
            sources: prepared.sources,
          });
          controller.close();
        } catch (error) {
          await failAssistantRun(
            prepared.runId,
            prepared.startedAt,
            error instanceof Error ? error.name : 'STREAM_ERROR',
          );
          controller.error(error);
        }
      },
    });
    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Assistant-Sources': encodeURIComponent(
          JSON.stringify(prepared.sources),
        ),
        'X-Assistant-Remaining': String(prepared.quota.remaining),
      },
    });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
