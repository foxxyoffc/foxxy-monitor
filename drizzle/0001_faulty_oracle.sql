CREATE TABLE `activityLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`targetUserId` int,
	`action` varchar(120) NOT NULL,
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activityLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(150) NOT NULL,
	`content` text NOT NULL,
	`isPinned` boolean NOT NULL DEFAULT false,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appSettings` (
	`id` int NOT NULL,
	`siteTitle` varchar(80) NOT NULL DEFAULT 'Foxxy Monitor',
	`logoUrl` text,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blockedDevices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceHash` varchar(128) NOT NULL,
	`ipHash` varchar(128) NOT NULL,
	`blockedByUserId` int NOT NULL,
	`reason` varchar(255) NOT NULL DEFAULT 'Diblokir oleh owner',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blockedDevices_id` PRIMARY KEY(`id`),
	CONSTRAINT `blocked_device_unique` UNIQUE(`userId`,`deviceHash`,`ipHash`)
);
--> statement-breakpoint
CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`senderUserId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`deletedAt` timestamp,
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dailyMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`metricDate` varchar(10) NOT NULL,
	`appKey` enum('apk1','apk2','apk3') NOT NULL,
	`premiumPayments` int NOT NULL DEFAULT 0,
	`pending` int NOT NULL DEFAULT 0,
	`success` int NOT NULL DEFAULT 0,
	`canceled` int NOT NULL DEFAULT 0,
	`failed` int NOT NULL DEFAULT 0,
	`revenue` int NOT NULL DEFAULT 0,
	`adsRevenue` int NOT NULL DEFAULT 0,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dailyMetrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_metrics_unique` UNIQUE(`metricDate`,`appKey`)
);
--> statement-breakpoint
CREATE TABLE `financialRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('maintenance','savings') NOT NULL,
	`amount` int NOT NULL,
	`note` varchar(255),
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`createdByUserId` int NOT NULL,
	CONSTRAINT `financialRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`deviceHash` varchar(128) NOT NULL,
	`ipHash` varchar(128) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(120);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','owner','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `googleSubject` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','blacklisted','deleted') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `adminNumber` int;--> statement-breakpoint
ALTER TABLE `users` ADD `lastDeviceHash` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `lastIpHash` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_googleSubject_unique` UNIQUE(`googleSubject`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);--> statement-breakpoint
CREATE INDEX `activity_created_idx` ON `activityLogs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `announcement_created_idx` ON `announcements` (`createdAt`);--> statement-breakpoint
CREATE INDEX `blocked_user_idx` ON `blockedDevices` (`userId`);--> statement-breakpoint
CREATE INDEX `chat_created_idx` ON `chatMessages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `financial_type_date_idx` ON `financialRecords` (`type`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `sessions_user_active_idx` ON `sessions` (`userId`,`isActive`);--> statement-breakpoint
CREATE INDEX `users_role_status_idx` ON `users` (`role`,`status`);
