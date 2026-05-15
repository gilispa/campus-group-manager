PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "Career" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Career_name_key" ON "Career"("name");

CREATE TABLE "PrepaProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "PrepaProgram_name_key" ON "PrepaProgram"("name");

INSERT INTO "Career" ("id", "name")
SELECT lower(hex(randomblob(16))), trim("carrera")
FROM "Student"
WHERE "carrera" IS NOT NULL AND trim("carrera") <> ''
GROUP BY trim("carrera");

INSERT INTO "PrepaProgram" ("id", "name", "description")
VALUES
  (lower(hex(randomblob(16))), 'Bicultural', 'Programa de preparatoria bicultural'),
  (lower(hex(randomblob(16))), 'Multicultural', 'Programa de preparatoria multicultural');

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

INSERT INTO "new_Student" ("id", "nombre", "matricula", "nivel", "careerId", "prepaProgramId", "generacion", "foto", "telefono", "email", "notas", "activo", "createdAt", "updatedAt")
SELECT
  s."id",
  s."nombre",
  s."matricula",
  s."nivel",
  CASE
    WHEN s."nivel" = 'PROFESIONAL' THEN (
      SELECT c."id"
      FROM "Career" c
      WHERE c."name" = trim(s."carrera")
      LIMIT 1
    )
    ELSE NULL
  END,
  CASE
    WHEN s."nivel" = 'PREPA' THEN (
      SELECT p."id"
      FROM "PrepaProgram" p
      WHERE p."name" = 'Bicultural'
      LIMIT 1
    )
    ELSE NULL
  END,
  s."generacion",
  s."foto",
  s."telefono",
  s."email",
  s."notas",
  s."activo",
  s."createdAt",
  s."updatedAt"
FROM "Student" s;

DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";

CREATE UNIQUE INDEX "Student_matricula_key" ON "Student"("matricula");
CREATE INDEX "Student_nombre_idx" ON "Student"("nombre");
CREATE INDEX "Student_nivel_idx" ON "Student"("nivel");
CREATE INDEX "Student_generacion_idx" ON "Student"("generacion");
CREATE INDEX "Student_careerId_idx" ON "Student"("careerId");
CREATE INDEX "Student_prepaProgramId_idx" ON "Student"("prepaProgramId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
