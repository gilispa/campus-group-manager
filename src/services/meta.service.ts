import { getPrismaClient } from "../database/prisma";

export class MetaService {
  private readonly prisma = getPrismaClient();

  async getSummary() {
    const [students, groups] = await Promise.all([
      this.prisma.student.findMany({
        where: { deletedAt: null, activo: true },
        select: { id: true, nivel: true }
      }),
      this.prisma.group.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          memberships: {
            where: {
              active: true,
              student: { deletedAt: null, activo: true }
            },
            select: {
              student: {
                select: { id: true, nivel: true }
              }
            }
          }
        }
      })
    ]);

    const segmentStudents = {
      general: students,
      prepa: students.filter((student) => student.nivel === "PREPA"),
      profesional: students.filter((student) => student.nivel === "PROFESIONAL")
    };
    const studentIdsInGroups = {
      general: new Set<string>(),
      prepa: new Set<string>(),
      profesional: new Set<string>()
    };

    for (const group of groups) {
      for (const membership of group.memberships) {
        studentIdsInGroups.general.add(membership.student.id);
        if (membership.student.nivel === "PREPA") {
          studentIdsInGroups.prepa.add(membership.student.id);
        }
        if (membership.student.nivel === "PROFESIONAL") {
          studentIdsInGroups.profesional.add(membership.student.id);
        }
      }
    }

    const prepaGroups = groups.filter((group) => group.memberships.some((membership) => membership.student.nivel === "PREPA"));
    const profesionalGroups = groups.filter((group) => group.memberships.some((membership) => membership.student.nivel === "PROFESIONAL"));

    const buildSegment = (
      studentCount: number,
      groupCount: number,
      studentsInGroups: number
    ) => ({
      students: studentCount,
      groups: groupCount,
      studentsInGroups,
      studentsWithoutGroup: Math.max(0, studentCount - studentsInGroups)
    });

    return {
      general: buildSegment(segmentStudents.general.length, groups.length, studentIdsInGroups.general.size),
      prepa: buildSegment(segmentStudents.prepa.length, prepaGroups.length, studentIdsInGroups.prepa.size),
      profesional: buildSegment(segmentStudents.profesional.length, profesionalGroups.length, studentIdsInGroups.profesional.size)
    };
  }

  async getOperationalSummary() {
    const [
      studentsWithoutActiveGroup,
      inactiveStudentsWithActiveMembership,
      groups,
      giros,
      roles
    ] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          deletedAt: null,
          memberships: {
            none: {
              active: true,
              group: { deletedAt: null }
            }
          }
        },
        select: { id: true, nombre: true, matricula: true },
        orderBy: { nombre: "asc" }
      }),
      this.prisma.student.findMany({
        where: {
          deletedAt: null,
          activo: false,
          memberships: {
            some: {
              active: true,
              group: { deletedAt: null }
            }
          }
        },
        select: { id: true, nombre: true, matricula: true },
        orderBy: { nombre: "asc" }
      }),
      this.prisma.group.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          nombre: true,
          memberships: {
            where: {
              active: true,
              student: { deletedAt: null }
            },
            select: {
              role: {
                select: { name: true }
              }
            }
          }
        },
        orderBy: { nombre: "asc" }
      }),
      this.prisma.giro.findMany({
        where: {
          deletedAt: null,
          groups: {
            none: { deletedAt: null }
          }
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      }),
      this.prisma.role.findMany({
        where: {
          deletedAt: null,
          memberships: {
            none: {
              active: true,
              student: { deletedAt: null },
              group: { deletedAt: null }
            }
          }
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      })
    ]);

    const groupsWithoutLeaderRows = groups
      .map((group) => ({
        id: group.id,
        nombre: group.nombre,
        activeMembers: group.memberships.length,
        hasLeader: group.memberships.some((membership) => isLeaderRole(membership.role?.name))
      }))
      .filter((group) => group.activeMembers > 0 && !group.hasLeader)
      .map((group) => ({
        id: group.id,
        nombre: group.nombre,
        activeMembers: group.activeMembers
      }));

    const groupsWithLowMembershipRows = groups
      .map((group) => ({
        id: group.id,
        nombre: group.nombre,
        activeMembers: group.memberships.length
      }))
      .filter((group) => group.activeMembers < 2);

    return {
      studentsWithoutActiveGroup: studentsWithoutActiveGroup.length,
      groupsWithoutLeader: groupsWithoutLeaderRows.length,
      groupsWithLowMembership: groupsWithLowMembershipRows.length,
      emptyCategories: giros.length,
      unusedRoles: roles.length,
      inactiveStudentsWithActiveMembership: inactiveStudentsWithActiveMembership.length,
      studentAlerts: studentsWithoutActiveGroup,
      groupsWithoutLeaderRows,
      groupsWithLowMembershipRows,
      emptyCategoryRows: giros,
      unusedRoleRows: roles,
      inactiveStudentRows: inactiveStudentsWithActiveMembership
    };
  }
}

function isLeaderRole(roleName?: string | null): boolean {
  if (!roleName) {
    return false;
  }

  const normalized = roleName
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized === "lider" || normalized === "presidente" || normalized === "coordinador";
}
