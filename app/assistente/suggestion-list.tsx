'use client';

import { Check, ExternalLink, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export type SuggestionView = {
  id: string;
  priority: string;
  title: string;
  explanation: string;
  recommendation: string;
  actionHref?: string;
};

export function SuggestionList({
  initialSuggestions,
}: {
  initialSuggestions: SuggestionView[];
}) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  async function dismiss(id: string) {
    const response = await fetch('/api/assistant/suggestions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (response.ok)
      setSuggestions((items) => items.filter((item) => item.id !== id));
  }
  if (!suggestions.length) return null;
  return (
    <section className="assistant-suggestion-section">
      <header>
        <div>
          <span className="page-kicker">
            <Lightbulb /> Atenção recomendada
          </span>
          <h2>Sugestões para sua operação</h2>
        </div>
      </header>
      <div className="assistant-suggestion-grid">
        {suggestions.map((suggestion) => (
          <article
            className={`priority-${suggestion.priority}`}
            key={suggestion.id}
          >
            <strong>{suggestion.title}</strong>
            <p>{suggestion.explanation}</p>
            <small>
              <b>Recomendação:</b> {suggestion.recommendation}
            </small>
            <footer>
              {suggestion.actionHref && (
                <Link href={suggestion.actionHref}>
                  Ver no sistema <ExternalLink />
                </Link>
              )}
              <button type="button" onClick={() => void dismiss(suggestion.id)}>
                <Check /> Dispensar
              </button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
