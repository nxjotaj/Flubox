CREATE TABLE `payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`gross_cents` integer NOT NULL,
	`fee_cents` integer DEFAULT 0 NOT NULL,
	`net_cents` integer NOT NULL,
	`provider` text,
	`external_reference` text,
	`scheduled_at` text,
	`paid_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_payouts_org_status` ON `payouts` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `reconciliation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`expected_cents` integer NOT NULL,
	`observed_cents` integer NOT NULL,
	`difference_cents` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reconciliation_period` ON `reconciliation_runs` (`period_start`,`period_end`);--> statement-breakpoint
CREATE TABLE `subscription_events` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_cents` integer,
	`external_reference` text,
	`reason` text,
	`occurred_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_subscription_events_subscription` ON `subscription_events` (`subscription_id`,`occurred_at`);--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD `currency` text DEFAULT 'BRL' NOT NULL;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD `status` text DEFAULT 'posted' NOT NULL;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD `external_reference` text;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD `metadata` text;