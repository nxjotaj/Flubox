CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`user_id` text,
	`type` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`properties_json` text,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_type_occurred` ON `analytics_events` (`type`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_analytics_org_occurred` ON `analytics_events` (`organization_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `reputation_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`score_basis_points` integer NOT NULL,
	`components_json` text NOT NULL,
	`weights_json` text NOT NULL,
	`source_window_start` text NOT NULL,
	`source_window_end` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_reputation_org_created` ON `reputation_snapshots` (`organization_id`,`created_at`);