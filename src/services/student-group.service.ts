import { getPrismaClient } from "../database/prisma";
import { GroupRepository } from "../repositories/group.repository";
import { RoleRepository } from "../repositories/role.repository";
import { StudentGroupRepository } from "../repositories/student-group.repository";
import { StudentRepository } from "../repositories/student.repository";
import type {
  AddStudentToGroupInput,
  BulkImportResult,
  ChangeMembershipRoleInput,
  MembershipCsvExportInput,
  ParticipationCsvImportRow,
  RemoveStudentFromGroupInput
} from "../types/domain";
import { ConflictError, NotFoundError } from "../utils/errors";
import { validateAddStudentToGroupInput, validateMembershipRemoval } from "../validation/student-group.validation";

export class StudentGroupService {
  private readonly prisma = getPrismaClient();
  private readonly studentRepository = new StudentRepository(this.prisma);
  private readonly groupRepository = new GroupRepository(this.prisma);
  private readonly roleRepository = new RoleRepository(this.prisma);
  private readonly membershipRepository = new StudentGroupRepository(this.prisma);

  async addStudentToGroup(input: AddStudentToGroupInput) {
    const data = validateAddStudentToGroupInput(input);

    await this.ensureStudentExists(input.studentId);
    await this.ensureGroupExists(input.groupId);
    await this.ensureRoleExists(input.roleId);

    try {
      return await this.membershipRepository.createMembershipTransaction(async (repository) => {
        const activeMembership = await repository.findActiveMembership(data.studentId, data.groupId);
        if (activeMembership) {
          throw new ConflictError("El estudiante ya tiene una pertenencia vigente a este grupo.");
        }

        return repository.createMembership(data);
      });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("El estudiante ya tiene una pertenencia vigente a este grupo.");
      }

      throw error;
    }
  }

  async removeStudentFromGroup(input: RemoveStudentFromGroupInput) {
    const membership = await this.membershipRepository.findActiveMembership(input.studentId, input.groupId);
    if (!membership) {
      throw new NotFoundError("No existe una pertenencia vigente para ese estudiante y grupo.");
    }

    const data = validateMembershipRemoval(input, membership.joinedAt);
    return this.membershipRepository.deactivateMembership(membership.id, data.leftAt ?? new Date());
  }

  async changeRole(input: ChangeMembershipRoleInput) {
    await this.ensureRoleExists(input.roleId);
    const membership = await this.membershipRepository.findActiveMembership(input.studentId, input.groupId);
    if (!membership) {
      throw new NotFoundError("No existe una pertenencia vigente para ese estudiante y grupo.");
    }

    return this.membershipRepository.updateRole(membership.id, input.roleId);
  }

  async listGroupsOfStudent(studentId: string) {
    await this.ensureStudentExists(studentId);
    return this.membershipRepository.listGroupsForStudent(studentId);
  }

  async listGroupsOfStudents(studentIds: string[]) {
    if (studentIds.length === 0) {
      return [];
    }

    return this.membershipRepository.listGroupsForStudents(studentIds);
  }

  async listStudentsOfGroup(groupId: string) {
    await this.ensureGroupExists(groupId);
    return this.membershipRepository.listStudentsForGroup(groupId);
  }

  async getParticipationHistoryByStudent(studentId: string) {
    await this.ensureStudentExists(studentId);
    return this.membershipRepository.getParticipationHistoryForStudent(studentId);
  }

  async getParticipationHistoryByGroup(groupId: string) {
    await this.ensureGroupExists(groupId);
    return this.membershipRepository.getParticipationHistoryForGroup(groupId);
  }

  async listMembershipsForCsvExport(input: MembershipCsvExportInput = {}) {
    const filters = {
      participationStatus: input.participationStatus ?? "all",
      groupIds: input.groupIds ?? [],
      studentIds: input.studentIds ?? [],
      roleIds: input.roleIds ?? []
    };

    return this.prisma.studentGroup.findMany({
      where: {
        ...(filters.participationStatus === "active" ? { active: true } : {}),
        ...(filters.groupIds.length ? { groupId: { in: filters.groupIds } } : {}),
        ...(filters.studentIds.length ? { studentId: { in: filters.studentIds } } : {}),
        ...(filters.roleIds.length ? { roleId: { in: filters.roleIds } } : {}),
        student: { deletedAt: null },
        group: { deletedAt: null }
      },
      include: {
        student: { include: { career: true, prepaProgram: true } },
        group: { include: { giro: true, portfolio: true } },
        role: true
      },
      orderBy: [{ joinedAt: "desc" }, { studentId: "asc" }]
    });
  }

  async importMemberships(rows: ParticipationCsvImportRow[]): Promise<BulkImportResult> {
    const result: BulkImportResult = { created: 0, failed: 0, errors: [] };
    if (rows.length === 0) {
      return result;
    }

    const [students, groups, roles] = await Promise.all([
      this.studentRepository.list(),
      this.groupRepository.list(),
      this.roleRepository.list()
    ]);
    const studentByMatricula = new Map(students.map((student) => [normalizeLookupKey(student.matricula), student]));
    const groupByName = new Map(groups.map((group) => [normalizeLookupKey(group.nombre), group]));
    const roleByName = new Map(roles.map((role) => [normalizeLookupKey(role.name), role]));

    for (const [index, row] of rows.entries()) {
      const lineNumber = index + 2;
      try {
        const student = studentByMatricula.get(normalizeLookupKey(row.matricula));
        if (!student) {
          throw new Error(`No existe estudiante con matricula "${row.matricula}".`);
        }

        const group = groupByName.get(normalizeLookupKey(row.groupName));
        if (!group) {
          throw new Error(`No existe grupo "${row.groupName}".`);
        }

        const roleName = row.roleName?.trim();
        const role = roleName ? roleByName.get(normalizeLookupKey(roleName)) : null;
        if (roleName && !role) {
          throw new Error(`No existe rol "${roleName}".`);
        }

        const joinedAt = parseOptionalDate(row.joinedAt, "FechaIngreso") ?? new Date();
        const shouldRemainActive = row.active ?? !row.leftAt;
        const leftAt = parseOptionalDate(row.leftAt, "FechaSalida") ?? (shouldRemainActive ? null : joinedAt);
        if (leftAt && leftAt < joinedAt) {
          throw new Error("La fecha de salida no puede ser anterior a la fecha de ingreso.");
        }

        await this.addStudentToGroup({
          studentId: student.id,
          groupId: group.id,
          roleId: role?.id ?? null,
          joinedAt
        });

        if (!shouldRemainActive) {
          await this.removeStudentFromGroup({
            studentId: student.id,
            groupId: group.id,
            leftAt: leftAt ?? joinedAt
          });
        }

        result.created += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push(`Fila ${lineNumber}: ${getErrorMessage(error)}`);
      }
    }

    return result;
  }

  private async ensureStudentExists(studentId: string) {
    const student = await this.studentRepository.findById(studentId);
    if (!student) {
      throw new NotFoundError("Estudiante no encontrado.");
    }

    return student;
  }

  private async ensureGroupExists(groupId: string) {
    const group = await this.groupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError("Grupo no encontrado.");
    }

    return group;
  }

  private async ensureRoleExists(roleId?: string | null) {
    if (!roleId) {
      return null;
    }

    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundError("Rol no encontrado.");
    }

    return role;
  }
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Error inesperado.";
}

function normalizeLookupKey(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseOptionalDate(value: Date | string | null | undefined, field: string): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${field} tiene un formato invalido.`);
    }

    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} tiene un formato invalido.`);
  }

  return parsed;
}
