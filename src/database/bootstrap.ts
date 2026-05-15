import { ensureAppDirectories } from "../utils/fs";
import { getPrismaClient } from "./prisma";

export async function bootstrapDatabase(): Promise<void> {
  await ensureAppDirectories();
  await getPrismaClient().$connect();
}
