-- CreateTable
CREATE TABLE `QuestionMistakeReview` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `practiceAnswerId` VARCHAR(191) NULL,
    `tutorMessageId` VARCHAR(191) NULL,
    `tagId` VARCHAR(191) NULL,
    `mistakeCause` ENUM('READING_MISS', 'CONCEPT_GAP', 'METHOD_GAP', 'OPTION_TRAP', 'CALCULATION_ERROR', 'MATERIAL_LOCATION_ERROR', 'LOGIC_CHAIN_BREAK', 'TIME_STRATEGY_ERROR', 'CARELESSNESS', 'UNKNOWN') NOT NULL,
    `confidence` VARCHAR(191) NOT NULL,
    `causeSummary` TEXT NOT NULL,
    `fastestPath` TEXT NOT NULL,
    `transferRule` TEXT NOT NULL,
    `timeSpentSeconds` INTEGER NULL,
    `isLatestForQuestion` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuestionMistakeReview_userId_isLatestForQuestion_idx`(`userId`, `isLatestForQuestion`),
    INDEX `QuestionMistakeReview_userId_questionId_isLatestForQuestion_idx`(`userId`, `questionId`, `isLatestForQuestion`),
    INDEX `QuestionMistakeReview_userId_mistakeCause_isLatestForQuestion_idx`(`userId`, `mistakeCause`, `isLatestForQuestion`),
    INDEX `QuestionMistakeReview_userId_tagId_isLatestForQuestion_idx`(`userId`, `tagId`, `isLatestForQuestion`),
    INDEX `QuestionMistakeReview_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `QuestionMistakeReview_questionId_idx`(`questionId`),
    INDEX `QuestionMistakeReview_sessionId_idx`(`sessionId`),
    INDEX `QuestionMistakeReview_practiceAnswerId_idx`(`practiceAnswerId`),
    INDEX `QuestionMistakeReview_tutorMessageId_idx`(`tutorMessageId`),
    INDEX `QuestionMistakeReview_tagId_idx`(`tagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `QuestionMistakeReview` ADD CONSTRAINT `QuestionMistakeReview_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionMistakeReview` ADD CONSTRAINT `QuestionMistakeReview_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionMistakeReview` ADD CONSTRAINT `QuestionMistakeReview_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PracticeSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionMistakeReview` ADD CONSTRAINT `QuestionMistakeReview_practiceAnswerId_fkey` FOREIGN KEY (`practiceAnswerId`) REFERENCES `PracticeAnswer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionMistakeReview` ADD CONSTRAINT `QuestionMistakeReview_tutorMessageId_fkey` FOREIGN KEY (`tutorMessageId`) REFERENCES `AgentTutorMessage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionMistakeReview` ADD CONSTRAINT `QuestionMistakeReview_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `QuestionTag`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
