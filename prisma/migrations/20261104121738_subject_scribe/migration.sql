-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classroomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'teal',
    "position" INTEGER NOT NULL DEFAULT 0,
    "scribeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subject_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subject_scribeId_fkey" FOREIGN KEY ("scribeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Subject" ("classroomId", "color", "createdAt", "id", "name", "position") SELECT "classroomId", "color", "createdAt", "id", "name", "position" FROM "Subject";
DROP TABLE "Subject";
ALTER TABLE "new_Subject" RENAME TO "Subject";
CREATE INDEX "Subject_classroomId_idx" ON "Subject"("classroomId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
