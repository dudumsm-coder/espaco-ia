CREATE TABLE `credit_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('purchase','subscription_grant','usage','refund','admin_grant') NOT NULL,
	`amount` int NOT NULL,
	`balanceAfter` int NOT NULL,
	`description` text,
	`relatedSessionId` int,
	`relatedMessageId` int,
	`tokensConsumed` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','editor','premium','free') NOT NULL DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `access_levels` ADD `monthlyCredits` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `access_levels` ADD `maxTokensPerMessage` int DEFAULT 4096 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_messages` ADD `tokensUsed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_messages` ADD `creditsCharged` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `totalTokensUsed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `totalCreditsCharged` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD `creditsUsedThisPeriod` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `creditsBalance` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totalTokensUsed` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totalCreditsSpent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `company` varchar(255);