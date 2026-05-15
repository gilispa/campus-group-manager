import bcrypt from "bcrypt";
import { getPrismaClient } from "../database/prisma";
import { AdminRepository } from "../repositories/admin.repository";
import type { AdminLoginInput, SetAdminPasswordInput } from "../types/domain";
import { AuthenticationError, ConflictError, NotFoundError } from "../utils/errors";
import { validateAdminLogin, validateInitialPassword } from "../validation/admin.validation";

const BCRYPT_ROUNDS = 12;

export class AdminAuthService {
  private readonly repository = new AdminRepository(getPrismaClient());

  async setInitialPassword(input: SetAdminPasswordInput) {
    const { password } = validateInitialPassword(input);
    const existing = await this.repository.getAdminSettings();
    if (existing) {
      throw new ConflictError("La contrasena inicial ya fue configurada. Usa updatePassword si necesitas cambiarla.");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return this.repository.createPasswordHash(passwordHash);
  }

  async updatePassword(input: SetAdminPasswordInput) {
    const { password } = validateInitialPassword(input);
    const existing = await this.repository.getAdminSettings();
    if (!existing) {
      throw new NotFoundError("El admin aun no tiene contrasena configurada.");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return this.repository.updatePasswordHash(existing.id, passwordHash);
  }

  async loginAdmin(input: AdminLoginInput) {
    const { password } = validateAdminLogin(input);
    const existing = await this.repository.getAdminSettings();
    if (!existing) {
      throw new NotFoundError("No existe una contrasena inicial configurada para el admin.");
    }

    const isValid = await bcrypt.compare(password, existing.passwordHash);
    if (!isValid) {
      throw new AuthenticationError("Contrasena incorrecta.");
    }

    return {
      success: true,
      message: "Login correcto."
    };
  }

  async verifyPassword(password: string) {
    const existing = await this.repository.getAdminSettings();
    if (!existing) {
      return false;
    }

    return bcrypt.compare(password, existing.passwordHash);
  }

  async getStatus() {
    const existing = await this.repository.getAdminSettings();
    return {
      initialized: Boolean(existing)
    };
  }
}
