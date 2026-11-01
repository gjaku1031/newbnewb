CREATE TABLE `auth_challenges` (
	`id` char(32) NOT NULL,
	`challenge` varchar(128) NOT NULL,
	`purpose` varchar(12) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `auth_challenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_invites` (
	`token_hash` char(64) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`expires_at` datetime(3) NOT NULL,
	`used_at` datetime(3),
	CONSTRAINT `auth_invites_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id_hash` char(64) NOT NULL,
	`passkey_id` varchar(255) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `auth_sessions_id_hash` PRIMARY KEY(`id_hash`)
);
--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` varchar(255) NOT NULL,
	`public_key` text NOT NULL,
	`counter` bigint unsigned NOT NULL DEFAULT 0,
	`transports` json,
	`device_type` varchar(16) NOT NULL,
	`backed_up` boolean NOT NULL,
	`name` varchar(100) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_used_at` datetime(3),
	CONSTRAINT `passkeys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_passkey_id_passkeys_id_fk` FOREIGN KEY (`passkey_id`) REFERENCES `passkeys`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auth_challenges_expires` ON `auth_challenges` (`expires_at`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expires` ON `auth_sessions` (`expires_at`);