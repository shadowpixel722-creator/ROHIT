-- AlterTable
ALTER TABLE "McqQuestion" ADD COLUMN "createdById" TEXT;

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
    "teacherId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Classroom" ("createdAt", "grade", "id", "joinCode", "joinOpen", "name", "teacherId") SELECT "createdAt", "grade", "id", "joinCode", "joinOpen", "name", "teacherId" FROM "Classroom";
DROP TABLE "Classroom";
ALTER TABLE "new_Classroom" RENAME TO "Classroom";
CREATE UNIQUE INDEX "Classroom_joinCode_key" ON "Classroom"("joinCode");
CREATE INDEX "Classroom_teacherId_idx" ON "Classroom"("teacherId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
