import { getD1 } from '@/db';

export type AuditEvent = {
  actorUserId: string;
  organizationId?: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export async function recordAudit(event: AuditEvent): Promise<void> {
  await getD1()
    .prepare(
      `INSERT INTO audit_logs (id, actor_user_id, organization_id, action, entity_type, entity_id, request_id, reason, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      event.actorUserId,
      event.organizationId ?? null,
      event.action,
      event.entityType,
      event.entityId,
      event.requestId,
      event.reason ?? null,
      event.metadata ? JSON.stringify(event.metadata) : null,
      new Date().toISOString(),
    )
    .run();
}
