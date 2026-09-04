import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { headers } from 'next/headers';
import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getAccountContext } from '@/modules/identity/service';
import { AppShell } from '@/components/app-shell';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Flubox — estoque de quem tem, vendas de quem sabe',
  description:
    'A plataforma que conecta fornecedores confiáveis a revendedores que querem crescer sem estoque próprio.',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = (await headers()).get('x-flubox-pathname') ?? '/';
  const legacyProtected = [
    '/produtos',
    '/catalogo',
    '/pedidos',
    '/financeiro',
    '/equipe',
    '/casos',
    '/listas',
    '/favoritos',
    '/relatorios',
    '/configuracoes',
    '/integracoes',
  ];
  const pageOwnsShell =
    ['/pedidos', '/financeiro', '/relatorios', '/configuracoes'].includes(
      pathname,
    ) || /^\/produtos\/[^/]+$/.test(pathname);
  let content = children;
  if (
    !pageOwnsShell &&
    legacyProtected.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    const user = await getAuthenticatedUser();
    const account = user ? await getAccountContext(user) : null;
    if (account)
      content = (
        <AppShell account={account} activePath={pathname}>
          {children}
        </AppShell>
      );
  }
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {content}
      </body>
    </html>
  );
}
