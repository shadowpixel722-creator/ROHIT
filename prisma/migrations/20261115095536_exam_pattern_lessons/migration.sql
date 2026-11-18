/*
  Warnings:

  - You are about to drop the `ExamPaper` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ExamPaper";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ExamPatternChapter" (
    "patternId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,

    PRIMARY KEY ("patternId", "chapterId"),
    CONSTRAINT "ExamPatternChapter_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "ExamPattern" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamPatternChapter_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExamPatternChapter_chapterId_idx" ON "ExamPatternChapter"("chapterId");
