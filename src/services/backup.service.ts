import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { appPaths, uploadPrefixes } from "../config/paths";
import { createIsolatedPrismaClient, disconnectPrisma, getPrismaClient, reconnectPrisma } from "../database/prisma";
import { copyFileEnsuringParent, ensureAppDirectories, fileExists } from "../utils/fs";
import { NotFoundError, ValidationError } from "../utils/errors";

export class BackupService {
  async exportDatabase(destinationFilePath: string): Promise<string> {
    await ensureAppDirectories();

    if (!(await fileExists(appPaths.sqliteFile))) {
      throw new NotFoundError("La base de datos SQLite aun no existe.");
    }

    const extension = path.extname(destinationFilePath).toLowerCase();
    if (extension === ".db") {
      await copyFileEnsuringParent(appPaths.sqliteFile, destinationFilePath);
      return destinationFilePath;
    }

    if (extension !== ".zip") {
      throw new ValidationError("Solo se pueden exportar respaldos .zip o .db");
    }

    const zip = new AdmZip();
    zip.addLocalFile(appPaths.sqliteFile, "database", "app.db");
    zip.addLocalFolder(appPaths.studentUploadsDir, "uploads/students");
    zip.addLocalFolder(appPaths.groupUploadsDir, "uploads/groups");
    await fs.mkdir(path.dirname(destinationFilePath), { recursive: true });
    zip.writeZip(destinationFilePath);
    return destinationFilePath;
  }

  async importDatabase(sourceFilePath: string): Promise<string> {
    if (!(await fileExists(sourceFilePath))) {
      throw new NotFoundError("El archivo de origen para importar no existe.");
    }

    const extension = path.extname(sourceFilePath).toLowerCase();
    if (extension === ".zip") {
      return this.importZipBackup(sourceFilePath);
    }

    if (extension === ".db") {
      return this.importLegacyDatabase(sourceFilePath);
    }

    throw new ValidationError("Solo se pueden importar respaldos .zip o .db");
  }

  private async importLegacyDatabase(sourceFilePath: string): Promise<string> {
    await ensureAppDirectories();

    const tempTarget = `${appPaths.sqliteFile}.importing`;
    const rollbackTarget = `${appPaths.sqliteFile}.rollback`;
    await copyFileEnsuringParent(sourceFilePath, tempTarget);
    await this.validateSQLiteFile(tempTarget);
    await this.validateImportedDatabase(tempTarget);
    await this.normalizeImportedAssetReferences(tempTarget, appPaths.uploadsDir);

    await disconnectPrisma();

    try {
      if (await fileExists(appPaths.sqliteFile)) {
        await fs.copyFile(appPaths.sqliteFile, rollbackTarget);
      }

      await fs.copyFile(tempTarget, appPaths.sqliteFile);
      await reconnectPrisma();
      await this.validateCurrentDatabase();
    } catch (error) {
      if (await fileExists(rollbackTarget)) {
        await fs.copyFile(rollbackTarget, appPaths.sqliteFile);
      }

      await reconnectPrisma();
      throw error;
    } finally {
      await fs.rm(tempTarget, { force: true });
      await fs.rm(rollbackTarget, { force: true });
    }

    return appPaths.sqliteFile;
  }

  private async importZipBackup(sourceFilePath: string): Promise<string> {
    await ensureAppDirectories();

    const stageRoot = path.join(appPaths.dataDir, `.backup-stage-${Date.now()}`);
    const stageDatabaseDir = path.join(stageRoot, "database");
    const stageUploadsDir = path.join(stageRoot, "uploads");
    const stageDbFile = path.join(stageDatabaseDir, "app.db");

    const rollbackDbFile = `${appPaths.sqliteFile}.rollback`;
    const rollbackUploadsDir = path.join(appPaths.dataDir, `.uploads-rollback-${Date.now()}`);

    await fs.mkdir(stageDatabaseDir, { recursive: true });
    await fs.mkdir(path.join(stageUploadsDir, "students"), { recursive: true });
    await fs.mkdir(path.join(stageUploadsDir, "groups"), { recursive: true });

    try {
      await this.extractZipBackup(sourceFilePath, stageRoot);

      if (!(await fileExists(stageDbFile))) {
        throw new ValidationError("El respaldo .zip no incluye database/app.db");
      }

      await this.validateSQLiteFile(stageDbFile);
      await this.validateImportedDatabase(stageDbFile);
      await this.normalizeImportedAssetReferences(stageDbFile, stageUploadsDir);

      await disconnectPrisma();

      if (await fileExists(appPaths.sqliteFile)) {
        await fs.copyFile(appPaths.sqliteFile, rollbackDbFile);
      }
      if (await fileExists(appPaths.uploadsDir)) {
        await fs.cp(appPaths.uploadsDir, rollbackUploadsDir, { recursive: true });
      }

      await copyFileEnsuringParent(stageDbFile, appPaths.sqliteFile);
      await fs.rm(appPaths.uploadsDir, { recursive: true, force: true });
      await fs.cp(stageUploadsDir, appPaths.uploadsDir, { recursive: true });
      await ensureAppDirectories();
      await reconnectPrisma();
      await this.validateCurrentDatabase();
    } catch (error) {
      if (await fileExists(rollbackDbFile)) {
        await copyFileEnsuringParent(rollbackDbFile, appPaths.sqliteFile);
      }
      if (await fileExists(rollbackUploadsDir)) {
        await fs.rm(appPaths.uploadsDir, { recursive: true, force: true });
        await fs.cp(rollbackUploadsDir, appPaths.uploadsDir, { recursive: true });
      }
      await reconnectPrisma();
      throw error;
    } finally {
      await fs.rm(stageRoot, { recursive: true, force: true });
      await fs.rm(rollbackDbFile, { force: true });
      await fs.rm(rollbackUploadsDir, { recursive: true, force: true });
    }

    return appPaths.sqliteFile;
  }

