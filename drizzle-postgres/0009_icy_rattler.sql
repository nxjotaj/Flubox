CREATE TABLE "sales_channel_category_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"category_id" text NOT NULL,
	"external_category_id" text NOT NULL,
	"attributes_json" text DEFAULT '{}' NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_channel_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_account_id" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"token_expires_at" text,
	"scopes_json" text DEFAULT '[]' NOT NULL,
	"settings_json" text DEFAULT '{}' NOT NULL,
	"last_synced_at" text,
	"last_error" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_channel_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"connection_id" text,
	"external_event_id" text NOT NULL,
	"type" text NOT NULL,
	"signature_valid" boolean NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"payload_hash" text NOT NULL,
	"payload_json" text NOT NULL,
	"error" text,
	"received_at" text NOT NULL,
	"processed_at" text
);
--> statement-breakpoint
CREATE TABLE "sales_channel_listings" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" text,
	"variant_id" text,
	"external_listing_id" text,
	"external_variant_id" text,
	"external_url" text,
	"external_category_id" text,
	"external_sku" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"pricing_mode" text DEFAULT 'margin' NOT NULL,
	"margin_basis_points" integer,
	"fixed_price_cents" integer,
	"cost_snapshot_cents" integer,
	"published_price_cents" integer,
	"published_stock" integer DEFAULT 0 NOT NULL,
	"safety_stock" integer DEFAULT 0 NOT NULL,
	"validation_json" text DEFAULT '[]' NOT NULL,
	"last_error" text,
	"last_synced_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_channel_oauth_states" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"state_hash" text NOT NULL,
	"return_path" text DEFAULT '/integracoes' NOT NULL,
	"expires_at" text NOT NULL,
	"consumed_at" text,
	"created_at" text NOT NULL,
	CONSTRAINT "sales_channel_oauth_states_state_hash_unique" UNIQUE("state_hash")
);
--> statement-breakpoint
CREATE TABLE "sales_channel_order_links" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"order_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_order_id" text NOT NULL,
	"external_status" text NOT NULL,
	"external_snapshot_json" text NOT NULL,
	"external_url" text,
	"last_synced_at" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "sales_channel_order_links_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "sales_channel_sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"attempted" integer DEFAULT 0 NOT NULL,
	"succeeded" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"cursor" text,
	"error" text,
	"started_at" text NOT NULL,
	"completed_at" text
);
--> statement-breakpoint
ALTER TABLE "sales_channel_category_mappings" ADD CONSTRAINT "sales_channel_category_mappings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel_category_mappings" ADD CONSTRAINT "sales_channel_category_mappings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel_connections" ADD CONSTRAINT "sales_channel_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel_connections" ADD CONSTRAINT "sales_channel_connections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel_events" ADD CONSTRAINT "sales_channel_events_connection_id_sales_channel_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."sales_channel_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel_listings" ADD CONSTRAINT "sales_channel_listings_connection_id_sales_channel_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."sales_channel_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel_listings" ADD CONSTRAINT "sales_channel_listings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel_listings" ADD CONSTRAINT "sales_channel_listings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel_listings" ADD CONSTRAINT "sales_channel_listings_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel_oauth_states" ADD CONSTRAINT "sales_channel_oauth_states_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel_oauth_states" ADD CONSTRAINT "sales_channel_oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel_order_links" ADD CONSTRAINT "sales_channel_order_links_connection_id_sales_channel_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."sales_channel_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel_order_links" ADD CONSTRAINT "sales_channel_order_links_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel_sync_runs" ADD CONSTRAINT "sales_channel_sync_runs_connection_id_sales_channel_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."sales_channel_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_channel_category_mapping" ON "sales_channel_category_mappings" USING btree ("provider","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_channel_connection_account" ON "sales_channel_connections" USING btree ("provider","external_account_id");--> statement-breakpoint
CREATE INDEX "idx_channel_connection_org_status" ON "sales_channel_connections" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_channel_event_provider_external" ON "sales_channel_events" USING btree ("provider","external_event_id");--> statement-breakpoint
CREATE INDEX "idx_channel_event_status" ON "sales_channel_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_channel_listing_external" ON "sales_channel_listings" USING btree ("connection_id","external_listing_id","external_variant_id");--> statement-breakpoint
CREATE INDEX "idx_channel_listing_product" ON "sales_channel_listings" USING btree ("product_id","variant_id");--> statement-breakpoint
CREATE INDEX "idx_channel_listing_org_status" ON "sales_channel_listings" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_oauth_state_expiry" ON "sales_channel_oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_channel_external_order" ON "sales_channel_order_links" USING btree ("provider","connection_id","external_order_id");--> statement-breakpoint
CREATE INDEX "idx_channel_sync_connection" ON "sales_channel_sync_runs" USING btree ("connection_id");
--> statement-breakpoint
INSERT INTO "permissions" ("id","key","description","created_at") VALUES ('permission:integrations.manage','integrations.manage','Conectar canais e gerenciar anúncios',NOW()::text) ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id","permission_id") VALUES ('role:reseller_owner','permission:integrations.manage'),('role:platform_admin','permission:integrations.manage') ON CONFLICT DO NOTHING;
