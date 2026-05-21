import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { appPaths, uploadPrefixes } from "../config/paths";
import { getPrismaClient } from "../database/prisma";
import { CareerRepository } from "../repositories/career.repository";
import { PrepaProgramRepository } from "../repositories/prepa-program.repository";
import { StudentRepository } from "../repositories/student.repository";
import type { StudentCreateInput, StudentSearchFilters, StudentUpdateInput } from "../types/domain";
import { ConflictError, NotFoundError } from "../utils/errors";
import { validateStudentCreate, validateStudentSearchFilters, validateStudentUpdate } from "../validation/student.validation";

export class StudentService {
  private readonly prisma = getPrismaClient();
  private readonly repository = new StudentRepository(this.prisma);
  private readonly careerRepository = new CareerRepository(this.prisma);
  private readonly prepaProgramRepository = new PrepaProgramRepository(this.prisma);

  async createStudent(input: StudentCreateInput) {
    const data = validateStudentCreate(input);
    await this.ensureAcademicLinksExist(data);
    await this.ensureUniqueStudentFields(data);

    try {
      return await this.repository.create(data);
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
      return await this.repository.update(id, data);
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
