import { getPrismaClient } from "../database/prisma";
import type { PendingMembershipSearchFilters } from "../types/domain";
import { NotFoundError } from "../utils/errors";

export class PendingMembershipService {
  private readonly prisma = getPrismaClient();

  async listPendingMemberships(filters: PendingMembershipSearchFilters = {}) {
    return this.prisma.pendingMembership.findMany({
      where: {
        ...(filters.groupId ? { groupId: filters.groupId } : {}),
        ...(filters.status ? { status: filters.status } : {})
      },
      include: {
        group: { include: { giro: true, portfolio: true } },
        role: true,
        resolvedStudent: {
          include: {
            career: true,
            prepaProgram: true
          }
        }
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }]
    });
  }

  async cancelPendingMembership(id: string) {
    const pending = await this.prisma.pendingMembership.findFirst({
      where: { id, status: "PENDING" }
    });
    if (!pending) {
      throw new NotFoundError("Pendiente no encontrado.");
    }

    return this.prisma.pendingMembership.update({
      where: { id },
      data: {
        status: "CANCELLED",
        resolvedAt: new Date()
      },
      include: {
        group: { include: { giro: true, portfolio: true } },
        role: true,
        resolvedStudent: {
          include: {
            career: true,
            prepaProgram: true
          }
        }
      }
    });
  }

  async resolvePendingMembershipsForStudent(studentId: string, matricula: string) {
    const pendingRows = await this.prisma.pendingMembership.findMany({
      where: {
        matricula,
        status: "PENDING",
        group: { deletedAt: null }
      }
    });

    if (pendingRows.length === 0) {
      return { resolved: 0 };
    }

    let resolved = 0;
    await this.prisma.$transaction(async (transaction) => {
      for (const pending of pendingRows) {
        const activeMembership = await transaction.studentGroup.findFirst({
          where: {
            studentId,
            groupId: pending.groupId,
            active: true
          }
        });

        if (!activeMembership) {
          await transaction.studentGroup.create({
            data: {
              studentId,
              groupId: pending.groupId,
              roleId: pending.roleId,
              managementCycleId: pending.managementCycleId,
              joinedAt: pending.joinedAt ?? new Date()
            }
          });
        }

        await transaction.pendingMembership.update({
          where: { id: pending.id },
          data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            resolvedStudentId: studentId
          }
        });
        resolved += 1;
      }
    });

    return { resolved };
  }
}
