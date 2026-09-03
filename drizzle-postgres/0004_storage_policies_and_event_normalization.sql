INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('flubox-files','flubox-files',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;--> statement-breakpoint

CREATE POLICY "flubox_files_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='flubox-files' AND EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.organization_members m ON m.user_id=u.id AND m.status='active'
    JOIN public.organizations member_org ON member_org.id=m.organization_id
    WHERE u.auth_subject=auth.uid()::text AND (
      member_org.type='platform'
      OR ((storage.foldername(name))[1]='organizations' AND m.organization_id=(storage.foldername(name))[2])
      OR ((storage.foldername(name))[1]='products' AND EXISTS (SELECT 1 FROM public.products p WHERE p.id=(storage.foldername(name))[2] AND p.organization_id=m.organization_id))
      OR ((storage.foldername(name))[1]='orders' AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id=(storage.foldername(name))[2] AND (o.supplier_organization_id=m.organization_id OR o.reseller_organization_id=m.organization_id)))
    )
  )
);--> statement-breakpoint

CREATE POLICY "flubox_files_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='flubox-files' AND EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.organization_members m ON m.user_id=u.id AND m.status='active'
    JOIN public.organizations member_org ON member_org.id=m.organization_id
    WHERE u.auth_subject=auth.uid()::text AND (
      member_org.type='platform'
      OR ((storage.foldername(name))[1]='organizations' AND m.organization_id=(storage.foldername(name))[2])
      OR ((storage.foldername(name))[1]='products' AND EXISTS (SELECT 1 FROM public.products p WHERE p.id=(storage.foldername(name))[2] AND p.organization_id=m.organization_id))
      OR ((storage.foldername(name))[1]='orders' AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id=(storage.foldername(name))[2] AND (o.supplier_organization_id=m.organization_id OR o.reseller_organization_id=m.organization_id)))
    )
  )
);--> statement-breakpoint

UPDATE order_events SET to_status='paid_awaiting_documents' WHERE to_status='paid';--> statement-breakpoint
UPDATE order_events SET from_status='paid_awaiting_documents' WHERE from_status='paid';--> statement-breakpoint
UPDATE order_events SET to_status='ready_for_supplier' WHERE to_status='awaiting_supplier';--> statement-breakpoint
UPDATE order_events SET from_status='ready_for_supplier' WHERE from_status='awaiting_supplier';
