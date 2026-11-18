/*
  Warnings:

  - You are about to drop the column `answerIndex` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `choices` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `explanation` on the `Question` table. All the data in the column will be lost.
  - You are about to alter the column `score` on the `QuizAttempt` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - Added the required column `answer` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `keyPoints` to the `Question` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chapterId" TEXT NOT NULL,
    "noteId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "keyPoints" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'AI',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Question_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Question_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("chapterId", "createdAt", "id", "noteId", "question", "source", "status") SELECT "chapterId", "createdAt", "id", "noteId", "question", "source", "status" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE INDEX "Question_chapterId_status_idx" ON "Question"("chapterId", "status");
CREATE INDEX "Question_noteId_idx" ON "Question"("noteId");
CREATE TABLE "new_QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "noteIds" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "answers" TEXT,
    "grades" TEXT,
    "score" REAL,
    "total" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuizAttempt_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuizAttempt" ("answers", "chapterId", "createdAt", "id", "items", "noteIds", "score", "submittedAt", "total", "userId") SELECT "answers", "chapterId", "createdAt", "id", "items", "noteIds", "score", "submittedAt", "total", "userId" FROM "QuizAttempt";
DROP TABLE "QuizAttempt";
ALTER TABLE "new_QuizAttempt" RENAME TO "QuizAttempt";
CREATE INDEX "QuizAttempt_userId_chapterId_idx" ON "QuizAttempt"("userId", "chapterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
