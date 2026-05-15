import fs from "node:fs/promises";
import path from "node:path";
import { appPaths } from "../config/paths";

export async function ensureAppDirectories(): Promise<void> {
  await Promise.all([
    fs.mkdir(appPaths.dataDir, { recursive: true }),
    fs.mkdir(appPaths.databaseDir, { recursive: true }),
    fs.mkdir(appPaths.uploadsDir, { recursive: true }),
    fs.mkdir(appPaths.studentUploadsDir, { recursive: true }),
    fs.mkdir(appPaths.groupUploadsDir, { recursive: true })
  ]);
}

export async function copyFileEnsuringParent(source: string, destination: string): Promise<void> {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
