import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';

const allowed = ['products.view','products.manage','orders.view','orders.manage','fulfillment.view','fulfillment.manage','payments.view','audit.view'] as const;
const schema = z.object({ permissions: z.array(z.enum(allowed)).max(allowed.length) });

export async function PUT(request: Request,{params}:{params:Promise<{id:string}>}) {
  const requestId=requestIdFrom(request);
  const user=await getAuthenticatedUser();
  if(!user) return Response.json({error:'Faça login.',requestId},{status:401});
  const account=await requireAccountPermission(user,'organization.manage');
  if(account.organization.type!=='supplier'||account.role!=='supplier_owner') return Response.json({error:'Somente o proprietário configura permissões.',requestId},{status:403});
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success) return Response.json({error:'Permissões inválidas.',requestId},{status:422});
  const {id}=await params;
  const member=await getD1().prepare(`SELECT m.id,r.key role FROM organization_members m JOIN roles r ON r.id=m.role_id WHERE m.id=? AND m.organization_id=? AND m.status='active'`).bind(id,account.organization.id).first<{id:string;role:string}>();
  if(!member) return Response.json({error:'Membro não encontrado.',requestId},{status:404});
  if(member.role!=='supplier_member') return Response.json({error:'Somente o colaborador possui permissões personalizadas.',requestId},{status:409});
  const now=new Date().toISOString();
  const selected=new Set(parsed.data.permissions);
  await getD1().batch([
    ...allowed.map(permission => getD1().prepare(`INSERT INTO member_permission_overrides (member_id,permission_key,allowed,updated_by,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(member_id,permission_key) DO UPDATE SET allowed=excluded.allowed,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(id,permission,selected.has(permission),account.user.id,now)),
    getD1().prepare(`INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'member.permissions_updated','organization_member',?,?,?,?)`).bind(crypto.randomUUID(),account.user.id,account.organization.id,id,requestId,JSON.stringify({permissions:parsed.data.permissions}),now),
  ]);
  return Response.json({updated:true,requestId});
}
