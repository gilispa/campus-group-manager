import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { appPaths, uploadPrefixes } from "../config/paths";
import { getPrismaClient } from "../database/prisma";
import { CategoryRepository } from "../repositories/category.repository";
import { GroupRepository } from "../repositories/group.repository";
import { PortfolioRepository } from "../repositories/portfolio.repository";
import type { GroupCreateInput, GroupSearchFilters, GroupUpdateInput } from "../types/domain";
import { ConflictError, NotFoundError } from "../utils/errors";
import { validateGroupCreate, validateGroupSearchFilters, validateGroupUpdate } from "../validation/group.validation";

export class GroupService {
  private readonly prisma = getPrismaClient();
  private readonly repository = new GroupRepository(this.prisma);
  private readonly categoryRepository = new CategoryRepository(this.prisma);
  private readonly portfolioRepository = new PortfolioRepository(this.prisma);

  async createGroup(input: GroupCreateInput) {
    const data = validateGroupCreate(input);
    if (data.giroId) {
      await this.ensureGiroExists(data.giroId);
    }
    if (data.portfolioId) {
      await this.ensurePortfolioExists(data.portfolioId);
    }
    await this.ensureGroupNameIsUnique(data.nombre);
    return this.repository.create(data);
  }

  async updateGroup(id: string, input: GroupUpdateInput) {
    const current = await this.ensureGroupExists(id);
    const data = validateGroupUpdate(input);

    if (data.giroId) {
      await this.ensureGiroExists(data.giroId);
    }
    if (data.portfolioId) {
      await this.ensurePortfolioExists(data.portfolioId);
    }

    if (data.nombre && data.nombre !== current.nombre) {
      await this.ensureGroupNameIsUnique(data.nombre, id);
    }

    return this.repository.update(id, data);
  }

  async deleteGroup(id: string) {
    await this.ensureGroupExists(id);
    return this.repository.delete(id);
  }

  async restoreGroup(id: string) {
    const deletedGroup = await this.repository.findDeletedById(id);
    if (!deletedGroup) {
      throw new NotFoundError("El grupo no esta en la papelera.");
    }

    await this.ensureGroupNameIsUnique(deletedGroup.nombre, id);
    return this.repository.restore(id);
  }

  async permanentlyDeleteGroup(id: string) {
    try {
      const deletedGroup = await this.repository.permanentDelete(id);
      await this.removeStoredGroupLogo(deletedGroup.logo);
      return deletedGroup;
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND_OR_NOT_DELETED") {
        throw new NotFoundError("El grupo no esta en la papelera.");
      }
      throw error;
    }
  }

  async getGroupById(id: string) {
    return this.ensureGroupExists(id);
  }

  async listGroups() {
    return this.repository.list();
  }

  async listDeletedGroups() {
    return this.repository.listDeleted();
  }

  async searchGroups(filters: GroupSearchFilters) {
    const normalized = validateGroupSearchFilters(filters);
    return this.repository.search(normalized);
  }

  async saveGroupLogo(sourcePath: string, currentLogo?: string | null): Promise<string> {
    const extension = path.extname(sourcePath).toLowerCase();
    const allowed = new Set([".png", ".jpg", ".jpeg", ".webp"]);
    if (!allowed.has(extension)) {
      throw new ConflictError("Formato de imagen no permitido.");
    }

    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const destination = path.join(appPaths.groupUploadsDir, fileName);
    await fs.copyFile(sourcePath, destination);

    if (currentLogo && currentLogo.startsWith(uploadPrefixes.groups)) {
      const previousFile = path.basename(currentLogo);
      const previousPath = path.join(appPaths.groupUploadsDir, previousFile);
      if (previousPath !== destination) {
        await fs.rm(previousPath, { force: true });
      }
    }

    return `${uploadPrefixes.groups}${fileName}`;
  }

  private async removeStoredGroupLogo(logoPath?: string | null) {
    if (!logoPath || !logoPath.startsWith(uploadPrefixes.groups)) {
      return;
    }

    const fileName = path.basename(logoPath);
    const absolutePath = path.join(appPaths.groupUploadsDir, fileName);
    await fs.rm(absolutePath, { force: true });
  }

  private async ensureGiroExists(id: string) {
    const giro = await this.categoryRepository.findById(id);
    if (!giro) {
      throw new NotFoundError("Giro no encontrado.");
    }

    return giro;
  }

  private async ensurePortfolioExists(id: string) {
    const portfolio = await this.portfolioRepository.findById(id);
    if (!portfolio) {
      throw new NotFoundError("Portafolio no encontrado.");
    }

    return portfolio;
  }

  private async ensureGroupExists(id: string) {
    const group = await this.repository.findById(id);
    if (!group) {
      throw new NotFoundError("Grupo no encontrado.");
    }

    return group;
  }

  private async ensureGroupNameIsUnique(nombre: string, excludeId?: string) {
    const duplicate = await this.repository.findByName(nombre, excludeId);
    if (duplicate) {
      throw new ConflictError("Ya existe un grupo con ese nombre.");
    }
  }
}
