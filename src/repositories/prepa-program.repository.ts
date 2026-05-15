import type { PrismaClient } from "@prisma/client";
import type { PrepaProgram, PrepaProgramCreateInput, PrepaProgramUpdateInput } from "../types/domain";

export class PrepaProgramRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: PrepaProgramCreateInput): Promise<PrepaProgram> {
    return this.prisma.prepaProgram.create({
      data: {
        name: data.name,
        ...(data.description !== undefined ? { description: data.description } : {})
      }
    });
  }

  async update(id: string, data: PrepaProgramUpdateInput): Promise<PrepaProgram> {
    return this.prisma.prepaProgram.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {})
      }
    });
  }

  async delete(id: string): Promise<PrepaProgram> {
    return this.prisma.prepaProgram.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findById(id: string): Promise<PrepaProgram | null> {
    return this.prisma.prepaProgram.findFirst({ where: { id, deletedAt: null } });
  }

  async list(): Promise<PrepaProgram[]> {
    return this.prisma.prepaProgram.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  }

  async countStudents(id: string): Promise<number> {
    return this.prisma.student.count({ where: { prepaProgramId: id, deletedAt: null } });
  }

  async listDeleted(): Promise<PrepaProgram[]> {
    return this.prisma.prepaProgram.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } });
  }

  async restore(id: string): Promise<PrepaProgram> {
    return this.prisma.prepaProgram.update({ where: { id }, data: { deletedAt: null } });
  }
}
