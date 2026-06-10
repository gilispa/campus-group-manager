import type { Prisma, PrismaClient } from "@prisma/client";
import type { GroupCreateInput, GroupSearchFilters, GroupUpdateInput } from "../types/domain";
import type { Group } from "../types/domain";

export class GroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: GroupCreateInput): Promise<Group> {
    const createData: Prisma.GroupUncheckedCreateInput = {
      nombre: data.nombre,
      ...(data.giroId ? { giroId: data.giroId } : {}),
      ...(data.portfolioId ? { portfolioId: data.portfolioId } : {}),
      ...(data.descripcion !== undefined ? { descripcion: data.descripcion } : {}),
      ...(data.logo !== undefined ? { logo: data.logo } : {})
    };

    return this.prisma.group.create({ data: createData, include: { giro: true, portfolio: true } });
  }

  async update(id: string, data: GroupUpdateInput): Promise<Group> {
    const updateData: Prisma.GroupUncheckedUpdateInput = {
      ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
      ...(data.descripcion !== undefined ? { descripcion: data.descripcion } : {}),
      ...(data.logo !== undefined ? { logo: data.logo } : {}),
      ...(data.giroId ? { giroId: data.giroId } : {}),
      ...(data.portfolioId ? { portfolioId: data.portfolioId } : {})
    };

    return this.prisma.group.update({ where: { id }, data: updateData, include: { giro: true, portfolio: true } });
  }

  async delete(id: string): Promise<Group> {
    const deletedAt = new Date();
    return this.prisma.$transaction(async (transaction) => {
      await transaction.studentGroup.updateMany({
        where: { groupId: id, active: true },
        data: { active: false, leftAt: deletedAt }
      });

      return transaction.group.update({ where: { id }, data: { deletedAt } });
    });
  }

  async findById(id: string): Promise<Group | null> {
    return this.prisma.group.findFirst({ where: { id, deletedAt: null }, include: { giro: true, portfolio: true } });
  }

  async findByName(nombre: string, excludeId?: string): Promise<Group | null> {
    return this.prisma.group.findFirst({
      where: {
        nombre,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {})
      },
      include: { giro: true, portfolio: true }
    });
  }

  async list(): Promise<Group[]> {
    return this.prisma.group.findMany({ where: { deletedAt: null }, include: { giro: true, portfolio: true }, orderBy: { nombre: "asc" } });
  }

  async search(filters: GroupSearchFilters): Promise<Group[]> {
    const giroIds = [
      ...(filters.giroId ? [filters.giroId] : []),
      ...(filters.giroIds ?? [])
    ];
    const portfolioIds = [
      ...(filters.portfolioId ? [filters.portfolioId] : []),
      ...(filters.portfolioIds ?? [])
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
      ...(giroIds.length > 0 ? { giroId: { in: giroIds } } : {}),
      ...(portfolioIds.length > 0 ? { portfolioId: { in: portfolioIds } } : {}),
      ...(shouldFilterMemberships
        ? {
            memberships: {
              some: membershipWhere
            }
          }
        : {}),
      ...(filters.giroName ? { giro: { name: { contains: filters.giroName } } } : {}),
      ...(filters.portfolioName ? { portfolio: { name: { contains: filters.portfolioName } } } : {})
    };

    return this.prisma.group.findMany({
      where,
      include: { giro: true, portfolio: true },
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
      include: { giro: true, portfolio: true },
      orderBy: { deletedAt: "desc" }
    });
  }

  async findDeletedById(id: string): Promise<Group | null> {
    return this.prisma.group.findFirst({
      where: { id, deletedAt: { not: null } },
      include: { giro: true, portfolio: true }
    });
  }

  async restore(id: string): Promise<Group> {
    return this.prisma.group.update({ where: { id }, data: { deletedAt: null }, include: { giro: true, portfolio: true } });
  }

  async permanentDelete(id: string): Promise<Group> {
    const deleted = await this.prisma.group.findFirst({
      where: { id, deletedAt: { not: null } },
      include: { giro: true, portfolio: true }
    });

    if (!deleted) {
      throw new Error("NOT_FOUND_OR_NOT_DELETED");
    }

    await this.prisma.group.delete({ where: { id } });
    return deleted;
  }
}
