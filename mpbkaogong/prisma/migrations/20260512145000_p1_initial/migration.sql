-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `emailVerified` DATETIME(3) NULL,
    `image` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `role` ENUM('USER', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Account` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(191) NULL,

    INDEX `Account_userId_idx`(`userId`),
    UNIQUE INDEX `Account_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_sessionToken_key`(`sessionToken`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `VerificationToken` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VerificationToken_token_key`(`token`),
    UNIQUE INDEX `VerificationToken_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Membership` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `startedAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NOT NULL,
    `source` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Membership_userId_idx`(`userId`),
    INDEX `Membership_status_idx`(`status`),
    INDEX `Membership_endedAt_idx`(`endedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `QuestionTag` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isMaterialOnly` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QuestionTag_slug_key`(`slug`),
    INDEX `QuestionTag_parentId_idx`(`parentId`),
    INDEX `QuestionTag_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Material` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `contentHtml` LONGTEXT NOT NULL,
    `plainText` TEXT NULL,
    `source` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Question` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('SINGLE', 'MULTIPLE', 'JUDGE') NOT NULL,
    `titleHtml` LONGTEXT NOT NULL,
    `plainText` TEXT NULL,
    `analysisHtml` LONGTEXT NULL,
    `correctAnswer` VARCHAR(191) NOT NULL,
    `difficulty` ENUM('EASY', 'MEDIUM', 'HARD', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `globalAccuracy` DECIMAL(5, 2) NULL,
    `source` VARCHAR(191) NULL,
    `tagId` VARCHAR(191) NULL,
    `materialId` VARCHAR(191) NULL,
    `isVipOnly` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Question_tagId_idx`(`tagId`),
    INDEX `Question_materialId_idx`(`materialId`),
    INDEX `Question_type_idx`(`type`),
    INDEX `Question_difficulty_idx`(`difficulty`),
    INDEX `Question_isActive_idx`(`isActive`),
    INDEX `Question_isVipOnly_idx`(`isVipOnly`),
    INDEX `Question_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `QuestionOption` (
    `id` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `contentHtml` LONGTEXT NOT NULL,
    `plainText` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `QuestionOption_questionId_idx`(`questionId`),
    UNIQUE INDEX `QuestionOption_questionId_value_key`(`questionId`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Paper` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `year` INTEGER NULL,
    `province` VARCHAR(191) NULL,
    `examType` VARCHAR(191) NULL,
    `difficultyScore` DECIMAL(3, 1) NULL,
    `isVipOnly` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Paper_slug_key`(`slug`),
    INDEX `Paper_year_idx`(`year`),
    INDEX `Paper_province_idx`(`province`),
    INDEX `Paper_examType_idx`(`examType`),
    INDEX `Paper_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `PaperQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `paperId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `sectionName` VARCHAR(191) NULL,
    `sectionStart` INTEGER NULL,
    `sectionEnd` INTEGER NULL,
    `score` DECIMAL(5, 2) NULL,

    INDEX `PaperQuestion_paperId_idx`(`paperId`),
    INDEX `PaperQuestion_questionId_idx`(`questionId`),
    UNIQUE INDEX `PaperQuestion_paperId_questionId_key`(`paperId`, `questionId`),
    UNIQUE INDEX `PaperQuestion_paperId_sortOrder_key`(`paperId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `DailyPractice` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DailyPractice_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `DailyPracticeQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `dailyPracticeId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,

    INDEX `DailyPracticeQuestion_questionId_idx`(`questionId`),
    UNIQUE INDEX `DailyPracticeQuestion_dailyPracticeId_questionId_key`(`dailyPracticeId`, `questionId`),
    UNIQUE INDEX `DailyPracticeQuestion_dailyPracticeId_sortOrder_key`(`dailyPracticeId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `PracticeSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `mode` ENUM('PAPER', 'SPECIAL', 'DAILY', 'WRONG', 'MEMORIZE', 'REVIEW') NOT NULL,
    `status` ENUM('IN_PROGRESS', 'SUBMITTED', 'ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',
    `title` VARCHAR(191) NOT NULL,
    `paperId` VARCHAR(191) NULL,
    `sourceTagIdsJson` JSON NULL,
    `difficulty` ENUM('EASY', 'MEDIUM', 'HARD', 'UNKNOWN') NULL,
    `totalCount` INTEGER NOT NULL DEFAULT 0,
    `answeredCount` INTEGER NOT NULL DEFAULT 0,
    `correctCount` INTEGER NOT NULL DEFAULT 0,
    `wrongCount` INTEGER NOT NULL DEFAULT 0,
    `unansweredCount` INTEGER NOT NULL DEFAULT 0,
    `elapsedSeconds` INTEGER NOT NULL DEFAULT 0,
    `accuracy` DECIMAL(5, 2) NULL,
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PracticeSession_userId_idx`(`userId`),
    INDEX `PracticeSession_mode_idx`(`mode`),
    INDEX `PracticeSession_status_idx`(`status`),
    INDEX `PracticeSession_paperId_idx`(`paperId`),
    INDEX `PracticeSession_createdAt_idx`(`createdAt`),
    INDEX `PracticeSession_submittedAt_idx`(`submittedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `PracticeAnswer` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `answer` VARCHAR(191) NULL,
    `isCorrect` BOOLEAN NULL,
    `timeSpentSeconds` INTEGER NOT NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL,
    `answeredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PracticeAnswer_sessionId_idx`(`sessionId`),
    INDEX `PracticeAnswer_userId_idx`(`userId`),
    INDEX `PracticeAnswer_questionId_idx`(`questionId`),
    INDEX `PracticeAnswer_isCorrect_idx`(`isCorrect`),
    INDEX `PracticeAnswer_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `PracticeAnswer_sessionId_questionId_key`(`sessionId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `WrongQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NULL,
    `wrongCount` INTEGER NOT NULL DEFAULT 1,
    `lastWrongAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastPracticeAnswerId` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WrongQuestion_userId_idx`(`userId`),
    INDEX `WrongQuestion_tagId_idx`(`tagId`),
    INDEX `WrongQuestion_resolvedAt_idx`(`resolvedAt`),
    INDEX `WrongQuestion_lastWrongAt_idx`(`lastWrongAt`),
    UNIQUE INDEX `WrongQuestion_userId_questionId_key`(`userId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `UserStatsSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `totalSessions` INTEGER NOT NULL DEFAULT 0,
    `totalQuestions` INTEGER NOT NULL DEFAULT 0,
    `totalCorrect` INTEGER NOT NULL DEFAULT 0,
    `totalWrong` INTEGER NOT NULL DEFAULT 0,
    `totalElapsedSeconds` INTEGER NOT NULL DEFAULT 0,
    `accuracy` DECIMAL(5, 2) NULL,
    `snapshotAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserStatsSnapshot_userId_idx`(`userId`),
    INDEX `UserStatsSnapshot_snapshotAt_idx`(`snapshotAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `UserTagStats` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,
    `answeredCount` INTEGER NOT NULL DEFAULT 0,
    `correctCount` INTEGER NOT NULL DEFAULT 0,
    `wrongCount` INTEGER NOT NULL DEFAULT 0,
    `accuracy` DECIMAL(5, 2) NULL,
    `lastPracticedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserTagStats_userId_idx`(`userId`),
    INDEX `UserTagStats_tagId_idx`(`tagId`),
    INDEX `UserTagStats_accuracy_idx`(`accuracy`),
    INDEX `UserTagStats_lastPracticedAt_idx`(`lastPracticedAt`),
    UNIQUE INDEX `UserTagStats_userId_tagId_key`(`userId`, `tagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ImportJob` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `totalRows` INTEGER NOT NULL DEFAULT 0,
    `successRows` INTEGER NOT NULL DEFAULT 0,
    `failedRows` INTEGER NOT NULL DEFAULT 0,
    `errorJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ImportJob_userId_idx`(`userId`),
    INDEX `ImportJob_status_idx`(`status`),
    INDEX `ImportJob_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionTag` ADD CONSTRAINT `QuestionTag_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `QuestionTag`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `QuestionTag`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `Material`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionOption` ADD CONSTRAINT `QuestionOption_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaperQuestion` ADD CONSTRAINT `PaperQuestion_paperId_fkey` FOREIGN KEY (`paperId`) REFERENCES `Paper`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaperQuestion` ADD CONSTRAINT `PaperQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyPracticeQuestion` ADD CONSTRAINT `DailyPracticeQuestion_dailyPracticeId_fkey` FOREIGN KEY (`dailyPracticeId`) REFERENCES `DailyPractice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyPracticeQuestion` ADD CONSTRAINT `DailyPracticeQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeSession` ADD CONSTRAINT `PracticeSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeSession` ADD CONSTRAINT `PracticeSession_paperId_fkey` FOREIGN KEY (`paperId`) REFERENCES `Paper`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeAnswer` ADD CONSTRAINT `PracticeAnswer_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PracticeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeAnswer` ADD CONSTRAINT `PracticeAnswer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeAnswer` ADD CONSTRAINT `PracticeAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `QuestionTag`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_lastPracticeAnswerId_fkey` FOREIGN KEY (`lastPracticeAnswerId`) REFERENCES `PracticeAnswer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserStatsSnapshot` ADD CONSTRAINT `UserStatsSnapshot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserTagStats` ADD CONSTRAINT `UserTagStats_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserTagStats` ADD CONSTRAINT `UserTagStats_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `QuestionTag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
