import path from "node:path";
import fs from "node:fs/promises";
import { ensureAppDirectories } from "../utils/fs";
import { appPaths } from "../config/paths";
import { getPrismaClient } from "./prisma";

type MigrationRecord = {
  migration_name?: string;
  name?: string;
};

const currentSchemaTables = [
  "AdminSettings",
  "Career",
  "Giro",
  "Group",
  "GroupManagementCycle",
  "PendingMembership",
  "Portfolio",
  "PrepaProgram",
  "Role",
  "Student",
  "StudentGroup"
];

const knownAppTables = [
  ...currentSchemaTables,
  "Category",
  "new_AdminSettings",
  "new_Group",
  "new_Student",
  "new_StudentGroup",
  "_prisma_migrations"
];

const schemaMigrationNames = [
  "20260513021455_init",
  "20260513040638_hardening",
  "20260513193000_normalize_student_catalogs",
  "20260513201000_membership_cascade_delete",
  "20260513214500_nullable_catalog_relations",
  "20260514180000_soft_delete",
  "20260608090000_dashboard_management_graduation"
];

export async function bootstrapDatabase(): Promise<void> {
  await ensureAppDirectories();
  await ensureSqliteFile();
  process.env.DATABASE_URL = buildPrismaSqliteUrl(appPaths.sqliteFile);
  try {
    await applySqliteMigrations();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    throw new Error(`No fue posible preparar la base de datos al iniciar: ${message}`);
  }
  await getPrismaClient().$connect();
}

async function ensureSqliteFile(): Promise<void> {
  const handle = await fs.open(appPaths.sqliteFile, "a");
  await handle.close();
}

async function applySqliteMigrations(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_app_migrations" (
      "name" TEXT NOT NULL PRIMARY KEY,
      "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (await isCurrentSchemaReady()) {
    await markAllMigrationsApplied();
    return;
  }

  if (!(await databaseHasUserData())) {
    await resetEmptyDatabaseToCurrentSchema();
    return;
  }

  await syncPrismaMigrationHistory();

  const appliedMigrations = await getAppliedMigrationNames();
  const migrations = await listMigrationFiles();

  for (const migration of migrations) {
    if (appliedMigrations.has(migration.name)) {
      continue;
    }

    await applyMigrationFile(migration.name, migration.filePath);
    appliedMigrations.add(migration.name);
  }
}

async function isCurrentSchemaReady(): Promise<boolean> {
  for (const tableName of currentSchemaTables) {
    if (!(await tableExists(tableName))) {
      return false;
    }
  }

  return true;
}

async function databaseHasUserData(): Promise<boolean> {
  for (const tableName of knownAppTables) {
    if (!(await tableExists(tableName))) {
      continue;
    }

    const rows = await getPrismaClient().$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*) as count FROM "${tableName.replace(/"/g, '""')}"`
    );
    if (Number(rows[0]?.count ?? 0) > 0) {
      return true;
    }
  }

  return false;
}

