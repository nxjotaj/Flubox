'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Command as CommandIcon,
  Menu,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

type Item = { href: string; label: string };

export function AppNavigationTools({
  items,
  activePath,
  organization,
  accountType,
  organizations,
  activeOrganizationId,
}: {
  items: Item[];
  activePath: string;
  organization: string;
  accountType: string;
  organizations: { id: string; displayName: string; type: string }[];
  activeOrganizationId: string;
}) {
  const router = useRouter();
  const [commandOpen, setCommandOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  const navigate = (href: string) => {
    setCommandOpen(false);
    setMenuOpen(false);
    router.push(href);
  };

  const switchOrganization = async (organizationId: string) => {
    const response = await fetch('/api/organizations/switch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId }),
    });
    if (response.ok) window.location.assign('/dashboard');
  };

  return (
    <>
      <button
        className="topbar-search"
        onClick={() => setCommandOpen(true)}
        aria-label="Abrir busca rápida"
      >
        <Search />
        <span>Buscar página ou ação</span>
        <kbd>Ctrl K</kbd>
      </button>
      <CommandDialog
        open={commandOpen}
        onOpenChange={setCommandOpen}
        title="Navegação rápida"
        description="Busque uma área do Flubox"
        className="command-surface"
      >
        <Command>
          <CommandInput placeholder="Digite para buscar…" />
          <CommandList>
            <CommandEmpty>Nenhuma área encontrada.</CommandEmpty>
            <CommandGroup heading="Navegação">
              {items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${item.label} ${item.href}`}
                  onSelect={() => navigate(item.href)}
                >
                  <CommandIcon />
                  <span>{item.label}</span>
                  {activePath === item.href ? (
                    <CommandShortcut>Atual</CommandShortcut>
                  ) : (
                    <ArrowRight className="command-arrow" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            {organizations.length > 1 && (
              <CommandGroup heading="Trocar organização">
                {organizations.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.displayName} ${item.type}`}
                    onSelect={() => void switchOrganization(item.id)}
                  >
                    <Building2 />
                    <span>{item.displayName}</span>
                    {item.id === activeOrganizationId && (
                      <CheckCircle2 className="command-current" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger
          render={
            <Button
              className="mobile-menu-trigger"
              variant="outline"
              size="icon-lg"
            />
          }
        >
          <Menu />
          <span className="sr-only">Abrir menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="mobile-menu-sheet">
          <SheetHeader>
            <SheetTitle>{organization}</SheetTitle>
            <SheetDescription>{accountType}</SheetDescription>
          </SheetHeader>
          <nav aria-label="Navegação móvel">
            {items.map((item) => (
              <button
                key={item.href}
                className={activePath === item.href ? 'active' : ''}
                onClick={() => navigate(item.href)}
              >
                <span>{item.label}</span>
                <ArrowRight />
              </button>
            ))}
          </nav>
          {organizations.length > 1 && (
            <div className="mobile-organization-list">
              <span>Trocar organização</span>
              {organizations.map((item) => (
                <button
                  key={item.id}
                  className={item.id === activeOrganizationId ? 'active' : ''}
                  onClick={() => void switchOrganization(item.id)}
                >
                  {item.displayName}
                  {item.id === activeOrganizationId && <CheckCircle2 />}
                </button>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
