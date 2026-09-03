import { createSupabaseServerClient } from '@/lib/supabase/server';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function validateDocument(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type))
    return 'Envie um arquivo PDF, JPG, PNG ou WebP.';
  if (file.size <= 0 || file.size > MAX_DOCUMENT_BYTES)
    return 'O arquivo deve ter até 10 MB.';
  return null;
}

export async function storePrivateDocument(
  key: string,
  file: File,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from('flubox-files')
    .upload(key, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw new Error(`STORAGE_UNAVAILABLE: ${error.message}`);
}

export async function createPrivateDocumentUrl(key: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from('flubox-files')
    .createSignedUrl(key, 60);
  if (error || !data?.signedUrl)
    throw new Error(
      `STORAGE_URL_UNAVAILABLE: ${error?.message ?? 'URL ausente'}`,
    );
  return data.signedUrl;
}

export async function downloadPrivateDocument(
  key: string,
): Promise<ArrayBuffer> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from('flubox-files')
    .download(key);
  if (error || !data)
    throw new Error(
      `STORAGE_DOWNLOAD_UNAVAILABLE: ${error?.message ?? 'Arquivo ausente'}`,
    );
  return data.arrayBuffer();
}
export async function removePrivateDocument(key: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from('flubox-files').remove([key]);
  if (error) throw new Error(`STORAGE_REMOVE_UNAVAILABLE: ${error.message}`);
}
