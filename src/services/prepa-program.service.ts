import { getPrismaClient } from "../database/prisma";
import { PrepaProgramRepository } from "../repositories/prepa-program.repository";
import type { PrepaProgramCreateInput, PrepaProgramUpdateInput } from "../types/domain";
import { ConflictError, NotFoundError } from "../utils/errors";
import { validatePrepaProgramCreate, validatePrepaProgramUpdate } from "../validation/common.validation";

export class PrepaProgramService {
  private readonly repository = new PrepaProgramRepository(getPrismaClient());

  async createPrepaProgram(input: PrepaProgramCreateInput) {
    const data = validatePrepaProgramCreate(input);

    try {
      return await this.repository.create(data);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("Ya existe un programa con ese nombre.");
      }

      throw error;
    }
  }

  async updatePrepaProgram(id: string, input: PrepaProgramUpdateInput) {
    await this.ensurePrepaProgramExists(id);
    const data = validatePrepaProgramUpdate(input);

    try {
      return await this.repository.update(id, data);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("Ya existe un programa con ese nombre.");
      }

      throw error;
    }
  }

  async deletePrepaProgram(id: string) {
    await this.ensurePrepaProgramExists(id);
    return this.repository.delete(id);
  }

  async restorePrepaProgram(id: string) {
    return this.repository.restore(id);
  }

  async permanentlyDeletePrepaProgram(id: string) {
    try {
      return await this.repository.permanentDelete(id);
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND_OR_NOT_DELETED") {
        throw new NotFoundError("El programa no esta en la papelera.");
      }
      throw error;
    }
  }

  async getPrepaProgramById(id: string) {
    return this.ensurePrepaProgramExists(id);
  }

  async listPrepaPrograms() {
    return this.repository.list();
  }

  async listDeletedPrepaPrograms() {
    return this.repository.listDeleted();
  }

  private async ensurePrepaProgramExists(id: string) {
    const program = await this.repository.findById(id);
    if (!program) {
      throw new NotFoundError("Programa no encontrado.");
    }

    return program;
  }
}
