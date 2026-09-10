import type { PermissionKey } from '@/modules/identity/permissions';
import type { z } from 'zod';

export type AssistantContext = Readonly<{
  userId: string;
  organizationId: string;
  organizationType: 'supplier' | 'reseller' | 'platform';
  role: string;
  permissions: readonly PermissionKey[];
  conversationId: string;
}>;

export type AssistantSource = {
  type: 'pedido' | 'relatorio' | 'ajuda' | 'integracao' | 'estoque' | 'suporte';
  label: string;
  href?: string;
};

export type AssistantModelMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantModelRequest = {
  system: string;
  messages: AssistantModelMessage[];
  operationalContext: string;
};

export interface AssistantProvider {
  readonly name: string;
  readonly model: string;
  stream(request: AssistantModelRequest): Promise<AsyncIterable<string>>;
}

export interface AssistantTool<TInput, TOutput> {
  readonly name: string;
  readonly requiredPermission: PermissionKey;
  readonly inputSchema: z.ZodType<TInput>;
  execute(input: TInput, context: AssistantContext): Promise<TOutput>;
}

export type AssistantToolResult = {
  tool: string;
  data: unknown;
  sources: AssistantSource[];
};

export type AssistantSuggestion = {
  id: string;
  organizationId: string;
  userId?: string;
  category: 'estoque' | 'pedido' | 'financeiro' | 'integracao' | 'suporte';
  priority: 'informativa' | 'atencao' | 'critica';
  title: string;
  explanation: string;
  recommendation: string;
  sourceReference: string;
  actionHref?: string;
  expiresAt: string;
  dismissedAt?: string;
};
