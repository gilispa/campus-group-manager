import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { appPaths, uploadPrefixes } from "../config/paths";
import { getPrismaClient } from "../database/prisma";
import { CareerRepository } from "../repositories/career.repository";
import { PrepaProgramRepository } from "../repositories/prepa-program.repository";
import { StudentRepository } from "../repositories/student.repository";
import { PendingMembershipService } from "./pending-membership.service";
import type { GraduateStudentsInput, StudentCreateInput, StudentSearchFilters, StudentUpdateInput } from "../types/domain";
import { ConflictError, NotFoundError } from "../utils/errors";
import { validateStudentCreate, validateStudentSearchFilters, validateStudentUpdate } from "../validation/student.validation";

export class StudentService {
  private readonly prisma = getPrismaClient();
  private readonly repository = new StudentRepository(this.prisma);
  private readonly careerRepository = new CareerRepository(this.prisma);
  private readonly prepaProgramRepository = new PrepaProgramRepository(this.prisma);
  private readonly pendingMembershipService = new PendingMembershipService();

  async createStudent(input: StudentCreateInput) {
    const data = validateStudentCreate(input);
    await this.ensureAcademicLinksExist(data);
    await this.ensureUniqueStudentFields(data);

    try {
      const created = await this.repository.create(data);
      await this.pendingMembershipService.resolvePendingMembershipsForStudent(created.id, created.matricula);
      return created;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("Ya existe un estudiante con esa matricula.");
      }

      throw error;
    }
  }

  async updateStudent(id: string, input: StudentUpdateInput) {
    const current = await this.ensureStudentExists(id);
    const data = validateStudentUpdate(current, input);
    await this.ensureAcademicLinksExist(data);
    await this.ensureUniqueStudentFields(this.getChangedUniqueStudentFields(current, data), id);

    try {
      const updated = await this.repository.update(id, data);
      await this.pendingMembershipService.resolvePendingMembershipsForStudent(updated.id, updated.matricula);
      return updated;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("Ya existe un estudiante con esa matricula.");
      }

      throw error;
    }
  }

  async deleteStudent(id: string) {
    await this.ensureStudentExists(id);
    return this.repository.delete(id);
  }

  async restoreStudent(id: string) {
    const deletedStudent = await this.repository.findDeletedById(id);
    if (!deletedStudent) {
      throw new NotFoundError("El estudiante no esta en la papelera.");
    }

    await this.ensureUniqueStudentFields({
      nombre: deletedStudent.nombre,
      matricula: deletedStudent.matricula,
      email: deletedStudent.email
    }, id);

    return this.repository.restore(id);
  }

  async permanentlyDeleteStudent(id: string) {
    try {
      const deletedStudent = await this.repository.permanentDelete(id);
      await this.removeStoredStudentPhoto(deletedStudent.foto);
      return deletedStudent;
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND_OR_NOT_DELETED") {
        throw new NotFoundError("El estudiante no esta en la papelera.");
      }
      throw error;
    }
  }

  async getStudentById(id: string) {
    return this.ensureStudentExists(id);
  }

  async listStudents() {
    return this.repository.list();
  }

  async listDeletedStudents() {
    return this.repository.listDeleted();
  }

  async searchStudents(filters: StudentSearchFilters) {
    const normalized = validateStudentSearchFilters(filters);
    return this.repository.search(normalized);
  }

  async graduateStudents(input: GraduateStudentsInput) {
    const studentIds = Array.from(new Set(input.studentIds.map((studentId) => studentId.trim()).filter(Boolean)));
    if (studentIds.length === 0) {
      return { graduated: 0, transitioned: 0, deactivatedMemberships: 0 };
    }

    const students = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        nivel: input.level,
        deletedAt: null
      },
      select: { id: true }
    });
    const eligibleStudentIds = students.map((student) => student.id);
    const eligibleSet = new Set(eligibleStudentIds);
    const continuingPrepaIds = input.level === "PREPA"
      ? Array.from(new Set((input.prepaContinuingStudentIds ?? []).filter((studentId) => eligibleSet.has(studentId))))
      : [];
    const continuingSet = new Set(continuingPrepaIds);
    const graduatingIds = eligibleStudentIds.filter((studentId) => !continuingSet.has(studentId));

    const result = {
      graduated: graduatingIds.length,
      transitioned: continuingPrepaIds.length,
      deactivatedMemberships: 0
    };

    await this.prisma.$transaction(async (transaction) => {
      const deactivated = await transaction.studentGroup.updateMany({
        where: {
          studentId: { in: eligibleStudentIds },
          active: true
        },
        data: {
          active: false,
          leftAt: new Date()
        }
      });
      result.deactivatedMemberships = deactivated.count;

      if (graduatingIds.length > 0) {
        await transaction.student.updateMany({
          where: { id: { in: graduatingIds } },
          data: { activo: false }
        });
      }

      if (continuingPrepaIds.length > 0) {
        await transaction.student.updateMany({
          where: { id: { in: continuingPrepaIds } },
          data: {
            nivel: "PROFESIONAL",
            activo: true,
            prepaProgramId: null,
            careerId: null,
            generacion: null,
            academicPending: true
          }
        });
      }
    });

    return result;
  }

  async saveStudentPhoto(sourcePath: string, currentPhoto?: string | null): Promise<string> {
    const extension = path.extname(sourcePath).toLowerCase();
    const allowed = new Set([".png", ".jpg", ".jpeg", ".webp"]);
    if (!allowed.has(extension)) {
      throw new ConflictError("Formato de imagen no permitido.");
    }

    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const destination = path.join(appPaths.studentUploadsDir, fileName);
    await fs.copyFile(sourcePath, destination);

    if (currentPhoto && currentPhoto.startsWith(uploadPrefixes.students)) {
      const previousFile = path.basename(currentPhoto);
      const previousPath = path.join(appPaths.studentUploadsDir, previousFile);
      if (previousPath !== destination) {
        await fs.rm(previousPath, { force: true });
      }
    }

    return `${uploadPrefixes.students}${fileName}`;
  }

  private async removeStoredStudentPhoto(photoPath?: string | null) {
    if (!photoPath || !photoPath.startsWith(uploadPrefixes.students)) {
      return;
    }

    const fileName = path.basename(photoPath);
    const absolutePath = path.join(appPaths.studentUploadsDir, fileName);
    await fs.rm(absolutePath, { force: true });
  }

  private async ensureStudentExists(id: string) {
    const student = await this.repository.findById(id);
    if (!student) {
      throw new NotFoundError("Estudiante no encontrado.");
    }

    return student;
  }

  private async ensureUniqueStudentFields(
    input: { nombre?: string | undefined; matricula?: string | undefined; email?: string | null | undefined },
    excludeId?: string
  ) {
    const duplicate = await this.repository.findFirstDuplicate({
      nombre: input.nombre,
      matricula: input.matricula,
      email: input.email
    }, excludeId);

    if (!duplicate) {
      return;
    }

    if (input.matricula && duplicate.matricula === input.matricula) {
      throw new ConflictError("Ya existe un estudiante con esa matricula.");
    }

    if (input.email && duplicate.email === input.email) {
      throw new ConflictError("Ya existe un estudiante con ese correo.");
    }

    if (input.nombre && duplicate.nombre === input.nombre) {
      throw new ConflictError("Ya existe un estudiante con ese nombre.");
    }
  }

  private getChangedUniqueStudentFields(
    current: { nombre: string; matricula: string; email: string | null },
    next: { nombre?: string | undefined; matricula?: string | undefined; email?: string | null | undefined }
  ) {
    return {
      ...(next.nombre !== undefined && next.nombre !== current.nombre ? { nombre: next.nombre } : {}),
      ...(next.matricula !== undefined && next.matricula !== current.matricula ? { matricula: next.matricula } : {}),
      ...(next.email !== undefined && next.email !== current.email ? { email: next.email } : {})
    };
  }

  private async ensureAcademicLinksExist(input: Pick<StudentCreateInput, "careerId" | "prepaProgramId">) {
    if (input.careerId) {
      const career = await this.careerRepository.findById(input.careerId);
      if (!career) {
        throw new NotFoundError("Carrera no encontrada.");
      }
    }

    if (input.prepaProgramId) {
      const program = await this.prepaProgramRepository.findById(input.prepaProgramId);
      if (!program) {
        throw new NotFoundError("Programa no encontrado.");
      }
    }
  }
}
