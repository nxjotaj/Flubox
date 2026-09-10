import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requireAccountPermission } from '@/modules/identity/service';
import { assistantErrorResponse } from '@/modules/assistant/http';
import { z } from 'zod';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
    const account = await requireAccountPermission(user, 'assistant.use');
    const { id } = await context.params;
    const { feedback } = z
      .object({ feedback: z.enum(['helpful', 'unhelpful']) })
      .parse(await request.json());
    const result = await getD1()
      .prepare(
        `UPDATE assistant_messages m SET feedback=? FROM assistant_conversations c WHERE m.id=? AND m.conversation_id=c.id AND m.role='assistant' AND c.organization_id=? AND c.user_id=? AND c.deleted_at IS NULL RETURNING m.id`,
      )
      .bind(
        feedback,
        z.uuid().parse(id),
        account.organization.id,
        account.user.id,
      )
      .run();
    if (!result.results.length)
      return Response.json(
        { error: 'Mensagem não encontrada.' },
        { status: 404 },
      );
    return Response.json({ success: true });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
