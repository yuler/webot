CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`wechat_user_id` text,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`wechat_message_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_user_id_idx` ON `messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `messages_created_at_idx` ON `messages` (`created_at`);--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `otp_codes_email_idx` ON `otp_codes` (`email`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_token_hash_idx` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `wechat_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bind_code` text NOT NULL,
	`wechat_user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`bound_at` text,
	`disconnected_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wechat_bindings_user_id_unique` ON `wechat_bindings` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wechat_bindings_bind_code_unique` ON `wechat_bindings` (`bind_code`);--> statement-breakpoint
CREATE INDEX `wechat_bindings_bind_code_idx` ON `wechat_bindings` (`bind_code`);--> statement-breakpoint
CREATE INDEX `wechat_bindings_wechat_user_id_idx` ON `wechat_bindings` (`wechat_user_id`);