-- CreateTable
CREATE TABLE "ChapterSeen" (
    "userId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "seenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "chapterId"),
    CONSTRAINT "ChapterSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChapterSeen_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NoteImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noteId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "filePath" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "convert" BOOLEAN NOT NULL DEFAULT true,
    "transcript" TEXT,
    "transcriptStatus" TEXT NOT NULL DEFAULT 'NONE',
    "transcriptSource" TEXT,
    "transcriptError" TEXT,
    "transcribedAt" DATETIME,
    CONSTRAINT "NoteImage_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NoteImage" ("filePath", "height", "id", "noteId", "position", "size", "transcribedAt", "transcript", "transcriptError", "transcriptSource", "transcriptStatus", "width") SELECT "filePath", "height", "id", "noteId", "position", "size", "transcribedAt", "transcript", "transcriptError", "transcriptSource", "transcriptStatus", "width" FROM "NoteImage";
DROP TABLE "NoteImage";
ALTER TABLE "new_NoteImage" RENAME TO "NoteImage";
CREATE INDEX "NoteImage_noteId_idx" ON "NoteImage"("noteId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
