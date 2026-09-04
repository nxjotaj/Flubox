import 'server-only';

export function getPublicAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return new URL(configured).origin;

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelHost) return new URL(`https://${vercelHost}`).origin;

  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';
  throw new Error('NEXT_PUBLIC_APP_URL não configurada.');
}
