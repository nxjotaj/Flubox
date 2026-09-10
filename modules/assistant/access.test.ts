import { describe, expect, it } from 'vitest';
import { assertAssistantPermission } from './access';
import type { AssistantContext } from './types';

const context: AssistantContext = {
  userId: 'user-1',
  organizationId: 'organization-1',
  organizationType: 'supplier',
  role: 'supplier_member',
  permissions: ['assistant.use', 'orders.view'],
  conversationId: 'conversation-1',
};

describe('permissões das ferramentas do assistente', () => {
  it('permite somente ferramentas autorizadas', () => {
    expect(() =>
      assertAssistantPermission(context, 'orders.view'),
    ).not.toThrow();
    expect(() => assertAssistantPermission(context, 'payments.view')).toThrow(
      'FORBIDDEN',
    );
  });
});
