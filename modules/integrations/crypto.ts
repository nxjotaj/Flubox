import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

function encryptionKey() {
  const secret = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!secret && process.env.NODE_ENV === 'production')
    throw new Error('INTEGRATIONS_ENCRYPTION_KEY não configurada.');
  return createHash('sha256')
    .update(secret ?? 'flubox-local-integration-key')
    .digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted]
    .map((part) => part.toString('base64url'))
    .join('.');
}

export function decryptSecret(value: string): string {
  const [iv, tag, encrypted] = value
    .split('.')
    .map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !encrypted) throw new Error('INVALID_ENCRYPTED_SECRET');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
}

export function hashIntegrationValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
