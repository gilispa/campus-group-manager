import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { appPaths, uploadPrefixes } from "../config/paths";
import { getPrismaClient } from "../database/prisma";
import { CategoryRepository } from "../repositories/category.repository";
import { GroupRepository } from "../repositories/group.repository";
import type { GroupCreateInput, GroupSearchFilters, GroupUpdateInput } from "../types/domain";
import { ConflictError, NotFoundError } from "../utils/errors";
import { validateGroupCreate, validateGroupSearchFilters, validateGroupUpdate } from "../validation/group.validation";

export class GroupService {
  private readonly prisma = getPrismaClient();
  private readonly repository = new GroupRepository(this.prisma);
  private readonly categoryRepository = new CategoryRepository(this.prisma);

  async createGroup(input: GroupCreateInput) {
    const data = validateGroupCreate(input);
    if (data.categoryId) {
      await this.ensureCategoryExists(data.categoryId);
    }
    return this.repository.create(data);
  }

  async updateGroup(id: string, input: GroupUpdateInput) {
    await this.ensureGroupExists(id);
    const data = validateGroupUpdate(input);

    if (data.categoryId) {
      await this.ensureCategoryExists(data.categoryId);
    }

    return this.repository.update(id, data);
  }

  async deleteGroup(id: string) {
    await this.ensureGroupExists(id);
    return this.repository.delete(id);
  }

  async restoreGroup(id: string) {
    return this.repository.restore(id);
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

  private async ensureCategoryExists(id: string) {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundError("Categoria no encontrada.");
    }

    return category;
  }

  private async ensureGroupExists(id: string) {
    const group = await this.repository.findById(id);
    if (!group) {
      throw new NotFoundError("Grupo no encontrado.");
    }

    return group;
  }
}