async function resetEmptyDatabaseToCurrentSchema(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys=OFF");

  for (const tableName of knownAppTables) {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${tableName.replace(/"/g, '""')}"`);
  }

  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "_app_migrations"');
  await createCurrentSchema();
  await markAllMigrationsApplied();
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys=ON");
}

async function createCurrentSchema(): Promise<void> {
  const statements = splitSqlStatements(`
    CREATE TABLE "Career" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "deletedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "Giro" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "deletedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "Portfolio" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "deletedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "PrepaProgram" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "deletedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "Role" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "deletedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "Student" (
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

    CREATE TABLE "Group" (
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

    CREATE TABLE "GroupManagementCycle" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "groupId" TEXT NOT NULL,
      "label" TEXT,
      "effectiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "GroupManagementCycle_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE "StudentGroup" (
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

    CREATE TABLE "AdminSettings" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "singletonKey" INTEGER NOT NULL DEFAULT 1,
      "passwordHash" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );

    CREATE TABLE "_app_migrations" (
      "name" TEXT NOT NULL PRIMARY KEY,
      "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX "Career_name_key" ON "Career"("name");
    CREATE UNIQUE INDEX "Giro_name_key" ON "Giro"("name");
    CREATE UNIQUE INDEX "Portfolio_name_key" ON "Portfolio"("name");
    CREATE UNIQUE INDEX "PrepaProgram_name_key" ON "PrepaProgram"("name");
    CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
    CREATE UNIQUE INDEX "Student_matricula_key" ON "Student"("matricula");
    CREATE UNIQUE INDEX "AdminSettings_singletonKey_key" ON "AdminSettings"("singletonKey");

    CREATE INDEX "Student_nombre_idx" ON "Student"("nombre");
    CREATE INDEX "Student_nivel_idx" ON "Student"("nivel");
    CREATE INDEX "Student_generacion_idx" ON "Student"("generacion");
    CREATE INDEX "Student_careerId_idx" ON "Student"("careerId");
    CREATE INDEX "Student_prepaProgramId_idx" ON "Student"("prepaProgramId");
    CREATE INDEX "Student_deletedAt_idx" ON "Student"("deletedAt");
    CREATE INDEX "Group_nombre_idx" ON "Group"("nombre");
    CREATE INDEX "Group_giroId_idx" ON "Group"("giroId");
    CREATE INDEX "Group_portfolioId_idx" ON "Group"("portfolioId");
    CREATE INDEX "Group_deletedAt_idx" ON "Group"("deletedAt");
    CREATE INDEX "StudentGroup_studentId_idx" ON "StudentGroup"("studentId");
    CREATE INDEX "StudentGroup_groupId_idx" ON "StudentGroup"("groupId");
    CREATE INDEX "StudentGroup_roleId_idx" ON "StudentGroup"("roleId");
    CREATE INDEX "StudentGroup_managementCycleId_idx" ON "StudentGroup"("managementCycleId");
    CREATE INDEX "StudentGroup_active_idx" ON "StudentGroup"("active");
    CREATE INDEX "StudentGroup_studentId_active_idx" ON "StudentGroup"("studentId", "active");
    CREATE INDEX "StudentGroup_groupId_active_idx" ON "StudentGroup"("groupId", "active");
    CREATE INDEX "GroupManagementCycle_groupId_idx" ON "GroupManagementCycle"("groupId");
    CREATE INDEX "GroupManagementCycle_effectiveAt_idx" ON "GroupManagementCycle"("effectiveAt");
    CREATE INDEX "PendingMembership_matricula_idx" ON "PendingMembership"("matricula");
    CREATE INDEX "PendingMembership_groupId_idx" ON "PendingMembership"("groupId");
    CREATE INDEX "PendingMembership_status_idx" ON "PendingMembership"("status");
    CREATE INDEX "PendingMembership_resolvedStudentId_idx" ON "PendingMembership"("resolvedStudentId");
  `);

  for (const statement of statements) {
    await getPrismaClient().$executeRawUnsafe(statement);
  }
}

async function markAllMigrationsApplied(): Promise<void> {
  // Startup safety is based on the actual schema, not on Prisma CLI metadata.
  // Keeping this as a no-op avoids blocking packaged launches on migration history writes.
}

async function syncPrismaMigrationHistory(): Promise<void> {
  const prisma = getPrismaClient();
  const hasPrismaMigrations = await tableExists("_prisma_migrations");
  if (!hasPrismaMigrations) {
    return;
  }

  const records = await prisma.$queryRawUnsafe<MigrationRecord[]>(`
    SELECT "migration_name" FROM "_prisma_migrations"
    WHERE "finished_at" IS NOT NULL
  `);

  for (const record of records) {
    const migrationName = record.migration_name ?? record.name;
    if (!migrationName) {
      continue;
    }

    await markMigrationApplied(migrationName);
  }
}

async function getAppliedMigrationNames(): Promise<Set<string>> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>('SELECT "name" FROM "_app_migrations"');
  return new Set(rows.map((row) => row.name));
}

async function listMigrationFiles(): Promise<Array<{ name: string; filePath: string }>> {
  const migrationsDir = path.join(appPaths.prismaDir, "migrations");
  return schemaMigrationNames.map((name) => ({
    name,
    filePath: path.join(migrationsDir, name, "migration.sql")
  }));
}

async function applyMigrationFile(name: string, filePath: string): Promise<void> {
  const sql = await fs.readFile(filePath, "utf8");
  const statements = splitSqlStatements(sql);
  const prisma = getPrismaClient();

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  await markMigrationApplied(name);
}

async function markMigrationApplied(name: string): Promise<void> {
  void name;
}

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await getPrismaClient().$queryRawUnsafe<Array<{ name: string }>>(
    'SELECT "name" FROM "sqlite_master" WHERE "type" = ? AND "name" = ? LIMIT 1',
    "table",
    tableName
  );
  return rows.length > 0;
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let quote: "'" | '"' | "`" | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (!quote && char === "-" && next === "-") {
      while (index < sql.length && sql[index] !== "\n") {
        index += 1;
      }
      current += "\n";
      continue;
    }

    if ((char === "'" || char === '"' || char === "`") && (!quote || quote === char)) {
      current += char;

      if (quote === char && next === char) {
        current += next;
        index += 1;
        continue;
      }

      quote = quote === char ? null : char;
      continue;
    }

    if (!quote && char === ";") {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const finalStatement = current.trim();
  if (finalStatement) {
    statements.push(finalStatement);
  }

  return statements;
}

function buildPrismaSqliteUrl(filePath: string): string {
  const normalized = path.resolve(filePath).replace(/\\/g, "/");
  return `file:${normalized}`;
}
