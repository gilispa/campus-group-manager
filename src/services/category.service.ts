import { getPrismaClient } from "../database/prisma";
import { CategoryRepository } from "../repositories/category.repository";
import type { CategoryCreateInput, CategoryUpdateInput } from "../types/domain";
import { ConflictError, NotFoundError } from "../utils/errors";
import { validateCategoryCreate, validateCategoryUpdate } from "../validation/common.validation";

export class CategoryService {
  private readonly repository = new CategoryRepository(getPrismaClient());

  async createCategory(input: CategoryCreateInput) {
    const data = validateCategoryCreate(input);

    try {
      return await this.repository.create(data);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("Ya existe una categoria con ese nombre.");
      }

      throw error;
    }
  }

  async updateCategory(id: string, input: CategoryUpdateInput) {
    await this.ensureCategoryExists(id);
    const data = validateCategoryUpdate(input);

    try {
      return await this.repository.update(id, data);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("Ya existe una categoria con ese nombre.");
      }

      throw error;
    }
  }

  async deleteCategory(id: string) {
    await this.ensureCategoryExists(id);
    return this.repository.delete(id);
  }

  async restoreCategory(id: string) {
    return this.repository.restore(id);
  }

  async getCategoryById(id: string) {
    return this.ensureCategoryExists(id);
  }

  async listCategories() {
    return this.repository.list();
  }

  async listDeletedCategories() {
    return this.repository.listDeleted();
  }

  private async ensureCategoryExists(id: string) {
    const category = await this.repository.findById(id);
    if (!category) {
      throw new NotFoundError("Categoria no encontrada.");
    }

    return category;
  }
}
