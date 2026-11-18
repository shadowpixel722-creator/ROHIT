-- CreateTable
CREATE TABLE "NoteExplanation" (
    "noteId" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoteExplanation_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
