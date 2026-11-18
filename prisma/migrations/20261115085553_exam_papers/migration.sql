-- CreateTable
CREATE TABLE "ExamPattern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classroomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "sections" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamPattern_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamPaper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classroomId" TEXT NOT NULL,
    "patternId" TEXT,
    "assessmentId" TEXT,
    "title" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "chapters" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "showAnswers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamPaper_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamPaper_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "ExamPattern" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExamPaper_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExamPattern_classroomId_idx" ON "ExamPattern"("classroomId");

-- CreateIndex
CREATE INDEX "ExamPaper_classroomId_status_idx" ON "ExamPaper"("classroomId", "status");
