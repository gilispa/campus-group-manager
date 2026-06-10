import type { PrismaClient } from "@prisma/client";
import type { Portfolio, PortfolioCreateInput, PortfolioUpdateInput } from "../types/domain";

export class PortfolioRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: PortfolioCreateInput): Promise<Portfolio> {
    const createData: { name: string; description?: string | null } = {
      name: data.name,
      ...(data.description !== undefined ? { description: data.description } : {})
    };

    return this.prisma.portfolio.create({ data: createData });
  }

  async update(id: string, data: PortfolioUpdateInput): Promise<Portfolio> {
    const updateData: { name?: string; description?: string | null } = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {})
    };

    return this.prisma.portfolio.update({ where: { id }, data: updateData });
  }

  async delete(id: string): Promise<Portfolio> {
    return this.prisma.portfolio.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findById(id: string): Promise<Portfolio | null> {
    return this.prisma.portfolio.findFirst({ where: { id, deletedAt: null } });
  }

  async findByName(name: string): Promise<Portfolio | null> {
    return this.prisma.portfolio.findUnique({ where: { name } });
  }

  async list(): Promise<Portfolio[]> {
    return this.prisma.portfolio.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  }

  async countGroups(id: string): Promise<number> {
    return this.prisma.group.count({ where: { portfolioId: id, deletedAt: null } });
  }

  async listDeleted(): Promise<Portfolio[]> {
    return this.prisma.portfolio.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } });
  }

  async restore(id: string): Promise<Portfolio> {
    return this.prisma.portfolio.update({ where: { id }, data: { deletedAt: null } });
  }

  async permanentDelete(id: string): Promise<Portfolio> {
    const deleted = await this.prisma.portfolio.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!deleted) {
      throw new Error("NOT_FOUND_OR_NOT_DELETED");
    }

    await this.prisma.portfolio.delete({ where: { id } });
    return deleted;
  }
}
