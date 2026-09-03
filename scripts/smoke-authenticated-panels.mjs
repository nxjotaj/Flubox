import { createServerClient } from '@supabase/ssr';

const password = process.env.SMOKE_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';

if (!password || !supabaseUrl || !supabaseKey) {
  throw new Error('Variáveis de ambiente do smoke test não configuradas.');
}

const profiles = [
  ['admin@flubox.com.br', '/admin', 'Central de administração'],
  ['fornecedor@flubox.com.br', '/dashboard', 'Visão geral'],
  ['revendedor@flubox.com.br', '/dashboard', 'Visão geral'],
];

async function timedFetch(path, cookies) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { cookie: cookies },
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  });
  return {
    response,
    html: await response.text(),
    duration: Math.round(performance.now() - startedAt),
  };
}

for (const [email, expectedPath, expectedText] of profiles) {
  const cookieJar = new Map();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
      setAll: (items) =>
        items.forEach(({ name, value }) => cookieJar.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  const cookies = [...cookieJar]
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  const entry = await timedFetch('/entrar', cookies);
  const panel = await timedFetch(expectedPath, cookies);
  const ok =
    entry.response.ok && panel.response.ok && panel.html.includes(expectedText);
  console.log(
    JSON.stringify({
      email,
      entryMs: entry.duration,
      panelMs: panel.duration,
      finalUrl: panel.response.url,
      ok,
    }),
  );
  if (!ok) throw new Error(`${email}: painel não validado.`);
}
