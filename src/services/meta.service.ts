import { getPrismaClient } from "../database/prisma";

export class MetaService {
  private readonly prisma = getPrismaClient();

  async getSummary() {
    const [students, groups, categories, roles, activeMemberships] = await Promise.all([
      this.prisma.student.count({ where: { deletedAt: null } }),
      this.prisma.group.count({ where: { deletedAt: null } }),
      this.prisma.category.count({ where: { deletedAt: null } }),
      this.prisma.role.count({ where: { deletedAt: null } }),
      this.prisma.studentGroup.count({ where: { active: true } })
    ]);

    return {
      students,
      groups,
      categories,
      roles,
      activeMemberships
    };
  }
}
