import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getAccountContext } from '@/modules/identity/service';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
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
