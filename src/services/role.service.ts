import { getPrismaClient } from "../database/prisma";
import { RoleRepository } from "../repositories/role.repository";
import type { RoleCreateInput, RoleUpdateInput } from "../types/domain";
import { ConflictError, NotFoundError } from "../utils/errors";
import { validateRoleCreate, validateRoleUpdate } from "../validation/common.validation";

export class RoleService {
  private readonly repository = new RoleRepository(getPrismaClient());

  async createRole(input: RoleCreateInput) {
    const data = validateRoleCreate(input);

    try {
      return await this.repository.create(data);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("Ya existe un rol con ese nombre.");
      }

      throw error;
    }
  }

  async updateRole(id: string, input: RoleUpdateInput) {
    await this.ensureRoleExists(id);
    const data = validateRoleUpdate(input);

    try {
      return await this.repository.update(id, data);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("Ya existe un rol con ese nombre.");
      }

      throw error;
    }
  }

  async deleteRole(id: string) {
    await this.ensureRoleExists(id);
    return this.repository.delete(id);
  }

  async restoreRole(id: string) {
    return this.repository.restore(id);
  }

  async getRoleById(id: string) {
    return this.ensureRoleExists(id);
  }

  async listRoles() {
    return this.repository.list();
  }

  async listDeletedRoles() {
    return this.repository.listDeleted();
  }

  private async ensureRoleExists(id: string) {
    const role = await this.repository.findById(id);
    if (!role) {
      throw new NotFoundError("Rol no encontrado.");
    }

    return role;
  }
}
