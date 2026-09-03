CREATE TABLE `addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`type` text DEFAULT 'primary' NOT NULL,
	`postal_code` text NOT NULL,
	`street` text NOT NULL,
	`number` text NOT NULL,
	`complement` text,
	`district` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`country` text DEFAULT 'BR' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_addresses_org_type` ON `addresses` (`organization_id`,`type`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`type` text NOT NULL,
	`storage_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_storage_key_unique` ON `documents` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_documents_org_status` ON `documents` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `reseller_profiles` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`person_type` text DEFAULT 'individual' NOT NULL,
	`cpf` text NOT NULL,
	`full_name` text NOT NULL,
	`phone` text NOT NULL,
	`onboarding_step` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reseller_profiles_cpf_unique` ON `reseller_profiles` (`cpf`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`monthly_amount_cents` integer NOT NULL,
	`grace_period_days` integer NOT NULL,
	`provider` text,
	`external_reference` text,
	`current_period_start` text,
	`current_period_end` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_organization_id_unique` ON `subscriptions` (`organization_id`);--> statement-breakpoint
CREATE TABLE `supplier_profiles` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`cnpj` text NOT NULL,
	`legal_name` text NOT NULL,
	`trade_name` text NOT NULL,
	`state_registration` text,
	`responsible_name` text NOT NULL,
	`responsible_cpf` text NOT NULL,
	`responsible_email` text NOT NULL,
	`responsible_phone` text NOT NULL,
	`reputation_basis_points` integer DEFAULT 10000 NOT NULL,
	`onboarding_step` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_profiles_cnpj_unique` ON `supplier_profiles` (`cnpj`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`field` text NOT NULL,
	`value_hash` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`source` text NOT NULL,
	`checked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_verifications_org_field` ON `verifications` (`organization_id`,`field`);