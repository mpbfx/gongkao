-- DropForeignKey
ALTER TABLE `ImportJob` DROP FOREIGN KEY `ImportJob_userId_fkey`;

-- AlterTable
ALTER TABLE `ImportJob` MODIFY `userId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `KnowledgeSource` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'BILIBILI_SUBTITLE',
    `title` VARCHAR(191) NOT NULL,
    `bvid` VARCHAR(191) NOT NULL,
    `partNo` INTEGER NOT NULL,
    `sourceFile` VARCHAR(191) NOT NULL,
    `contentHash` VARCHAR(191) NULL,
    `durationMs` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KnowledgeSource_bvid_partNo_key`(`bvid`, `partNo`),
    INDEX `KnowledgeSource_status_idx`(`status`),
    INDEX `KnowledgeSource_contentHash_idx`(`contentHash`),
    INDEX `KnowledgeSource_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `KnowledgeChunk` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `chunkNo` INTEGER NOT NULL,
    `startMs` INTEGER NOT NULL,
    `endMs` INTEGER NOT NULL,
    `rawText` TEXT NOT NULL,
    `cleanText` TEXT NOT NULL,
    `keywords` TEXT NULL,
    `category` VARCHAR(191) NULL,
    `tagId` VARCHAR(191) NULL,
    `contentHash` VARCHAR(191) NOT NULL,
    `vectorPointId` VARCHAR(191) NOT NULL,
    `indexStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `indexError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KnowledgeChunk_contentHash_key`(`contentHash`),
    UNIQUE INDEX `KnowledgeChunk_vectorPointId_key`(`vectorPointId`),
    UNIQUE INDEX `KnowledgeChunk_sourceId_chunkNo_key`(`sourceId`, `chunkNo`),
    INDEX `KnowledgeChunk_sourceId_idx`(`sourceId`),
    INDEX `KnowledgeChunk_tagId_idx`(`tagId`),
    INDEX `KnowledgeChunk_category_idx`(`category`),
    INDEX `KnowledgeChunk_indexStatus_idx`(`indexStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `KnowledgeChatSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgeChatSession_userId_updatedAt_idx`(`userId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `KnowledgeChatMessage` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `citationsJson` JSON NULL,
    `metadataJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KnowledgeChatMessage_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeChunk` ADD CONSTRAINT `KnowledgeChunk_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `KnowledgeSource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeChunk` ADD CONSTRAINT `KnowledgeChunk_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `QuestionTag`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeChatSession` ADD CONSTRAINT `KnowledgeChatSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeChatMessage` ADD CONSTRAINT `KnowledgeChatMessage_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `KnowledgeChatSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
