import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getAccountContext } from '@/modules/identity/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get('code');
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const destination = new URL('/entrar', origin);
      destination.searchParams.set('confirmation', 'invalid');
      return NextResponse.redirect(destination, 303);
    }
  }
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.redirect(new URL('/entrar', origin), 303);
  }

  const account = await getAccountContext(user);
  const destination = !account
    ? '/cadastro'
    : account.organization.type === 'platform'
      ? '/admin'
      : '/dashboard';

  return NextResponse.redirect(new URL(destination, origin), 303);
}
