'use client';

import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { AssistantChat } from './assistant-chat';

export function AssistantDock({
  userName,
  organizationType,
  configured,
}: {
  userName: string;
  organizationType: string;
  configured: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`assistant-dock ${open ? 'open' : ''}`}>
      {open && (
        <div className="assistant-dock-panel">
          <AssistantChat
            compact
            configured={configured}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
      <button
        className="assistant-dock-trigger"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          open ? 'Fechar Assistente Flubox' : 'Abrir Assistente Flubox'
        }
        title={`Assistente para ${userName} — ${organizationType}`}
      >
        {open ? <X /> : <Sparkles />}
        <span>{open ? 'Fechar' : 'Assistente Flubox'}</span>
      </button>
    </div>
  );
}
