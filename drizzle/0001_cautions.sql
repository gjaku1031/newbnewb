CREATE TABLE `caution_tags` (
	`caution_id` varchar(64) NOT NULL,
	`tag_id` varchar(64) NOT NULL,
	`sort` int NOT NULL,
	CONSTRAINT `caution_tags_caution_id_tag_id_pk` PRIMARY KEY(`caution_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `caution_wiki` (
	`caution_id` varchar(64) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`sort` int NOT NULL,
	CONSTRAINT `caution_wiki_caution_id_slug_pk` PRIMARY KEY(`caution_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `cautions` (
	`id` varchar(64) NOT NULL,
	`point` varchar(500) NOT NULL,
	`wrong` varchar(1000),
	`by_role` varchar(50),
	`source_kind` varchar(12) NOT NULL,
	`source_id` varchar(128),
	`created_on` date NOT NULL,
	`next_review` date NOT NULL,
	`interval_days` int NOT NULL,
	`archived` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `cautions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `caution_tags` ADD CONSTRAINT `caution_tags_caution_id_cautions_id_fk` FOREIGN KEY (`caution_id`) REFERENCES `cautions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `caution_tags` ADD CONSTRAINT `caution_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `caution_wiki` ADD CONSTRAINT `caution_wiki_caution_id_cautions_id_fk` FOREIGN KEY (`caution_id`) REFERENCES `cautions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `caution_wiki` ADD CONSTRAINT `caution_wiki_slug_wiki_pages_slug_fk` FOREIGN KEY (`slug`) REFERENCES `wiki_pages`(`slug`) ON DELETE cascade ON UPDATE no action;