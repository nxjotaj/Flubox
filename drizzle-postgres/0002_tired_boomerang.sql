CREATE TABLE "payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text,
	"provider_method_token" text NOT NULL,
	"brand" text NOT NULL,
	"last_four" text NOT NULL,
	"expiry_month" integer NOT NULL,
	"expiry_year" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payment_methods_org" ON "payment_methods" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payment_methods_org_active" ON "payment_methods" ("organization_id") WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_order_documents_order_type" ON "order_documents" ("order_id", "type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orders_status_updated" ON "orders" ("status", "updated_at");--> statement-breakpoint
UPDATE "products" SET "status" = 'approved', "updated_at" = NOW()::text WHERE "status" IN ('awaiting_review', 'pending_review') AND "quality_score" >= 80;--> statement-breakpoint
UPDATE "orders" SET "status" = 'paid_awaiting_documents', "updated_at" = NOW()::text WHERE "status" = 'paid';--> statement-breakpoint
UPDATE "orders" SET "status" = 'ready_for_supplier', "updated_at" = NOW()::text WHERE "status" = 'awaiting_supplier';
