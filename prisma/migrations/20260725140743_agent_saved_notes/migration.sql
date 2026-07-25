-- CreateTable
CREATE TABLE `AgentNote` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `source` ENUM('TUTOR', 'KNOWLEDGE') NOT NULL,
    `tutorMessageId` VARCHAR(191) NULL,
    `knowledgeMessageId` VARCHAR(191) NULL,
    `originalContent` LONGTEXT NOT NULL,
    `originalPrompt` TEXT NULL,
    `sourceContextJson` JSON NULL,
    `citationsSnapshotJson` JSON NULL,
    `aiTitle` VARCHAR(191) NULL,
    `aiMarkdown` LONGTEXT NULL,
    `keyPointsJson` JSON NULL,
    `pitfallsJson` JSON NULL,
    `applicationsJson` JSON NULL,
    `userNote` LONGTEXT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `errorMessage` TEXT NULL,
    `generationVersion` INTEGER NOT NULL DEFAULT 1,
    `generatedAt` DATETIME(3) NULL,
    `trashedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AgentNote_tutorMessageId_key`(`tutorMessageId`),
    UNIQUE INDEX `AgentNote_knowledgeMessageId_key`(`knowledgeMessageId`),
    INDEX `AgentNote_userId_trashedAt_createdAt_idx`(`userId`, `trashedAt`, `createdAt`),
    INDEX `AgentNote_userId_status_idx`(`userId`, `status`),
    INDEX `AgentNote_userId_source_idx`(`userId`, `source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `AgentNoteTag` (
    `noteId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,
    `attachedBy` ENUM('AI', 'HUMAN') NOT NULL,
    `attachedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgentNoteTag_tagId_noteId_idx`(`tagId`, `noteId`),
    PRIMARY KEY (`noteId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `AgentNote` ADD CONSTRAINT `AgentNote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentNote` ADD CONSTRAINT `AgentNote_tutorMessageId_fkey` FOREIGN KEY (`tutorMessageId`) REFERENCES `AgentTutorMessage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentNote` ADD CONSTRAINT `AgentNote_knowledgeMessageId_fkey` FOREIGN KEY (`knowledgeMessageId`) REFERENCES `KnowledgeChatMessage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentNoteTag` ADD CONSTRAINT `AgentNoteTag_noteId_fkey` FOREIGN KEY (`noteId`) REFERENCES `AgentNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentNoteTag` ADD CONSTRAINT `AgentNoteTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `QuestionTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
