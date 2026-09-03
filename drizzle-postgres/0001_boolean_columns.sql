ALTER TABLE "category_attributes" ALTER COLUMN "required" SET DATA TYPE boolean USING ("required" <> 0);--> statement-breakpoint
ALTER TABLE "webhook_events" ALTER COLUMN "signature_valid" SET DATA TYPE boolean USING ("signature_valid" <> 0);
