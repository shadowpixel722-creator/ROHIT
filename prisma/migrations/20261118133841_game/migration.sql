-- AlterTable
ALTER TABLE "McqAnswer" ADD COLUMN "energy" INTEGER;

-- CreateTable
CREATE TABLE "GameProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 60,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "best" INTEGER NOT NULL DEFAULT 0,
    "lastDay" TEXT,
    "freezes" INTEGER NOT NULL DEFAULT 0,
    "days" TEXT NOT NULL DEFAULT '{}',
    "owned" TEXT NOT NULL DEFAULT '[]',
    "equipped" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameAward" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "key"),
    CONSTRAINT "GameAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Raid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classroomId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "hp" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" DATETIME NOT NULL,
    CONSTRAINT "Raid_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Raid_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_McqSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "chapterId" TEXT,
    "misconceptionId" TEXT,
    "items" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'practice',
    "raidId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "McqSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "McqSession_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "McqSession_misconceptionId_fkey" FOREIGN KEY ("misconceptionId") REFERENCES "Misconception" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "McqSession_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_McqSession" ("chapterId", "createdAt", "id", "items", "misconceptionId", "userId") SELECT "chapterId", "createdAt", "id", "items", "misconceptionId", "userId" FROM "McqSession";
DROP TABLE "McqSession";
ALTER TABLE "new_McqSession" RENAME TO "McqSession";
CREATE INDEX "McqSession_userId_idx" ON "McqSession"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Raid_classroomId_idx" ON "Raid"("classroomId");
