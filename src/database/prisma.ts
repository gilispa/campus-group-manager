import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

function createPrismaClient(datasourceUrl?: string): PrismaClient {
  if (datasourceUrl) {
    return new PrismaClient({
      datasources: {
        db: {
          url: datasourceUrl
        }
      }
    });
  }

  return new PrismaClient();
}

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = createPrismaClient();
  }

  return prisma;
}

export function createIsolatedPrismaClient(datasourceUrl: string): PrismaClient {
  return createPrismaClient(datasourceUrl);
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

export async function reconnectPrisma(): Promise<PrismaClient> {
  await disconnectPrisma();
  return getPrismaClient();
}
