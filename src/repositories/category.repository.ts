import type { PrismaClient } from "@prisma/client";
import type { CategoryCreateInput, CategoryUpdateInput } from "../types/domain";
import type { Category } from "../types/domain";

export class CategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CategoryCreateInput): Promise<Category> {
    const createData: { name: string; description?: string | null } = {
      name: data.name,
      ...(data.description !== undefined ? { description: data.description } : {})
    };

    return this.prisma.category.create({ data: createData });
  }

  async update(id: string, data: CategoryUpdateInput): Promise<Category> {
    const updateData: { name?: string; description?: string | null } = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {})
    };

    return this.prisma.category.update({ where: { id }, data: updateData });
  }

  async delete(id: string): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findById(id: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { id, deletedAt: null } });
  }

  async findByName(name: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { name } });
  }

  async list(): Promise<Category[]> {
    return this.prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  }

  async countGroups(id: string): Promise<number> {
    return this.prisma.group.count({ where: { categoryId: id, deletedAt: null } });
  }

  async listDeleted(): Promise<Category[]> {
    return this.prisma.category.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } });
  }

  async restore(id: string): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data: { deletedAt: null } });
  }
}
