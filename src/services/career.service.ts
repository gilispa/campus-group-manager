import { getPrismaClient } from "../database/prisma";
import { CareerRepository } from "../repositories/career.repository";
import type { CareerCreateInput, CareerUpdateInput } from "../types/domain";
import { ConflictError, NotFoundError } from "../utils/errors";
import { validateCareerCreate, validateCareerUpdate } from "../validation/common.validation";

export class CareerService {
  private readonly repository = new CareerRepository(getPrismaClient());

  async createCareer(input: CareerCreateInput) {
    const data = validateCareerCreate(input);

    try {
      return await this.repository.create(data);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("Ya existe una carrera con ese nombre.");
      }

      throw error;
    }
  }

  async updateCareer(id: string, input: CareerUpdateInput) {
    await this.ensureCareerExists(id);
    const data = validateCareerUpdate(input);

    try {
      return await this.repository.update(id, data);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("Ya existe una carrera con ese nombre.");
      }

      throw error;
    }
  }

  async deleteCareer(id: string) {
    await this.ensureCareerExists(id);
    return this.repository.delete(id);
  }

  async restoreCareer(id: string) {
    return this.repository.restore(id);
  }

  async permanentlyDeleteCareer(id: string) {
    try {
      return await this.repository.permanentDelete(id);
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND_OR_NOT_DELETED") {
        throw new NotFoundError("La carrera no esta en la papelera.");
      }
      throw error;
    }
  }

  async getCareerById(id: string) {
    return this.ensureCareerExists(id);
  }

  async listCareers() {
    return this.repository.list();
  }

  async listDeletedCareers() {
    return this.repository.listDeleted();
  }

  private async ensureCareerExists(id: string) {
    const career = await this.repository.findById(id);
    if (!career) {
      throw new NotFoundError("Carrera no encontrada.");
    }

    return career;
  }
}
