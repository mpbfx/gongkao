-- AlterTable
ALTER TABLE `Paper`
    ADD COLUMN `durationSeconds` INTEGER NULL;

-- AlterTable
ALTER TABLE `QuestionTag`
    ADD COLUMN `depth` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `path` VARCHAR(191) NULL,
    ADD COLUMN `isLeaf` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `taxonomySource` VARCHAR(191) NULL,
    ADD COLUMN `taxonomyVersion` VARCHAR(191) NULL;

-- Existing taxonomy rows are normalized from their stored parent relationships.
UPDATE `QuestionTag` SET `depth` = 0, `path` = `name` WHERE `parentId` IS NULL;
UPDATE `QuestionTag` child
JOIN `QuestionTag` parent ON parent.id = child.parentId
SET child.depth = parent.depth + 1,
    child.path = CONCAT(parent.path, '/', child.name);
UPDATE `QuestionTag` child
JOIN `QuestionTag` parent ON parent.id = child.parentId
SET child.depth = parent.depth + 1,
    child.path = CONCAT(parent.path, '/', child.name);
UPDATE `QuestionTag` child
JOIN `QuestionTag` parent ON parent.id = child.parentId
SET child.depth = parent.depth + 1,
    child.path = CONCAT(parent.path, '/', child.name);

UPDATE `QuestionTag` tag
LEFT JOIN (SELECT DISTINCT `parentId` FROM `QuestionTag` WHERE `parentId` IS NOT NULL) children
    ON children.parentId = tag.id
SET tag.isLeaf = children.parentId IS NULL;

-- AlterTable
ALTER TABLE `PracticeSession`
    ADD COLUMN `purpose` ENUM('PRACTICE', 'BASELINE', 'FOUNDATION', 'MOCK', 'TIME_PRESSURE', 'WRONG_REVIEW') NOT NULL DEFAULT 'PRACTICE',
    ADD COLUMN `timingMode` ENUM('UNTYPED', 'STRICT', 'FLEXIBLE') NOT NULL DEFAULT 'UNTYPED',
    ADD COLUMN `timeLimitSeconds` INTEGER NULL,
    ADD COLUMN `pauseCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `pausedSeconds` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `score` DECIMAL(8, 2) NULL,
    ADD COLUMN `maxScore` DECIMAL(8, 2) NULL,
    ADD COLUMN `reflectionText` TEXT NULL,
    ADD INDEX `PracticeSession_purpose_idx`(`purpose`);

-- AlterTable
ALTER TABLE `PracticeAnswer`
    ADD COLUMN `decisionNote` TEXT NULL;

-- AlterTable
ALTER TABLE `UserTagStats`
    ADD COLUMN `foundationStatus` ENUM('NOT_STARTED', 'TRAINING', 'PASSED') NOT NULL DEFAULT 'NOT_STARTED',
    ADD COLUMN `foundationRoundCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastRoundCorrect` INTEGER NULL,
    ADD COLUMN `bestRoundCorrect` INTEGER NULL,
    ADD COLUMN `passedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `PracticeEvent` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `payloadJson` JSON NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PracticeEvent_sessionId_occurredAt_idx`(`sessionId`, `occurredAt`),
    INDEX `PracticeEvent_userId_occurredAt_idx`(`userId`, `occurredAt`),
    INDEX `PracticeEvent_questionId_idx`(`questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `UserExamGoal` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `targetPaperId` VARCHAR(191) NOT NULL,
    `baselineSessionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserExamGoal_userId_key`(`userId`),
    UNIQUE INDEX `UserExamGoal_baselineSessionId_key`(`baselineSessionId`),
    INDEX `UserExamGoal_targetPaperId_idx`(`targetPaperId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `PracticeEvent` ADD CONSTRAINT `PracticeEvent_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PracticeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PracticeEvent` ADD CONSTRAINT `PracticeEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `UserExamGoal` ADD CONSTRAINT `UserExamGoal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `UserExamGoal` ADD CONSTRAINT `UserExamGoal_targetPaperId_fkey` FOREIGN KEY (`targetPaperId`) REFERENCES `Paper`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `UserExamGoal` ADD CONSTRAINT `UserExamGoal_baselineSessionId_fkey` FOREIGN KEY (`baselineSessionId`) REFERENCES `PracticeSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
