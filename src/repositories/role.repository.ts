import type { PrismaClient } from "@prisma/client";
import type { RoleCreateInput, RoleUpdateInput } from "../types/domain";
import type { Role } from "../types/domain";

export class RoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: RoleCreateInput): Promise<Role> {
    const createData: { name: string; description?: string | null } = {
      name: data.name,
      ...(data.description !== undefined ? { description: data.description } : {})
    };

    return this.prisma.role.create({ data: createData });
  }

  async update(id: string, data: RoleUpdateInput): Promise<Role> {
    const updateData: { name?: string; description?: string | null } = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {})
    };

    return this.prisma.role.update({ where: { id }, data: updateData });
  }

  async delete(id: string): Promise<Role> {
    return this.prisma.role.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findById(id: string): Promise<Role | null> {
    return this.prisma.role.findFirst({ where: { id, deletedAt: null } });
  }

  async findByName(name: string): Promise<Role | null> {
    return this.prisma.role.findUnique({ where: { name } });
  }

  async list(): Promise<Role[]> {
    return this.prisma.role.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  }

  async countMemberships(id: string): Promise<number> {
    return this.prisma.studentGroup.count({ where: { roleId: id } });
  }

  async listDeleted(): Promise<Role[]> {
    return this.prisma.role.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } });
  }

  async restore(id: string): Promise<Role> {
    return this.prisma.role.update({ where: { id }, data: { deletedAt: null } });
  }
}
