-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Classroom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "grade" TEXT,
    "joinCode" TEXT NOT NULL,
    "joinOpen" BOOLEAN NOT NULL DEFAULT true,
    "studentQuestionCount" INTEGER NOT NULL DEFAULT 5,
    "aiTutor" BOOLEAN NOT NULL DEFAULT true,
    "leaderboard" BOOLEAN NOT NULL DEFAULT true,
    "kind" TEXT NOT NULL DEFAULT 'CLASS',
    "personalOf" TEXT,
    "teacherId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Classroom" ("aiTutor", "createdAt", "grade", "id", "joinCode", "joinOpen", "leaderboard", "name", "studentQuestionCount", "teacherId") SELECT "aiTutor", "createdAt", "grade", "id", "joinCode", "joinOpen", "leaderboard", "name", "studentQuestionCount", "teacherId" FROM "Classroom";
DROP TABLE "Classroom";
ALTER TABLE "new_Classroom" RENAME TO "Classroom";
CREATE UNIQUE INDEX "Classroom_joinCode_key" ON "Classroom"("joinCode");
CREATE UNIQUE INDEX "Classroom_personalOf_key" ON "Classroom"("personalOf");
CREATE INDEX "Classroom_teacherId_idx" ON "Classroom"("teacherId");
CREATE TABLE "new_Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classroomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "consentVerifiedAt" DATETIME,
    "canUpload" BOOLEAN NOT NULL DEFAULT false,
    "powers" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Membership_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Membership" ("canUpload", "classroomId", "consentVerifiedAt", "id", "joinedAt", "role", "status", "userId") SELECT "canUpload", "classroomId", "consentVerifiedAt", "id", "joinedAt", "role", "status", "userId" FROM "Membership";
DROP TABLE "Membership";
ALTER TABLE "new_Membership" RENAME TO "Membership";
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE UNIQUE INDEX "Membership_classroomId_userId_key" ON "Membership"("classroomId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
