-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fid` INTEGER NOT NULL,
    `username` VARCHAR(255) NOT NULL,
    `photoUrl` VARCHAR(255) NULL,
    `points` INTEGER NOT NULL DEFAULT 0,
    `role` VARCHAR(255) NOT NULL,
    `notificationsEnabled` TINYINT NOT NULL DEFAULT 0,
    `notificationToken` VARCHAR(255) NULL,
    `notificationUrl` VARCHAR(255) NULL,
    `lastVoteReminderSent` DATETIME(0) NULL,
    `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `IDX_bcddf01b1467f9a77272c611eb`(`fid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `brands` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `url` VARCHAR(255) NOT NULL,
    `warpcastUrl` VARCHAR(255) NOT NULL,
    `description` VARCHAR(4096) NOT NULL,
    `followerCount` INTEGER NOT NULL,
    `imageUrl` VARCHAR(255) NOT NULL,
    `profile` VARCHAR(255) NOT NULL,
    `channel` VARCHAR(255) NOT NULL,
    `ranking` VARCHAR(255) NOT NULL,
    `score` INTEGER NOT NULL,
    `stateScore` INTEGER NOT NULL,
    `scoreWeek` INTEGER NOT NULL,
    `stateScoreWeek` INTEGER NOT NULL,
    `rankingWeek` INTEGER NOT NULL DEFAULT 0,
    `scoreMonth` INTEGER NOT NULL DEFAULT 0,
    `stateScoreMonth` INTEGER NOT NULL DEFAULT 0,
    `rankingMonth` INTEGER NOT NULL DEFAULT 0,
    `bonusPoints` INTEGER NOT NULL DEFAULT 0,
    `banned` INTEGER NOT NULL DEFAULT 0,
    `queryType` INTEGER NOT NULL,
    `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `categoryId` INTEGER NULL,
    `currentRanking` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `IDX_96db6bbbaa6f23cad26871339b`(`name`),
    INDEX `FK_b209d7ccd90ae0ca1605794a0d5`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `brand_tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tagId` INTEGER NULL,
    `brandId` INTEGER NULL,

    INDEX `FK_61cac79f662e07af6305574a6de`(`brandId`),
    INDEX `FK_91163d446be29da2d5b330d2472`(`tagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_brand_votes` (
    `id` VARCHAR(36) NOT NULL,
    `date` DATETIME(0) NOT NULL,
    `shared` TINYINT NOT NULL DEFAULT 0,
    `castHash` VARCHAR(255) NULL,
    `userId` INTEGER NULL,
    `brand1Id` INTEGER NULL,
    `brand2Id` INTEGER NULL,
    `brand3Id` INTEGER NULL,

    INDEX `FK_047a3eabf2da1aa24e440f7076a`(`brand3Id`),
    INDEX `FK_c6c4f42ef71f6700e122b54b953`(`userId`),
    INDEX `FK_dbe6c26f34814fbcbd43afe190d`(`brand1Id`),
    INDEX `FK_f3ccd1da182ddf92ac5330fc876`(`brand2Id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_daily_actions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shareFirstTime` TINYINT NOT NULL,
    `userId` INTEGER NULL,

    INDEX `FK_df26a68356ab6df57cbea3604e7`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `farcaster_user_cache` (
    `fid` INTEGER NOT NULL,
    `username` VARCHAR(255) NULL,
    `displayName` VARCHAR(255) NULL,
    `pfpUrl` VARCHAR(512) NULL,
    `data` JSON NOT NULL,
    `fetchedAt` DATETIME(6) NOT NULL,
    `expiresAt` DATETIME(6) NOT NULL,
    `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `IDX_farcaster_user_cache_username`(`username`),
    INDEX `IDX_farcaster_user_cache_expiresAt`(`expiresAt`),
    PRIMARY KEY (`fid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `farcaster_channel_cache` (
    `channelId` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NULL,
    `url` VARCHAR(512) NULL,
    `imageUrl` VARCHAR(512) NULL,
    `data` JSON NOT NULL,
    `fetchedAt` DATETIME(6) NOT NULL,
    `expiresAt` DATETIME(6) NOT NULL,
    `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `IDX_farcaster_channel_cache_expiresAt`(`expiresAt`),
    PRIMARY KEY (`channelId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_queue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` ENUM('daily_reminder', 'evening_reminder', 'weekly_rankings', 'monthly_winner', 'welcome', 'leaderboard_update', 'brand_milestone') NOT NULL DEFAULT 'daily_reminder',
    `notificationId` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `body` TEXT NOT NULL,
    `targetUrl` VARCHAR(255) NOT NULL,
    `status` ENUM('pending', 'sent', 'failed', 'skipped', 'processing') NOT NULL DEFAULT 'pending',
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `scheduledFor` DATETIME(0) NOT NULL,
    `sentAt` DATETIME(0) NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `IDX_15a8115eac601471b29496a20e`(`userId`, `type`),
    INDEX `IDX_847ea567c386fe5373d6ece0d0`(`status`, `scheduledFor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `brands` ADD CONSTRAINT `FK_b209d7ccd90ae0ca1605794a0d5` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `brand_tags` ADD CONSTRAINT `FK_61cac79f662e07af6305574a6de` FOREIGN KEY (`brandId`) REFERENCES `brands`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `brand_tags` ADD CONSTRAINT `FK_91163d446be29da2d5b330d2472` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_brand_votes` ADD CONSTRAINT `FK_047a3eabf2da1aa24e440f7076a` FOREIGN KEY (`brand3Id`) REFERENCES `brands`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_brand_votes` ADD CONSTRAINT `FK_c6c4f42ef71f6700e122b54b953` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_brand_votes` ADD CONSTRAINT `FK_dbe6c26f34814fbcbd43afe190d` FOREIGN KEY (`brand1Id`) REFERENCES `brands`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_brand_votes` ADD CONSTRAINT `FK_f3ccd1da182ddf92ac5330fc876` FOREIGN KEY (`brand2Id`) REFERENCES `brands`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_daily_actions` ADD CONSTRAINT `FK_df26a68356ab6df57cbea3604e7` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `notification_queue` ADD CONSTRAINT `FK_283f60a228e181e23cab6f3eed1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
