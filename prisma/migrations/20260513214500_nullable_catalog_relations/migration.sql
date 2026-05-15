PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "careerId" TEXT,
    "prepaProgramId" TEXT,
    "generacion" INTEGER NOT NULL,
    "foto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_prepaProgramId_fkey" FOREIGN KEY ("prepaProgramId") REFERENCES "PrepaProgram" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("activo", "careerId", "createdAt", "email", "foto", "generacion", "id", "matricula", "nivel", "notas", "prepaProgramId", "telefono", "updatedAt", "nombre")
SELECT "activo", "careerId", "createdAt", "email", "foto", "generacion", "id", "matricula", "nivel", "notas", "prepaProgramId", "telefono", "updatedAt", "nombre" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_matricula_key" ON "Student"("matricula");
CREATE INDEX "Student_nombre_idx" ON "Student"("nombre");
CREATE INDEX "Student_nivel_idx" ON "Student"("nivel");
CREATE INDEX "Student_generacion_idx" ON "Student"("generacion");
CREATE INDEX "Student_careerId_idx" ON "Student"("careerId");
CREATE INDEX "Student_prepaProgramId_idx" ON "Student"("prepaProgramId");

CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "logo" TEXT,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Group_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Group" ("categoryId", "createdAt", "descripcion", "id", "logo", "nombre", "updatedAt")
SELECT "categoryId", "createdAt", "descripcion", "id", "logo", "nombre", "updatedAt" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
CREATE INDEX "Group_nombre_idx" ON "Group"("nombre");
CREATE INDEX "Group_categoryId_idx" ON "Group"("categoryId");

CREATE TABLE "new_StudentGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "roleId" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "StudentGroup_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentGroup_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StudentGroup" ("active", "groupId", "id", "joinedAt", "leftAt", "roleId", "studentId")
SELECT "active", "groupId", "id", "joinedAt", "leftAt", "roleId", "studentId" FROM "StudentGroup";
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
