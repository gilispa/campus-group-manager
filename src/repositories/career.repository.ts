import type { PrismaClient } from "@prisma/client";
import type { Career, CareerCreateInput, CareerUpdateInput } from "../types/domain";

export class CareerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CareerCreateInput): Promise<Career> {
    return this.prisma.career.create({
      data: {
        name: data.name,
        ...(data.description !== undefined ? { description: data.description } : {})
      }
    });
  }

  async update(id: string, data: CareerUpdateInput): Promise<Career> {
    return this.prisma.career.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {})
      }
    });
  }

  async delete(id: string): Promise<Career> {
    return this.prisma.career.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findById(id: string): Promise<Career | null> {
    return this.prisma.career.findFirst({ where: { id, deletedAt: null } });
  }

  async list(): Promise<Career[]> {
    return this.prisma.career.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  }

  async countStudents(id: string): Promise<number> {
    return this.prisma.student.count({ where: { careerId: id, deletedAt: null } });
  }

  async listDeleted(): Promise<Career[]> {
    return this.prisma.career.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } });
  }

  async restore(id: string): Promise<Career> {
    return this.prisma.career.update({ where: { id }, data: { deletedAt: null } });
  }
}
