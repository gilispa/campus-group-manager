-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdminSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "singletonKey" INTEGER NOT NULL DEFAULT 1,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AdminSettings" ("createdAt", "id", "passwordHash", "updatedAt") SELECT "createdAt", "id", "passwordHash", "updatedAt" FROM "AdminSettings";
DROP TABLE "AdminSettings";
ALTER TABLE "new_AdminSettings" RENAME TO "AdminSettings";
CREATE UNIQUE INDEX "AdminSettings_singletonKey_key" ON "AdminSettings"("singletonKey");
CREATE UNIQUE INDEX "StudentGroup_active_membership_unique" ON "StudentGroup"("studentId", "groupId") WHERE "active" = 1;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
