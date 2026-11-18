-- CreateTable
CREATE TABLE "Misconception" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fix" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Misconception_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "McqQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chapterId" TEXT NOT NULL,
    "noteId" TEXT,
    "stem" TEXT NOT NULL,
    "choices" TEXT NOT NULL,
    "answerIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'AI',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "McqQuestion_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "McqQuestion_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "McqDistractor" (
    "questionId" TEXT NOT NULL,
    "choiceIndex" INTEGER NOT NULL,
    "misconceptionId" TEXT NOT NULL,

    PRIMARY KEY ("questionId", "choiceIndex"),
    CONSTRAINT "McqDistractor_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "McqQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "McqDistractor_misconceptionId_fkey" FOREIGN KEY ("misconceptionId") REFERENCES "Misconception" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "McqSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "chapterId" TEXT,
    "misconceptionId" TEXT,
    "items" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "McqSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "McqSession_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "McqSession_misconceptionId_fkey" FOREIGN KEY ("misconceptionId") REFERENCES "Misconception" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "McqAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "chosenIndex" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "misconceptionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "McqAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "McqSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "McqAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "McqAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "McqQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "McqAnswer_misconceptionId_fkey" FOREIGN KEY ("misconceptionId") REFERENCES "Misconception" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Misconception_subjectId_idx" ON "Misconception"("subjectId");

-- CreateIndex
CREATE INDEX "McqQuestion_chapterId_status_idx" ON "McqQuestion"("chapterId", "status");

-- CreateIndex
CREATE INDEX "McqQuestion_noteId_idx" ON "McqQuestion"("noteId");

-- CreateIndex
CREATE INDEX "McqDistractor_misconceptionId_idx" ON "McqDistractor"("misconceptionId");

-- CreateIndex
CREATE INDEX "McqSession_userId_idx" ON "McqSession"("userId");

-- CreateIndex
CREATE INDEX "McqAnswer_userId_createdAt_idx" ON "McqAnswer"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "McqAnswer_questionId_idx" ON "McqAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "McqAnswer_sessionId_position_key" ON "McqAnswer"("sessionId", "position");