  private async extractZipBackup(sourceFilePath: string, stageRoot: string): Promise<void> {
    const zip = new AdmZip(sourceFilePath);
    const entries = zip.getEntries();
    for (const entry of entries) {
      const entryName = entry.entryName.replace(/\\/g, "/");
      if (!entryName) {
        continue;
      }

      if (entryName.startsWith("/") || entryName.includes("..")) {
        throw new ValidationError("El respaldo .zip contiene rutas invalidas.");
      }

      const validPath = entryName === "database/app.db"
        || entryName.startsWith("uploads/students/")
        || entryName.startsWith("uploads/groups/");
      if (!validPath) {
        throw new ValidationError("El respaldo .zip contiene archivos no permitidos.");
      }

      if (entry.isDirectory) {
        continue;
      }

      const targetPath = path.join(stageRoot, entryName);
      const targetDir = path.dirname(targetPath);
      const content = entry.getData();
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(targetPath, content);
    }
  }

  private async validateSQLiteFile(filePath: string): Promise<void> {
    const handle = await fs.open(filePath, "r");

    try {
      const buffer = Buffer.alloc(16);
      await handle.read(buffer, 0, 16, 0);
      if (buffer.toString("utf8") !== "SQLite format 3\u0000") {
        throw new ValidationError("El archivo importado no es una base SQLite valida.");
      }
    } finally {
      await handle.close();
    }
  }

  private async validateImportedDatabase(filePath: string): Promise<void> {
    const datasourceUrl = this.buildPrismaSqliteUrl(filePath);
    const prisma = createIsolatedPrismaClient(datasourceUrl);

    try {
      await prisma.$connect();
      await Promise.all([
        prisma.student.count(),
        prisma.group.count(),
        prisma.category.count(),
        prisma.role.count(),
        prisma.studentGroup.count(),
        prisma.adminSettings.count()
      ]);
    } catch {
      throw new ValidationError("La base importada no coincide con el schema esperado por la aplicacion.");
    } finally {
      await prisma.$disconnect();
    }
  }

  private async validateCurrentDatabase(): Promise<void> {
    const prisma = getPrismaClient();
    await Promise.all([
      prisma.student.count(),
      prisma.group.count(),
      prisma.category.count(),
      prisma.role.count(),
      prisma.studentGroup.count(),
      prisma.adminSettings.count()
    ]);
  }

  private async normalizeImportedAssetReferences(filePath: string, uploadsRoot: string): Promise<void> {
    const datasourceUrl = this.buildPrismaSqliteUrl(filePath);
    const prisma = createIsolatedPrismaClient(datasourceUrl);

    try {
      await prisma.$connect();

      const [studentsWithPhotos, groupsWithLogos] = await Promise.all([
        prisma.student.findMany({
          where: { foto: { not: null } },
          select: { id: true, foto: true }
        }),
        prisma.group.findMany({
          where: { logo: { not: null } },
          select: { id: true, logo: true }
        })
      ]);

      await Promise.all([
        ...studentsWithPhotos.map(async (student) => {
          if (!(await this.importedAssetExists(student.foto, uploadPrefixes.students, path.join(uploadsRoot, "students")))) {
            await prisma.student.update({ where: { id: student.id }, data: { foto: null } });
          }
        }),
        ...groupsWithLogos.map(async (group) => {
          if (!(await this.importedAssetExists(group.logo, uploadPrefixes.groups, path.join(uploadsRoot, "groups")))) {
            await prisma.group.update({ where: { id: group.id }, data: { logo: null } });
          }
        })
      ]);
    } finally {
      await prisma.$disconnect();
    }
  }

  private async importedAssetExists(assetPath: string | null, prefix: string, uploadsDir: string): Promise<boolean> {
    if (!assetPath?.startsWith(prefix)) {
      return false;
    }

    return fileExists(path.join(uploadsDir, path.basename(assetPath)));
  }

  private buildPrismaSqliteUrl(filePath: string): string {
    const relativePath = path.relative(appPaths.prismaDir, filePath).replace(/\\/g, "/");
    return `file:${relativePath}`;
  }
}
