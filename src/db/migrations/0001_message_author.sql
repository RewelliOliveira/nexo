ALTER TABLE `messages` ADD `author_id` text REFERENCES employees(id);--> statement-breakpoint
ALTER TABLE `messages` ADD `outside_agent` integer DEFAULT false NOT NULL;