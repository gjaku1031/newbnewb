CREATE TABLE `briefings` (
	`kind` varchar(8) NOT NULL,
	`date` date NOT NULL,
	`generated_at` datetime NOT NULL,
	`payload` json NOT NULL,
	CONSTRAINT `briefings_kind_date_pk` PRIMARY KEY(`kind`,`date`)
);
--> statement-breakpoint
CREATE TABLE `item_sub_items` (
	`item_id` varchar(64) NOT NULL,
	`id` varchar(64) NOT NULL,
	`title` varchar(500) NOT NULL,
	`done` boolean NOT NULL DEFAULT false,
	`sort` int NOT NULL,
	CONSTRAINT `item_sub_items_item_id_id_pk` PRIMARY KEY(`item_id`,`id`)
);
--> statement-breakpoint
CREATE TABLE `item_tags` (
	`item_id` varchar(64) NOT NULL,
	`tag_id` varchar(64) NOT NULL,
	`sort` int NOT NULL,
	CONSTRAINT `item_tags_item_id_tag_id_pk` PRIMARY KEY(`item_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `item_wiki_refs` (
	`item_id` varchar(64) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`sort` int NOT NULL,
	CONSTRAINT `item_wiki_refs_item_id_slug_pk` PRIMARY KEY(`item_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`kind` varchar(8) NOT NULL,
	`start_at` datetime,
	`end_at` datetime,
	`all_day` boolean NOT NULL DEFAULT false,
	`due` date,
	`priority` varchar(2),
	`status` varchar(8),
	`from_text` varchar(255),
	`description` text,
	`location` varchar(255),
	`waiting_for` varchar(500),
	`brief` text,
	`created_on` date NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memos` (
	`id` varchar(64) NOT NULL,
	`text` text NOT NULL,
	`at` datetime NOT NULL,
	`status` varchar(12) NOT NULL,
	`result` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `memos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`role` varchar(50) NOT NULL,
	CONSTRAINT `people_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` varchar(64) NOT NULL,
	`asked_at` datetime NOT NULL,
	`question` text NOT NULL,
	`verdict` varchar(24) NOT NULL,
	`confidence` double NOT NULL,
	`signals` json NOT NULL,
	`rationale` text NOT NULL,
	`answer` text,
	`citations` json NOT NULL,
	`missing` json NOT NULL,
	`status` varchar(12) NOT NULL,
	`item_id` varchar(64),
	`feedback` varchar(4),
	`model_id` varchar(64) NOT NULL,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reschedule_proposals` (
	`id` varchar(64) NOT NULL,
	`at` datetime NOT NULL,
	`summary` text NOT NULL,
	`items` json NOT NULL,
	`applied_at` datetime(3),
	CONSTRAINT `reschedule_proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`type` varchar(16) NOT NULL,
	`file_type` varchar(8) NOT NULL,
	`added_on` date NOT NULL,
	`object_key` varchar(512),
	`content_type` varchar(255),
	`size_bytes` bigint unsigned,
	`sha256` char(64),
	`author` varchar(100),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `sources_object_key_unique` UNIQUE(`object_key`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` varchar(64) NOT NULL,
	`label` varchar(50) NOT NULL,
	`color` varchar(16) NOT NULL,
	`sort` int NOT NULL DEFAULT 0,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wiki_comments` (
	`id` varchar(64) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`anchor` json,
	`text` text NOT NULL,
	`at` datetime NOT NULL,
	`status` varchar(12) NOT NULL,
	`revision_id` varchar(128),
	`note` varchar(500),
	CONSTRAINT `wiki_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wiki_links` (
	`from_slug` varchar(128) NOT NULL,
	`to_slug` varchar(128) NOT NULL,
	`sort` int NOT NULL,
	CONSTRAINT `wiki_links_from_slug_to_slug_pk` PRIMARY KEY(`from_slug`,`to_slug`)
);
--> statement-breakpoint
CREATE TABLE `wiki_page_sources` (
	`slug` varchar(128) NOT NULL,
	`source_id` varchar(64) NOT NULL,
	`sort` int NOT NULL,
	CONSTRAINT `wiki_page_sources_slug_source_id_pk` PRIMARY KEY(`slug`,`source_id`)
);
--> statement-breakpoint
CREATE TABLE `wiki_pages` (
	`slug` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` varchar(64) NOT NULL,
	`summary` varchar(1000) NOT NULL,
	`body` mediumtext NOT NULL,
	`created_on` date NOT NULL,
	`updated_on` date NOT NULL,
	`next_review` date NOT NULL,
	`interval_days` int NOT NULL,
	`review_count` int NOT NULL DEFAULT 0,
	`issues` json,
	`internal_notes` json,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `wiki_pages_slug` PRIMARY KEY(`slug`)
);
--> statement-breakpoint
CREATE TABLE `wiki_revisions` (
	`id` varchar(128) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`version` int NOT NULL,
	`at` datetime NOT NULL,
	`author` varchar(8) NOT NULL,
	`status` varchar(12) NOT NULL,
	`message` varchar(500) NOT NULL,
	`before` json NOT NULL,
	`after` json NOT NULL,
	`conflicts` json NOT NULL,
	`comment_ids` json,
	`edits` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `wiki_revisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `wiki_revisions_slug_version` UNIQUE(`slug`,`version`)
);
--> statement-breakpoint
ALTER TABLE `item_sub_items` ADD CONSTRAINT `item_sub_items_item_id_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_tags` ADD CONSTRAINT `item_tags_item_id_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_tags` ADD CONSTRAINT `item_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_wiki_refs` ADD CONSTRAINT `item_wiki_refs_item_id_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_wiki_refs` ADD CONSTRAINT `item_wiki_refs_slug_wiki_pages_slug_fk` FOREIGN KEY (`slug`) REFERENCES `wiki_pages`(`slug`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questions` ADD CONSTRAINT `questions_item_id_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wiki_comments` ADD CONSTRAINT `wiki_comments_slug_wiki_pages_slug_fk` FOREIGN KEY (`slug`) REFERENCES `wiki_pages`(`slug`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wiki_comments` ADD CONSTRAINT `wiki_comments_revision_id_wiki_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `wiki_revisions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wiki_links` ADD CONSTRAINT `wiki_links_from_slug_wiki_pages_slug_fk` FOREIGN KEY (`from_slug`) REFERENCES `wiki_pages`(`slug`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wiki_page_sources` ADD CONSTRAINT `wiki_page_sources_slug_wiki_pages_slug_fk` FOREIGN KEY (`slug`) REFERENCES `wiki_pages`(`slug`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wiki_page_sources` ADD CONSTRAINT `wiki_page_sources_source_id_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wiki_revisions` ADD CONSTRAINT `wiki_revisions_slug_wiki_pages_slug_fk` FOREIGN KEY (`slug`) REFERENCES `wiki_pages`(`slug`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `items_start_idx` ON `items` (`start_at`);--> statement-breakpoint
CREATE INDEX `items_due_idx` ON `items` (`due`);--> statement-breakpoint
CREATE INDEX `wiki_revisions_status_idx` ON `wiki_revisions` (`status`);