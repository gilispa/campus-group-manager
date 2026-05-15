import type { Prisma, PrismaClient } from "@prisma/client";
import type { StudentCreateInput, StudentSearchFilters, StudentUpdateInput } from "../types/domain";
import type { Student } from "../types/domain";

export class StudentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: StudentCreateInput): Promise<Student> {
    const createData: Prisma.StudentUncheckedCreateInput = {
      nombre: data.nombre,
      matricula: data.matricula,
      nivel: data.nivel,
      generacion: data.generacion,
      ...(data.careerId !== undefined ? { careerId: data.careerId } : {}),
      ...(data.prepaProgramId !== undefined ? { prepaProgramId: data.prepaProgramId } : {}),
      ...(data.foto !== undefined ? { foto: data.foto } : {}),
      ...(data.telefono !== undefined ? { telefono: data.telefono } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.notas !== undefined ? { notas: data.notas } : {}),
      ...(data.activo !== undefined ? { activo: data.activo } : {})
    };

    return this.prisma.student.create({
      data: createData,
      include: {
        career: true,
        prepaProgram: true
      }
    });
  }

  async update(id: string, data: StudentUpdateInput): Promise<Student> {
    const updateData: Prisma.StudentUncheckedUpdateInput = {
      ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
      ...(data.matricula !== undefined ? { matricula: data.matricula } : {}),
      ...(data.nivel !== undefined ? { nivel: data.nivel } : {}),
      ...(data.careerId !== undefined ? { careerId: data.careerId } : {}),
      ...(data.prepaProgramId !== undefined ? { prepaProgramId: data.prepaProgramId } : {}),
      ...(data.generacion !== undefined ? { generacion: data.generacion } : {}),
      ...(data.foto !== undefined ? { foto: data.foto } : {}),
      ...(data.telefono !== undefined ? { telefono: data.telefono } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.notas !== undefined ? { notas: data.notas } : {}),
      ...(data.activo !== undefined ? { activo: data.activo } : {})
    };

    return this.prisma.student.update({
      where: { id },
      data: updateData,
      include: {
        career: true,
        prepaProgram: true
      }
    });
  }

  async delete(id: string): Promise<Student> {
    return this.prisma.student.update({
      where: { id },
      data: { deletedAt: new Date(), activo: false },
      include: {
        career: true,
        prepaProgram: true
      }
    });
  }

  async findById(id: string): Promise<Student | null> {
    return this.prisma.student.findFirst({
      where: { id, deletedAt: null },
      include: {
        career: true,
        prepaProgram: true
      }
    });
  }

  async findByMatricula(matricula: string): Promise<Student | null> {
    return this.prisma.student.findUnique({
      where: { matricula },
      include: {
        career: true,
        prepaProgram: true
      }
    });
  }

  async list(): Promise<Student[]> {
    return this.prisma.student.findMany({
      where: { deletedAt: null },
      include: {
        career: true,
        prepaProgram: true
      },
      orderBy: { nombre: "asc" }
    });
  }

  async search(filters: StudentSearchFilters): Promise<Student[]> {
    const where: Prisma.StudentWhereInput = {
      deletedAt: null,
      ...(filters.nombre ? { nombre: { contains: filters.nombre } } : {}),
      ...(filters.matricula ? { matricula: { contains: filters.matricula } } : {}),
      ...(filters.careerId ? { careerId: filters.careerId } : {}),
      ...(filters.prepaProgramId ? { prepaProgramId: filters.prepaProgramId } : {}),
      ...(filters.generacion !== undefined ? { generacion: filters.generacion } : {}),
      ...(filters.nivel ? { nivel: filters.nivel } : {}),
      ...(filters.roleId
        ? {
            memberships: {
              some: {
                roleId: filters.roleId,
                active: true
              }
            }
          }
        : {}),
      ...(filters.activo !== undefined ? { activo: filters.activo } : {})
    };

    return this.prisma.student.findMany({
      where,
      include: {
        career: true,
        prepaProgram: true
      },
      orderBy: { nombre: "asc" }
    });
  }

  async hasMembershipHistory(id: string): Promise<boolean> {
    const count = await this.prisma.studentGroup.count({ where: { studentId: id } });
    return count > 0;
  }

  async listDeleted(): Promise<Student[]> {
    return this.prisma.student.findMany({
      where: { deletedAt: { not: null } },
      include: {
        career: true,
        prepaProgram: true
      },
      orderBy: { deletedAt: "desc" }
    });
  }

  async restore(id: string): Promise<Student> {
    return this.prisma.student.update({
      where: { id },
      data: { deletedAt: null, activo: true },
      include: {
        career: true,
        prepaProgram: true
      }
    });
  }
}
