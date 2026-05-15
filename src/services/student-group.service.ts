import { getPrismaClient } from "../database/prisma";
import { GroupRepository } from "../repositories/group.repository";
import { RoleRepository } from "../repositories/role.repository";
import { StudentGroupRepository } from "../repositories/student-group.repository";
import { StudentRepository } from "../repositories/student.repository";
import type {
  AddStudentToGroupInput,
  ChangeMembershipRoleInput,
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
          throw new ConflictError("El estudiante ya pertenece activamente a este grupo.");
        }

        return repository.createMembership(data);
      });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("El estudiante ya pertenece activamente a este grupo.");
      }

      throw error;
    }
  }

  async removeStudentFromGroup(input: RemoveStudentFromGroupInput) {
    const membership = await this.membershipRepository.findActiveMembership(input.studentId, input.groupId);
    if (!membership) {
      throw new NotFoundError("No existe una participacion activa para ese estudiante y grupo.");
    }

    const data = validateMembershipRemoval(input, membership.joinedAt);
    return this.membershipRepository.deactivateMembership(membership.id, data.leftAt ?? new Date());
  }

  async changeRole(input: ChangeMembershipRoleInput) {
    await this.ensureRoleExists(input.roleId);
    const membership = await this.membershipRepository.findActiveMembership(input.studentId, input.groupId);
    if (!membership) {
      throw new NotFoundError("No existe una participacion activa para ese estudiante y grupo.");
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
