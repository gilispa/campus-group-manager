import type { Prisma, PrismaClient } from "@prisma/client";
import type { AdminSettings } from "../types/domain";

export class AdminRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getAdminSettings(): Promise<AdminSettings | null> {
    return this.prisma.adminSettings.findFirst();
  }

  async createPasswordHash(passwordHash: string): Promise<AdminSettings> {
    const createData: Prisma.AdminSettingsUncheckedCreateInput = {
      singletonKey: 1,
      passwordHash
    };

    return this.prisma.adminSettings.create({ data: createData });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<AdminSettings> {
    return this.prisma.adminSettings.update({ where: { id }, data: { passwordHash } });
  }
}
