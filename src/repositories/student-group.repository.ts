import type { Prisma, PrismaClient } from "@prisma/client";
import type { AddStudentToGroupInput } from "../types/domain";

type StudentGroupDbClient = PrismaClient | Prisma.TransactionClient;

export class StudentGroupRepository {
  constructor(private readonly prisma: StudentGroupDbClient) {}

  async createMembership(data: AddStudentToGroupInput) {
    const createData = {
      studentId: data.studentId,
      groupId: data.groupId,
      roleId: data.roleId ?? null,
      ...(data.joinedAt !== undefined ? { joinedAt: data.joinedAt } : {})
    };

    return this.prisma.studentGroup.create({
      data: createData,
      include: {
        student: {
          include: {
            career: true,
            prepaProgram: true
          }
        },
        group: { include: { category: true } },
        role: true
      }
    });
  }

  async createMembershipTransaction<T>(
    operation: (repository: StudentGroupRepository) => Promise<T>
  ): Promise<T> {
    if (!("$transaction" in this.prisma)) {
      return operation(this);
    }

    return this.prisma.$transaction((transaction: Prisma.TransactionClient) => {
      return operation(new StudentGroupRepository(transaction));
    });
  }

  async findActiveMembership(studentId: string, groupId: string) {
    return this.prisma.studentGroup.findFirst({
      where: {
        studentId,
        groupId,
        active: true
      },
      include: {
        student: {
          include: {
            career: true,
            prepaProgram: true
          }
        },
        group: { include: { category: true } },
        role: true
      }
    });
  }

  async deactivateMembership(id: string, leftAt: Date) {
    return this.prisma.studentGroup.update({
      where: { id },
      data: {
        active: false,
        leftAt
      },
      include: {
        student: {
          include: {
            career: true,
            prepaProgram: true
          }
        },
        group: { include: { category: true } },
        role: true
      }
    });
  }

  async updateRole(id: string, roleId?: string | null) {
    return this.prisma.studentGroup.update({
      where: { id },
      data: { roleId: roleId ?? null },
      include: {
        student: {
          include: {
            career: true,
            prepaProgram: true
          }
        },
        group: { include: { category: true } },
        role: true
      }
    });
  }

  async listGroupsForStudent(studentId: string) {
    return this.prisma.studentGroup.findMany({
      where: { studentId },
      include: {
        group: { include: { category: true } },
        role: true
      },
      orderBy: { joinedAt: "desc" }
    });
  }

  async listGroupsForStudents(studentIds: string[]) {
    return this.prisma.studentGroup.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        group: { include: { category: true } },
        role: true
      },
      orderBy: { joinedAt: "desc" }
    });
  }

  async listStudentsForGroup(groupId: string) {
    return this.prisma.studentGroup.findMany({
      where: { groupId },
      include: {
        student: {
          include: {
            career: true,
            prepaProgram: true
          }
        },
        role: true
      },
      orderBy: [{ active: "desc" }, { joinedAt: "desc" }]
    });
  }

  async getParticipationHistoryForStudent(studentId: string) {
    return this.prisma.studentGroup.findMany({
      where: { studentId },
      include: {
        group: { include: { category: true } },
        role: true
      },
      orderBy: { joinedAt: "desc" }
    });
  }

  async getParticipationHistoryForGroup(groupId: string) {
    return this.prisma.studentGroup.findMany({
      where: { groupId },
      include: {
        student: {
          include: {
            career: true,
            prepaProgram: true
          }
        },
        role: true
      },
      orderBy: { joinedAt: "desc" }
    });
  }
}
