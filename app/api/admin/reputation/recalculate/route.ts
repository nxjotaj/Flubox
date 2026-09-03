import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { calculateReputation } from '@/modules/reputation/engine';
type Metrics = {
  organizationId: string;
  shipmentTotal: number;
  onTime: number;
  orderTotal: number;
  cancelled: number;
  disputes: number;
  catalogQuality: number | null;
  verifications: number;
};
const rate = (good: number, total: number) =>
  total === 0 ? 10000 : Math.round((good / total) * 10000);
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const admin = await requireAccountPermission(user, 'settings.manage');
    const rows = await getD1()
      .prepare(
        `SELECT o.id organization_id,((SELECT COUNT(*) FROM shipments s JOIN orders x ON x.id=s.order_id WHERE x.supplier_organization_id=o.id AND s.shipped_at IS NOT NULL))::int shipment_total,((SELECT COUNT(*) FROM shipments s JOIN orders x ON x.id=s.order_id WHERE x.supplier_organization_id=o.id AND s.shipped_at<=s.preparation_deadline))::int on_time,((SELECT COUNT(*) FROM orders x WHERE x.supplier_organization_id=o.id AND x.status NOT IN ('created','awaiting_payment','payment_expired')))::int order_total,((SELECT COUNT(*) FROM orders x WHERE x.supplier_organization_id=o.id AND x.status='cancelled'))::int cancelled,((SELECT COUNT(*) FROM support_cases c JOIN orders x ON x.id=c.order_id WHERE x.supplier_organization_id=o.id AND c.type='dispute'))::int disputes,COALESCE((SELECT AVG(quality_score)::float8 FROM products p WHERE p.organization_id=o.id),100) catalog_quality,((SELECT COUNT(*) FROM verifications v WHERE v.organization_id=o.id AND v.status='approved'))::int verifications FROM organizations o WHERE o.type='supplier'`,
      )
      .all<Metrics>();
    const now = new Date(),
      start = new Date(now.getTime() - 90 * 86400000);
    for (const row of rows.results) {
      const result = calculateReputation({
        onTimeRate: rate(row.onTime, row.shipmentTotal),
        fulfillmentRate: rate(row.orderTotal - row.cancelled, row.orderTotal),
        disputeFreeRate: rate(row.orderTotal - row.disputes, row.orderTotal),
        catalogQuality: Math.round((row.catalogQuality ?? 100) * 100),
        verificationRate: Math.min(
          10000,
          Math.round((row.verifications / 3) * 10000),
        ),
      });
      await getD1().batch([
        getD1()
          .prepare(
            `INSERT INTO reputation_snapshots (id,organization_id,score_basis_points,components_json,weights_json,source_window_start,source_window_end,created_at) VALUES (?,?,?,?,?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            row.organizationId,
            result.score,
            JSON.stringify(result.components),
            JSON.stringify(result.weights),
            start.toISOString(),
            now.toISOString(),
            now.toISOString(),
          ),
        getD1()
          .prepare(
            `UPDATE supplier_profiles SET reputation_basis_points=?,updated_at=? WHERE organization_id=?`,
          )
          .bind(result.score, now.toISOString(), row.organizationId),
      ]);
    }
    await getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'reputation.recalculated','reputation','all',?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        admin.user.id,
        admin.organization.id,
        requestId,
        JSON.stringify({ recalculated: rows.results.length }),
        now.toISOString(),
      )
      .run();
    return Response.json({ recalculated: rows.results.length, requestId });
  } catch (error) {
    logError(error, { requestId, route: 'reputation recalculation' });
    return Response.json(
      { error: 'Não foi possível recalcular reputações.', requestId },
      { status: 500 },
    );
  }
}
