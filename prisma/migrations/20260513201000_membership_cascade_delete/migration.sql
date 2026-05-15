PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_StudentGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "StudentGroup_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentGroup_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_StudentGroup" ("id", "studentId", "groupId", "roleId", "joinedAt", "leftAt", "active")
SELECT "id", "studentId", "groupId", "roleId", "joinedAt", "leftAt", "active"
FROM "StudentGroup";

DROP TABLE "StudentGroup";
ALTER TABLE "new_StudentGroup" RENAME TO "StudentGroup";

CREATE INDEX "StudentGroup_studentId_idx" ON "StudentGroup"("studentId");
CREATE INDEX "StudentGroup_groupId_idx" ON "StudentGroup"("groupId");
CREATE INDEX "StudentGroup_roleId_idx" ON "StudentGroup"("roleId");
CREATE INDEX "StudentGroup_active_idx" ON "StudentGroup"("active");
CREATE INDEX "StudentGroup_studentId_active_idx" ON "StudentGroup"("studentId", "active");
CREATE INDEX "StudentGroup_groupId_active_idx" ON "StudentGroup"("groupId", "active");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
