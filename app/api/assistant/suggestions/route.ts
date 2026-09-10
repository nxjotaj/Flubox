import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { requireAccountPermission } from '@/modules/identity/service';
import { assistantErrorResponse } from '@/modules/assistant/http';
import {
  dismissSuggestion,
  listSuggestions,
} from '@/modules/assistant/service';
import { z } from 'zod';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
    const account = await requireAccountPermission(user, 'assistant.use');
    return Response.json({ suggestions: await listSuggestions(account) });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
    const account = await requireAccountPermission(user, 'assistant.use');
    const { id } = z.object({ id: z.uuid() }).parse(await request.json());
    await dismissSuggestion(account, id);
    return Response.json({ success: true });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
