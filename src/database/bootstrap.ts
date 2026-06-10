import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { ensureAppDirectories } from "../utils/fs";
import { appPaths } from "../config/paths";
import { getPrismaClient } from "./prisma";

export async function bootstrapDatabase(): Promise<void> {
  await ensureAppDirectories();
  await ensureSqliteFile();
  process.env.DATABASE_URL = buildPrismaSqliteUrl(appPaths.sqliteFile);
  try {
    await runPrismaMigrateDeploy();
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

async function runPrismaMigrateDeploy(): Promise<void> {
  try {
    await runPrismaCommand("prisma migrate deploy");
  } catch (error) {
    const migrateMessage = error instanceof Error ? error.message : "error desconocido";
    try {
      await runPrismaCommand("prisma db push --skip-generate");
    } catch (pushError) {
      const pushMessage = pushError instanceof Error ? pushError.message : "error desconocido";
      throw new Error(`Fallo migrate deploy (${migrateMessage}) y tambien db push (${pushMessage}).`);
    }
  }
}

async function runPrismaCommand(commandText: string): Promise<void> {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", `npx ${commandText}`]
    : commandText.split(" ");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: appPaths.projectRoot,
      env: process.env,
      stdio: "pipe"
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`No se pudo ejecutar migraciones: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Fallo comando "${commandText}" (code ${String(code)}): ${stderr.trim() || "sin detalles"}`));
    });
  });
}

function buildPrismaSqliteUrl(filePath: string): string {
  const normalized = path
    .relative(appPaths.prismaDir, path.resolve(filePath))
    .replace(/\\/g, "/");
  return `file:${normalized}`;
}
