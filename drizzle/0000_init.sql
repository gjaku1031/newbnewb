CREATE TABLE `sources` (
	`id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`object_key` varchar(512) NOT NULL,
	`content_type` varchar(255) NOT NULL,
	`size_bytes` bigint unsigned NOT NULL,
	`sha256` char(64) NOT NULL,
	`trust_level` tinyint unsigned NOT NULL DEFAULT 0,
	`uploaded_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `sources_object_key_unique` UNIQUE(`object_key`)
);
--> statement-breakpoint
CREATE INDEX `sources_uploaded_at_idx` ON `sources` (`uploaded_at`);