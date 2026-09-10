'use client';

import {
  Bot,
  ExternalLink,
  LoaderCircle,
  MessageSquarePlus,
  Pencil,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type Source = { type: string; label: string; href?: string };
type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  feedback?: string | null;
};
type Conversation = { id: string; title: string; updatedAt: string };

export function AssistantChat({
  compact = false,
  onClose,
  configured = true,
}: {
  compact?: boolean;
  onClose?: () => void;
  configured?: boolean;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    configured ? '' : 'O assistente aguarda ativação pela administração.',
  );
  const endRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (conversationId: string) => {
    const response = await fetch(
      `/api/assistant/conversations/${conversationId}`,
      { cache: 'no-store' },
    );
    if (!response.ok)
      throw new Error('Não foi possível carregar esta conversa.');
    const data = await response.json();
    setMessages(data.conversation.messages);
  }, []);

  const loadConversations = useCallback(async () => {
    const response = await fetch('/api/assistant/conversations', {
      cache: 'no-store',
    });
    if (!response.ok) return;
    const data = await response.json();
    setConversations(data.conversations);
    if (!activeId && data.conversations[0])
      setActiveId(data.conversations[0].id);
  }, [activeId]);

  useEffect(() => {
    void fetch('/api/assistant/conversations', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setConversations(data.conversations);
        if (data.conversations[0]) setActiveId(data.conversations[0].id);
      });
  }, []);
  useEffect(() => {
    if (!activeId) return;
    void fetch(`/api/assistant/conversations/${activeId}`, {
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok)
          throw new Error('Não foi possível carregar esta conversa.');
        return response.json();
      })
      .then((data) => setMessages(data.conversation.messages))
      .catch(() => setError('Não foi possível carregar esta conversa.'));
  }, [activeId]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function newConversation() {
    setError('');
    const response = await fetch('/api/assistant/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error);
      return;
    }
    setConversations((current) => [data.conversation, ...current]);
    setActiveId(data.conversation.id);
    setMessages([]);
  }

  async function ensureConversation() {
    if (activeId) return activeId;
    const response = await fetch('/api/assistant/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setActiveId(data.conversation.id);
    setConversations((current) => [data.conversation, ...current]);
    return data.conversation.id as string;
  }

  async function sendMessage(event: { preventDefault(): void }) {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    const temporaryUser = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: text,
    };
    setMessages((current) => [...current, temporaryUser]);
    try {
      const conversationId = await ensureConversation();
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message: text }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const sourceHeader = response.headers.get('X-Assistant-Sources');
      const sources = sourceHeader
        ? (JSON.parse(decodeURIComponent(sourceHeader)) as Source[])
        : [];
      const assistantId = crypto.randomUUID();
      setMessages((current) => [
        ...current,
        { id: assistantId, role: 'assistant', content: '', sources },
      ]);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Resposta sem conteúdo.');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId
              ? { ...item, content: item.content + chunk }
              : item,
          ),
        );
      }
      await loadMessages(conversationId);
      void loadConversations();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível obter uma resposta.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeConversation() {
    if (
      !activeId ||
      !confirm('Excluir esta conversa? Esta ação não pode ser desfeita.')
    )
      return;
    await fetch(`/api/assistant/conversations/${activeId}`, {
      method: 'DELETE',
    });
    setActiveId(undefined);
    setMessages([]);
    void loadConversations();
  }

  async function renameActiveConversation() {
    if (!activeId) return;
    const current = conversations.find((item) => item.id === activeId);
    const title = prompt(
      'Nome da conversa',
      current?.title ?? 'Nova conversa',
    )?.trim();
    if (!title) return;
    const response = await fetch(`/api/assistant/conversations/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (response.ok)
      setConversations((items) =>
        items.map((item) => (item.id === activeId ? { ...item, title } : item)),
      );
  }

  async function feedback(id: string, value: 'helpful' | 'unhelpful') {
    const response = await fetch(`/api/assistant/messages/${id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: value }),
    });
    if (response.ok)
      setMessages((current) =>
        current.map((item) =>
          item.id === id ? { ...item, feedback: value } : item,
        ),
      );
  }

  return (
    <section
      className={`assistant-chat ${compact ? 'compact' : 'full'}`}
      aria-label="Assistente Flubox"
    >
      <header>
        <div className="assistant-identity">
          <span>
            <Bot />
          </span>
          <div>
            <strong>Assistente Flubox</strong>
            <small>Consulta, explica e sugere. Não altera seus dados.</small>
          </div>
        </div>
        <div className="assistant-header-actions">
          <button
            type="button"
            onClick={() => void newConversation()}
            title="Nova conversa"
          >
            <MessageSquarePlus />
          </button>
          {activeId && (
            <button
              type="button"
              onClick={() => void renameActiveConversation()}
              title="Renomear conversa"
            >
              <Pencil />
            </button>
          )}
          {activeId && (
            <button
              type="button"
              onClick={() => void removeConversation()}
              title="Excluir conversa"
            >
              <Trash2 />
            </button>
          )}
          {compact && (
            <Link href="/assistente" title="Abrir página completa">
              <ExternalLink />
            </Link>
          )}
          {onClose && (
            <button type="button" onClick={onClose} title="Fechar">
              <X />
            </button>
          )}
        </div>
      </header>
      {!compact && conversations.length > 0 && (
        <nav
          className="assistant-conversation-tabs"
          aria-label="Histórico de conversas"
        >
          {conversations.slice(0, 8).map((conversation) => (
            <button
              type="button"
              className={conversation.id === activeId ? 'active' : ''}
              onClick={() => setActiveId(conversation.id)}
              key={conversation.id}
            >
              {conversation.title}
            </button>
          ))}
        </nav>
      )}
      <div className="assistant-messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="assistant-welcome">
            <Bot />
            <h2>Como posso ajudar?</h2>
            <p>
              Consulte seus pedidos, estoque, financeiro, integrações ou tire
              dúvidas sobre o Flubox.
            </p>
            <div>
              {[
                'Quais pedidos exigem atenção?',
                'Como está meu estoque?',
                'Resuma meus últimos 30 dias',
              ].map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => setMessage(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((item) => (
          <article
            className={item.role === 'user' ? 'mine' : 'assistant'}
            key={item.id}
          >
            <strong>
              {item.role === 'user' ? 'Você' : 'Assistente Flubox'}
            </strong>
            <p>
              {item.content || <LoaderCircle className="assistant-spinner" />}
            </p>
            {item.sources && item.sources.length > 0 && (
              <div className="assistant-sources">
                <small>Fontes consultadas</small>
                {item.sources.map((source, index) =>
                  source.href ? (
                    <Link href={source.href} key={`${source.label}-${index}`}>
                      {source.label}
                    </Link>
                  ) : (
                    <span key={`${source.label}-${index}`}>{source.label}</span>
                  ),
                )}
              </div>
            )}
            {item.role === 'assistant' && item.content && (
              <div className="assistant-feedback">
                <span>Esta resposta ajudou?</span>
                <button
                  className={item.feedback === 'helpful' ? 'active' : ''}
                  type="button"
                  onClick={() => void feedback(item.id, 'helpful')}
                >
                  <ThumbsUp />
                </button>
                <button
                  className={item.feedback === 'unhelpful' ? 'active' : ''}
                  type="button"
                  onClick={() => void feedback(item.id, 'unhelpful')}
                >
                  <ThumbsDown />
                </button>
              </div>
            )}
          </article>
        ))}
        <div ref={endRef} />
      </div>
      <form className="assistant-composer" onSubmit={sendMessage}>
        <label
          htmlFor={compact ? 'assistant-message-compact' : 'assistant-message'}
        >
          Pergunte ao Assistente Flubox
        </label>
        <textarea
          id={compact ? 'assistant-message-compact' : 'assistant-message'}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Digite sua pergunta..."
          maxLength={2000}
          disabled={busy || !configured}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" disabled={busy || !message.trim() || !configured}>
          {busy ? <LoaderCircle className="assistant-spinner" /> : <Send />}
          <span>Enviar</span>
        </button>
        {error && <output>{error}</output>}
        <small>
          O assistente pode cometer erros. Confirme informações críticas antes
          de agir.
        </small>
      </form>
    </section>
  );
}
