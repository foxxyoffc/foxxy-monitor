CREATE TABLE `savingsEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`type` enum('deposit','withdrawal') NOT NULL,
	`amount` int NOT NULL,
	`note` varchar(255),
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`createdByUserId` int NOT NULL,
	CONSTRAINT `savingsEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `savingsPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`durationMonths` enum('1','3','12') NOT NULL,
	`targetAmount` int NOT NULL,
	`startDate` varchar(10) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `savingsPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `savings_entry_plan_date_idx` ON `savingsEntries` (`planId`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `savings_plan_active_idx` ON `savingsPlans` (`isActive`,`startDate`);
