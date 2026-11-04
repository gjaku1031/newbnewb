CREATE TABLE `scheduled_runs` (
	`job` varchar(32) NOT NULL,
	`run_date` date NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`finished_at` datetime(3),
	`error` varchar(500),
	CONSTRAINT `scheduled_runs_job_run_date_pk` PRIMARY KEY(`job`,`run_date`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int NOT NULL,
	`morning_time` varchar(5) NOT NULL DEFAULT '08:00',
	`days` json NOT NULL,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`)
);
