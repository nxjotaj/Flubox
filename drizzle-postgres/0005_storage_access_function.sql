CREATE OR REPLACE FUNCTION public.flubox_can_access_storage(subject text, object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.organization_members m ON m.user_id=u.id AND m.status='active'
    JOIN public.organizations member_org ON member_org.id=m.organization_id
    WHERE u.auth_subject=subject AND (
      member_org.type='platform'
      OR (split_part(object_name,'/',1)='organizations' AND m.organization_id=split_part(object_name,'/',2))
      OR (split_part(object_name,'/',1)='products' AND EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id=split_part(object_name,'/',2) AND p.organization_id=m.organization_id
      ))
      OR (split_part(object_name,'/',1)='orders' AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id=split_part(object_name,'/',2)
          AND (o.supplier_organization_id=m.organization_id OR o.reseller_organization_id=m.organization_id)
      ))
    )
  )
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.flubox_can_access_storage(text,text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.flubox_can_access_storage(text,text) TO authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.flubox_can_access_storage(text,text) TO service_role;--> statement-breakpoint

DROP POLICY IF EXISTS "flubox_files_insert" ON storage.objects;--> statement-breakpoint
CREATE POLICY "flubox_files_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='flubox-files'
  AND public.flubox_can_access_storage(auth.uid()::text,name)
);--> statement-breakpoint

DROP POLICY IF EXISTS "flubox_files_select" ON storage.objects;--> statement-breakpoint
CREATE POLICY "flubox_files_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='flubox-files'
  AND public.flubox_can_access_storage(auth.uid()::text,name)
);
