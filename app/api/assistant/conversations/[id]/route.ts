import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { requireAccountPermission } from '@/modules/identity/service';
import { assistantErrorResponse } from '@/modules/assistant/http';
import {
  deleteConversation,
  getConversation,
  renameConversation,
} from '@/modules/assistant/service';
import { z } from 'zod';

async function account() {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  return requireAccountPermission(user, 'assistant.use');
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const current = await account();
    if (!current)
      return Response.json({ error: 'Faça login.' }, { status: 401 });
    const { id } = await context.params;
    return Response.json({
      conversation: await getConversation(current, z.uuid().parse(id)),
    });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const current = await account();
    if (!current)
      return Response.json({ error: 'Faça login.' }, { status: 401 });
    const { id } = await context.params;
    const { title } = z
      .object({ title: z.string().trim().min(1).max(80) })
      .parse(await request.json());
    await renameConversation(current, z.uuid().parse(id), title);
    return Response.json({ success: true });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const current = await account();
    if (!current)
      return Response.json({ error: 'Faça login.' }, { status: 401 });
    const { id } = await context.params;
    await deleteConversation(current, z.uuid().parse(id));
    return Response.json({ success: true });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
