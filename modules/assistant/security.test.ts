import { describe, expect, it } from 'vitest';
import { safeUserPrompt, sanitizeForAssistant, systemPrompt } from './security';

describe('segurança do Assistente Flubox', () => {
  it('remove credenciais e números semelhantes a cartão', () => {
    const result = sanitizeForAssistant(
      'token=segredo Bearer abc.def.ghi cartão 4111111111111111',
    );
    expect(result).not.toContain('segredo');
    expect(result).not.toContain('abc.def.ghi');
    expect(result).not.toContain('4111111111111111');
    expect(result).toContain('[DADO PROTEGIDO]');
  });

  it('limita e higieniza a pergunta do usuário', () => {
    const result = safeUserPrompt(`  teste\u0000${'x'.repeat(3000)}  `);
    expect(result).not.toContain('\u0000');
    expect(result.length).toBe(2000);
  });

  it('fixa o comportamento consultivo e o idioma', () => {
    const prompt = systemPrompt('Fornecedor');
    expect(prompt).toContain('português do Brasil');
    expect(prompt).toContain('estritamente consultivo');
    expect(prompt).toContain('Não revele');
  });
});
