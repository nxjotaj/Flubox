import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';

export type AuthenticatedUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export const getAuthenticatedUser = cache(
  async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims) return null;
    const email = typeof claims.email === 'string' ? claims.email : null;
    const userId = typeof claims.sub === 'string' ? claims.sub : null;
    if (!email || !userId) return null;
    const metadata =
      claims.user_metadata && typeof claims.user_metadata === 'object'
        ? (claims.user_metadata as Record<string, unknown>)
        : null;
    const fullName =
      typeof metadata?.full_name === 'string' ? metadata.full_name : null;
    return {
      userId,
      email,
      fullName,
      displayName: fullName ?? email,
    };
  },
);

export async function requireAuthenticatedUser(
  returnTo: string,
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (user) return user;
  redirect(signInPath(returnTo));
}

export function signInPath(returnTo: string): string {
  return `/entrar?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function signOutPath(returnTo = '/'): string {
  return `/auth/signout?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

function safeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://app.local');
    if (url.origin !== 'https://app.local') return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
