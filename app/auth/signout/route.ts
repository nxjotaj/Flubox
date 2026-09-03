import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const returnTo = request.nextUrl.searchParams.get('returnTo');
  const safe =
    returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  return NextResponse.redirect(new URL(safe, request.url));
}
