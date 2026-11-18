-- CreateTable
CREATE TABLE "HomeworkSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classroomId" TEXT NOT NULL,
    "chapterId" TEXT,
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "questions" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    CONSTRAINT "HomeworkSheet_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HomeworkSheet_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HomeworkSheet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HomeworkWork" (
    "sheetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" TEXT,
    "submittedAt" DATETIME,
    "marks" TEXT,
    "total" REAL,
    "outOf" INTEGER,
    "markStatus" TEXT,
    "markedAt" DATETIME,

    PRIMARY KEY ("sheetId", "userId"),
    CONSTRAINT "HomeworkWork_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "HomeworkSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HomeworkWork_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HomeworkSheet_classroomId_idx" ON "HomeworkSheet"("classroomId");
