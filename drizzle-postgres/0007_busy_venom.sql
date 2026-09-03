CREATE TABLE "manual_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"incurred_at" text NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"reversed_expense_id" text,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"gtin" text,
	"attributes_json" text DEFAULT '{}' NOT NULL,
	"price_cents" integer NOT NULL,
	"suggested_retail_cents" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_fee_exemptions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"starts_at" text NOT NULL,
	"ends_at" text,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"revoked_by" text,
	"revoked_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "administrative_notes" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "archived_at" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "short_description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "net_weight_grams" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gross_weight_grams" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_height_mm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_width_mm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_length_mm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "package_height_mm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "package_width_mm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "package_length_mm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "composition" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "voltage" text;--> statement-breakpoint
ALTER TABLE "reseller_profiles" ADD COLUMN "avatar_storage_key" text;--> statement-breakpoint
ALTER TABLE "reseller_profiles" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "reseller_profiles" ADD COLUMN "bank_branch" text;--> statement-breakpoint
ALTER TABLE "reseller_profiles" ADD COLUMN "bank_account" text;--> statement-breakpoint
ALTER TABLE "reseller_profiles" ADD COLUMN "bank_account_type" text;--> statement-breakpoint
ALTER TABLE "reseller_profiles" ADD COLUMN "pix_key" text;--> statement-breakpoint
ALTER TABLE "reseller_profiles" ADD COLUMN "deactivated_until" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" text;--> statement-breakpoint
ALTER TABLE "manual_expenses" ADD CONSTRAINT "manual_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_fee_exemptions" ADD CONSTRAINT "supplier_fee_exemptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_fee_exemptions" ADD CONSTRAINT "supplier_fee_exemptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_fee_exemptions" ADD CONSTRAINT "supplier_fee_exemptions_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_manual_expenses_date" ON "manual_expenses" USING btree ("incurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variants_product_sku" ON "product_variants" USING btree ("product_id","sku");--> statement-breakpoint
CREATE INDEX "idx_product_variants_product_status" ON "product_variants" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "idx_fee_exemptions_org_status" ON "supplier_fee_exemptions" USING btree ("organization_id","status");