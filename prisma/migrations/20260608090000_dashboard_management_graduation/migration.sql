PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

ALTER TABLE "Category" RENAME TO "Giro";
DROP INDEX IF EXISTS "Category_name_key";
CREATE UNIQUE INDEX "Giro_name_key" ON "Giro"("name");

INSERT OR IGNORE INTO "Giro" ("id", "name", "description", "createdAt")
VALUES ('sin-giro', 'Sin giro', 'Giro temporal para grupos heredados sin categoria.', CURRENT_TIMESTAMP);

CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Portfolio_name_key" ON "Portfolio"("name");

INSERT INTO "Portfolio" ("id", "name", "description", "createdAt")
VALUES ('sin-portafolio', 'Sin portafolio', 'Portafolio temporal para grupos existentes.', CURRENT_TIMESTAMP);

CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "careerId" TEXT,
    "prepaProgramId" TEXT,
    "generacion" INTEGER,
    "academicPending" BOOLEAN NOT NULL DEFAULT false,
    "foto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_prepaProgramId_fkey" FOREIGN KEY ("prepaProgramId") REFERENCES "PrepaProgram" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Student" ("id", "nombre", "matricula", "nivel", "careerId", "prepaProgramId", "generacion", "academicPending", "foto", "telefono", "email", "notas", "activo", "deletedAt", "createdAt", "updatedAt")
SELECT "id", "nombre", "matricula", "nivel", "careerId", "prepaProgramId", "generacion", false, "foto", "telefono", "email", "notas", "activo", "deletedAt", "createdAt", "updatedAt"
FROM "Student";

DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_matricula_key" ON "Student"("matricula");
CREATE INDEX "Student_nombre_idx" ON "Student"("nombre");
CREATE INDEX "Student_nivel_idx" ON "Student"("nivel");
CREATE INDEX "Student_generacion_idx" ON "Student"("generacion");
CREATE INDEX "Student_careerId_idx" ON "Student"("careerId");
CREATE INDEX "Student_prepaProgramId_idx" ON "Student"("prepaProgramId");
CREATE INDEX "Student_deletedAt_idx" ON "Student"("deletedAt");

CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "logo" TEXT,
    "giroId" TEXT,
    "portfolioId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Group_giroId_fkey" FOREIGN KEY ("giroId") REFERENCES "Giro" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Group" ("id", "nombre", "descripcion", "logo", "giroId", "portfolioId", "deletedAt", "createdAt", "updatedAt")
SELECT "id", "nombre", "descripcion", "logo", COALESCE("categoryId", 'sin-giro'), 'sin-portafolio', "deletedAt", "createdAt", "updatedAt"
FROM "Group";

DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
CREATE INDEX "Group_nombre_idx" ON "Group"("nombre");
CREATE INDEX "Group_giroId_idx" ON "Group"("giroId");
CREATE INDEX "Group_portfolioId_idx" ON "Group"("portfolioId");
CREATE INDEX "Group_deletedAt_idx" ON "Group"("deletedAt");

CREATE TABLE "GroupManagementCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "label" TEXT,
    "effectiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupManagementCycle_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GroupManagementCycle_groupId_idx" ON "GroupManagementCycle"("groupId");
CREATE INDEX "GroupManagementCycle_effectiveAt_idx" ON "GroupManagementCycle"("effectiveAt");

CREATE TABLE "new_StudentGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "roleId" TEXT,
    "managementCycleId" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "StudentGroup_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentGroup_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentGroup_managementCycleId_fkey" FOREIGN KEY ("managementCycleId") REFERENCES "GroupManagementCycle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_StudentGroup" ("id", "studentId", "groupId", "roleId", "managementCycleId", "joinedAt", "leftAt", "active")
SELECT "id", "studentId", "groupId", "roleId", NULL, "joinedAt", "leftAt", "active"
FROM "StudentGroup";

DROP TABLE "StudentGroup";
ALTER TABLE "new_StudentGroup" RENAME TO "StudentGroup";
CREATE INDEX "StudentGroup_studentId_idx" ON "StudentGroup"("studentId");
CREATE INDEX "StudentGroup_groupId_idx" ON "StudentGroup"("groupId");
CREATE INDEX "StudentGroup_roleId_idx" ON "StudentGroup"("roleId");
CREATE INDEX "StudentGroup_managementCycleId_idx" ON "StudentGroup"("managementCycleId");
CREATE INDEX "StudentGroup_active_idx" ON "StudentGroup"("active");
CREATE INDEX "StudentGroup_studentId_active_idx" ON "StudentGroup"("studentId", "active");
CREATE INDEX "StudentGroup_groupId_active_idx" ON "StudentGroup"("groupId", "active");

CREATE TABLE "PendingMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricula" TEXT NOT NULL,
    "nombre" TEXT,
    "groupId" TEXT NOT NULL,
    "roleId" TEXT,
    "roleName" TEXT,
    "joinedAt" DATETIME,
    "managementCycleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedAt" DATETIME,
    "resolvedStudentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PendingMembership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PendingMembership_managementCycleId_fkey" FOREIGN KEY ("managementCycleId") REFERENCES "GroupManagementCycle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PendingMembership_resolvedStudentId_fkey" FOREIGN KEY ("resolvedStudentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PendingMembership_matricula_idx" ON "PendingMembership"("matricula");
CREATE INDEX "PendingMembership_groupId_idx" ON "PendingMembership"("groupId");
CREATE INDEX "PendingMembership_status_idx" ON "PendingMembership"("status");
CREATE INDEX "PendingMembership_resolvedStudentId_idx" ON "PendingMembership"("resolvedStudentId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
