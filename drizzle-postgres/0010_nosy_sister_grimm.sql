CREATE TABLE "notification_preferences" (
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"email_operations" boolean DEFAULT true NOT NULL,
	"email_orders" boolean DEFAULT true NOT NULL,
	"email_messages" boolean DEFAULT true NOT NULL,
	"email_marketing" boolean DEFAULT false NOT NULL,
	"browser_notifications" boolean DEFAULT true NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "notification_preferences_user_id_organization_id_pk" PRIMARY KEY("user_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "supplier_profiles" ADD COLUMN "logo_storage_key" text;--> statement-breakpoint
ALTER TABLE "supplier_profiles" ADD COLUMN "public_profile_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;