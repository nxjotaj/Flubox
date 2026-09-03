'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const watchedTables = [
  'orders',
  'order_items',
  'order_documents',
  'shipments',
  'inventory_movements',
  'products',
  'organizations',
  'organization_members',
  'subscriptions',
  'ledger_entries',
  'disputes',
  'notifications',
] as const;

export function LiveDataRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 450);
    };
    let channel = supabase.channel('flubox-operational-updates');
    for (const table of watchedTables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        refresh,
      );
    }
    channel.subscribe();
    const fallback = setInterval(refresh, 30_000);
    return () => {
      clearInterval(fallback);
      clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
