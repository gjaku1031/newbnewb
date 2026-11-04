ALTER TABLE `sources` ADD `text` mediumtext;--> statement-breakpoint
ALTER TABLE `sources` ADD `wiki_status` varchar(12);--> statement-breakpoint
ALTER TABLE `sources` ADD `wiki_result` json;--> statement-breakpoint
ALTER TABLE `sources` ADD `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL;