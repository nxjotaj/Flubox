import { getAuthenticatedUser } from "@/app/chatgpt-auth";
import { getD1 } from "@/db";
import {
  createPrivateDocumentUrl,
  removePrivateDocument,
  storePrivateDocument,
} from "@/modules/documents/storage";
import { getAccountContext } from "@/modules/identity/service";
import { redirect } from "next/navigation";
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Faça login." }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account || account.organization.type !== "reseller")
    return Response.json({ error: "Acesso negado." }, { status: 403 });
  const profile = await getD1()
    .prepare(
      "SELECT avatar_storage_key avatarUrl FROM reseller_profiles WHERE organization_id=?",
    )
    .bind(account.organization.id)
    .first<{ avatarUrl: string | null }>();
  if (!profile?.avatarUrl)
    return Response.json({ error: "Foto não cadastrada." }, { status: 404 });
  redirect(await createPrivateDocumentUrl(profile.avatarUrl));
}
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Faça login." }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account || account.organization.type !== "reseller")
    return Response.json({ error: "Acesso negado." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    !allowed.has(file.type) ||
    file.size <= 0 ||
    file.size > 5 * 1024 * 1024
  )
    return Response.json(
      { error: "Envie JPG, PNG ou WebP de até 5 MB." },
      { status: 422 },
    );
  const previous = await getD1()
    .prepare(
      "SELECT avatar_storage_key avatarUrl FROM reseller_profiles WHERE organization_id=?",
    )
    .bind(account.organization.id)
    .first<{ avatarUrl: string | null }>();
  const key = `accounts/${account.organization.id}/avatar-${crypto.randomUUID()}`;
  await storePrivateDocument(key, file);
  await getD1()
    .prepare(
      "UPDATE reseller_profiles SET avatar_storage_key=?,updated_at=? WHERE organization_id=?",
    )
    .bind(key, new Date().toISOString(), account.organization.id)
    .run();
  if (previous?.avatarUrl)
    await removePrivateDocument(previous.avatarUrl).catch(() => undefined);
  return Response.json({ updated: true });
}
