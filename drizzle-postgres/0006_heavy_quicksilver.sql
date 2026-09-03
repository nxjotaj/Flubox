CREATE TABLE "fulfillment_assignments" (
	"order_id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"assigned_by" text NOT NULL,
	"assigned_at" text NOT NULL,
	"completed_at" text
);
--> statement-breakpoint
CREATE TABLE "member_permission_overrides" (
	"member_id" text NOT NULL,
	"permission_key" text NOT NULL,
	"allowed" boolean DEFAULT false NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "member_permission_overrides_member_id_permission_key_pk" PRIMARY KEY("member_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "order_anomalies" (
	"id" text PRIMARY KEY NOT NULL,
	"reseller_organization_id" text NOT NULL,
	"supplier_organization_id" text,
	"product_id" text,
	"type" text NOT NULL,
	"requested_quantity" integer,
	"available_quantity" integer,
	"metadata" text,
	"resolved_at" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_followers" (
	"reseller_organization_id" text NOT NULL,
	"supplier_organization_id" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "supplier_followers_reseller_organization_id_supplier_organization_id_pk" PRIMARY KEY("reseller_organization_id","supplier_organization_id")
);
--> statement-breakpoint
ALTER TABLE "order_documents" ADD COLUMN "quantity_covered" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_documents" ADD COLUMN "barcode_value" text;--> statement-breakpoint
ALTER TABLE "fulfillment_assignments" ADD CONSTRAINT "fulfillment_assignments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_assignments" ADD CONSTRAINT "fulfillment_assignments_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_assignments" ADD CONSTRAINT "fulfillment_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_permission_overrides" ADD CONSTRAINT "member_permission_overrides_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_permission_overrides" ADD CONSTRAINT "member_permission_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_anomalies" ADD CONSTRAINT "order_anomalies_reseller_organization_id_organizations_id_fk" FOREIGN KEY ("reseller_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_anomalies" ADD CONSTRAINT "order_anomalies_supplier_organization_id_organizations_id_fk" FOREIGN KEY ("supplier_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_anomalies" ADD CONSTRAINT "order_anomalies_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_anomalies" ADD CONSTRAINT "order_anomalies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_followers" ADD CONSTRAINT "supplier_followers_reseller_organization_id_organizations_id_fk" FOREIGN KEY ("reseller_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_followers" ADD CONSTRAINT "supplier_followers_supplier_organization_id_organizations_id_fk" FOREIGN KEY ("supplier_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_followers" ADD CONSTRAINT "supplier_followers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_fulfillment_member" ON "fulfillment_assignments" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_order_anomalies_supplier_created" ON "order_anomalies" USING btree ("supplier_organization_id","created_at");