ALTER TABLE `organization_invitations` ADD `token_hash` text;--> statement-breakpoint
ALTER TABLE `organization_invitations` ADD `accepted_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `organization_invitations` ADD `accepted_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invitations_token_hash` ON `organization_invitations` (`token_hash`);