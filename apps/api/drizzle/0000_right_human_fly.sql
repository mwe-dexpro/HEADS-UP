CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_log_user_idx` ON `audit_log` (`user_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`start` text NOT NULL,
	`end` text,
	`all_day` integer DEFAULT false NOT NULL,
	`location` text,
	`description` text,
	`recurrence_rule` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_user_idx` ON `events` (`user_id`);--> statement-breakpoint
CREATE INDEX `events_user_start_idx` ON `events` (`user_id`,`start`);--> statement-breakpoint
CREATE TABLE `lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lists_user_idx` ON `lists` (`user_id`);--> statement-breakpoint
CREATE TABLE `rate_limit_buckets` (
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key`, `window_start`)
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`family_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_tokens_token_hash_unique` ON `refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_family_idx` ON `refresh_tokens` (`family_id`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`kind` text NOT NULL,
	`minutes_before` integer,
	`at` text,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminders_task_idx` ON `reminders` (`task_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_id` text,
	`list_id` text,
	`name` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`done_at` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`due_at` text,
	`order` integer DEFAULT 0 NOT NULL,
	`recurrence_rule` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_user_idx` ON `tasks` (`user_id`);--> statement-breakpoint
CREATE INDEX `tasks_event_idx` ON `tasks` (`event_id`);--> statement-breakpoint
CREATE INDEX `tasks_list_idx` ON `tasks` (`list_id`);--> statement-breakpoint
CREATE INDEX `tasks_user_due_idx` ON `tasks` (`user_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`ms_account_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_ms_account_id_unique` ON `users` (`ms_account_id`);