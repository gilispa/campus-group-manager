import type { Prisma, PrismaClient } from "@prisma/client";
import type { GroupCreateInput, GroupSearchFilters, GroupUpdateInput } from "../types/domain";
import type { Group } from "../types/domain";

export class GroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: GroupCreateInput): Promise<Group> {
    const createData: Prisma.GroupUncheckedCreateInput = {
      nombre: data.nombre,
      ...(data.categoryId ? { categoryId: data.categoryId } : {}),
      ...(data.descripcion !== undefined ? { descripcion: data.descripcion } : {}),
      ...(data.logo !== undefined ? { logo: data.logo } : {})
    };

    return this.prisma.group.create({ data: createData });
  }

  async update(id: string, data: GroupUpdateInput): Promise<Group> {
    const updateData: Prisma.GroupUncheckedUpdateInput = {
      ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
      ...(data.descripcion !== undefined ? { descripcion: data.descripcion } : {}),
      ...(data.logo !== undefined ? { logo: data.logo } : {}),
      ...(data.categoryId ? { categoryId: data.categoryId } : {})
    };

    return this.prisma.group.update({ where: { id }, data: updateData });
  }

  async delete(id: string): Promise<Group> {
    return this.prisma.group.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findById(id: string): Promise<Group | null> {
    return this.prisma.group.findFirst({ where: { id, deletedAt: null }, include: { category: true } });
  }

  async findByName(nombre: string, excludeId?: string): Promise<Group | null> {
    return this.prisma.group.findFirst({
      where: {
        nombre,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {})
      },
      include: { category: true }
    });
  }

  async list(): Promise<Group[]> {
    return this.prisma.group.findMany({ where: { deletedAt: null }, include: { category: true }, orderBy: { nombre: "asc" } });
  }

  async search(filters: GroupSearchFilters): Promise<Group[]> {
    const categoryIds = [
      ...(filters.categoryId ? [filters.categoryId] : []),
      ...(filters.categoryIds ?? [])
    ];
    const roleIds = filters.roleIds ?? [];
    const shouldFilterMemberships = roleIds.length > 0 || Boolean(filters.studentLevel);
    const studentWhere: Prisma.StudentWhereInput = {
      deletedAt: null,
      ...(filters.studentLevel ? { nivel: filters.studentLevel } : {})
    };
    const membershipWhere: Prisma.StudentGroupWhereInput = {
      ...(filters.participationStatus === "all" ? {} : { active: true }),
      ...(roleIds.length > 0 ? { roleId: { in: roleIds } } : {}),
      ...(shouldFilterMemberships ? { student: studentWhere } : {})
    };
    const where: Prisma.GroupWhereInput = {
      deletedAt: null,
      ...(filters.groupIds?.length ? { id: { in: filters.groupIds } } : {}),
      ...(filters.nombre ? { nombre: { contains: filters.nombre } } : {}),
      ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
      ...(shouldFilterMemberships
        ? {
            memberships: {
              some: membershipWhere
            }
          }
        : {}),
      ...(filters.categoryName
        ? { category: { name: { contains: filters.categoryName } } }
        : {})
    };

    return this.prisma.group.findMany({
      where,
      include: { category: true },
      orderBy: { nombre: "asc" }
    });
  }

  async hasMembershipHistory(id: string): Promise<boolean> {
    const count = await this.prisma.studentGroup.count({ where: { groupId: id } });
    return count > 0;
  }

  async listDeleted(): Promise<Group[]> {
    return this.prisma.group.findMany({
      where: { deletedAt: { not: null } },
      include: { category: true },
      orderBy: { deletedAt: "desc" }
    });
  }

  async restore(id: string): Promise<Group> {
    return this.prisma.group.update({ where: { id }, data: { deletedAt: null }, include: { category: true } });
  }

  async permanentDelete(id: string): Promise<Group> {
    const deleted = await this.prisma.group.findFirst({
      where: { id, deletedAt: { not: null } },
      include: { category: true }
    });

    if (!deleted) {
      throw new Error("NOT_FOUND_OR_NOT_DELETED");
    }

    await this.prisma.group.delete({ where: { id } });
    return deleted;
  }
}
