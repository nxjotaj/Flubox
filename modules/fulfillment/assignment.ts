import { getD1 } from '@/db';

export async function selectAvailableOperator(supplierOrganizationId: string) {
  return getD1()
    .prepare(
      `SELECT m.id memberId,COALESCE(COUNT(fa.order_id),0) activeAssignments
       FROM organization_members m
       JOIN roles r ON r.id=m.role_id AND r.key IN ('supplier_operator_1','supplier_operator_2')
       LEFT JOIN fulfillment_assignments fa ON fa.member_id=m.id AND fa.completed_at IS NULL
       WHERE m.organization_id=? AND m.status='active'
       GROUP BY m.id,r.key ORDER BY activeAssignments,r.key LIMIT 1`,
    )
    .bind(supplierOrganizationId)
    .first<{ memberId: string; activeAssignments: number }>();
}
