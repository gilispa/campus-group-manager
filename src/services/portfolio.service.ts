import { getPrismaClient } from "../database/prisma";
import { PortfolioRepository } from "../repositories/portfolio.repository";
import type { PortfolioCreateInput, PortfolioUpdateInput } from "../types/domain";
import { ConflictError, NotFoundError } from "../utils/errors";
import { validatePortfolioCreate, validatePortfolioUpdate } from "../validation/common.validation";

export class PortfolioService {
  private readonly repository = new PortfolioRepository(getPrismaClient());

  async createPortfolio(input: PortfolioCreateInput) {
    const data = validatePortfolioCreate(input);

    try {
      return await this.repository.create(data);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("Ya existe un portafolio con ese nombre.");
      }

      throw error;
    }
  }

  async updatePortfolio(id: string, input: PortfolioUpdateInput) {
    await this.ensurePortfolioExists(id);
    const data = validatePortfolioUpdate(input);

    try {
      return await this.repository.update(id, data);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("Ya existe un portafolio con ese nombre.");
      }

      throw error;
    }
  }

  async deletePortfolio(id: string) {
    await this.ensurePortfolioExists(id);
    return this.repository.delete(id);
  }

  async restorePortfolio(id: string) {
    return this.repository.restore(id);
  }

  async permanentlyDeletePortfolio(id: string) {
    try {
      return await this.repository.permanentDelete(id);
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND_OR_NOT_DELETED") {
        throw new NotFoundError("El portafolio no esta en la papelera.");
      }
      throw error;
    }
  }

  async getPortfolioById(id: string) {
    return this.ensurePortfolioExists(id);
  }

  async listPortfolios() {
    return this.repository.list();
  }

  async listDeletedPortfolios() {
    return this.repository.listDeleted();
  }

  private async ensurePortfolioExists(id: string) {
    const portfolio = await this.repository.findById(id);
    if (!portfolio) {
      throw new NotFoundError("Portafolio no encontrado.");
    }

    return portfolio;
  }
}
