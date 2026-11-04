CREATE TABLE `oauth_clients` (
	`id` varchar(64) NOT NULL,
	`name` varchar(200) NOT NULL,
	`redirect_uris` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `oauth_clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_codes` (
	`code_hash` char(64) NOT NULL,
	`client_id` varchar(64) NOT NULL,
	`redirect_uri` varchar(1000) NOT NULL,
	`code_challenge` varchar(128) NOT NULL,
	`scope` varchar(200),
	`resource` varchar(500),
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `oauth_codes_code_hash` PRIMARY KEY(`code_hash`)
);
--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`token_hash` char(64) NOT NULL,
	`kind` varchar(8) NOT NULL,
	`grant_id` char(32) NOT NULL,
	`client_id` varchar(64) NOT NULL,
	`scope` varchar(200),
	`resource` varchar(500),
	`expires_at` datetime(3) NOT NULL,
	`last_used_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `oauth_tokens_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `oauth_codes` ADD CONSTRAINT `oauth_codes_client_id_oauth_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_tokens` ADD CONSTRAINT `oauth_tokens_client_id_oauth_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `oauth_tokens_grant` ON `oauth_tokens` (`grant_id`);--> statement-breakpoint
CREATE INDEX `oauth_tokens_expires` ON `oauth_tokens` (`expires_at`);