import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { requireAccountPermission } from '@/modules/identity/service';
import { assistantErrorResponse } from '@/modules/assistant/http';
import {
  createConversation,
  listConversations,
} from '@/modules/assistant/service';
import { z } from 'zod';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
    const account = await requireAccountPermission(user, 'assistant.use');
    const conversations = await listConversations(account);
    return Response.json({ conversations: conversations.results });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
    const account = await requireAccountPermission(user, 'assistant.use');
    const body = await request.json().catch(() => ({}));
    const { title } = z
      .object({ title: z.string().trim().max(80).optional() })
      .parse(body);
    return Response.json(
      { conversation: await createConversation(account, title) },
      { status: 201 },
    );
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
