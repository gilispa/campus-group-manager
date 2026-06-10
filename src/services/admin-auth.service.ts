import bcrypt from "bcrypt";
import { getPrismaClient } from "../database/prisma";
import { AdminRepository } from "../repositories/admin.repository";
import type { AdminLoginInput, SetAdminPasswordInput, UpdateAdminPasswordInput } from "../types/domain";
import { AuthenticationError, ConflictError, NotFoundError } from "../utils/errors";
import { validateAdminLogin, validateInitialPassword } from "../validation/admin.validation";

const BCRYPT_ROUNDS = 12;

export class AdminAuthService {
  private readonly repository = new AdminRepository(getPrismaClient());

  async setInitialPassword(input: SetAdminPasswordInput) {
    const { password } = validateInitialPassword(input);
    const existing = await this.repository.getAdminSettings();
    if (existing) {
      throw new ConflictError("La contraseña inicial ya fue configurada. Usa updatePassword si necesitas cambiarla.");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return this.repository.createPasswordHash(passwordHash);
  }

  async updatePassword(input: UpdateAdminPasswordInput) {
    const { password: currentPassword } = validateAdminLogin({ password: input.currentPassword });
    const { password: newPassword } = validateInitialPassword({ password: input.newPassword });
    const existing = await this.repository.getAdminSettings();
    if (!existing) {
      throw new NotFoundError("El admin aun no tiene contraseña configurada.");
    }

    const isValid = await bcrypt.compare(currentPassword, existing.passwordHash);
    if (!isValid) {
      throw new AuthenticationError("La contraseña anterior es incorrecta.");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    return this.repository.updatePasswordHash(existing.id, passwordHash);
  }

  async loginAdmin(input: AdminLoginInput) {
    const { password } = validateAdminLogin(input);
    const existing = await this.repository.getAdminSettings();
    if (!existing) {
      throw new NotFoundError("No existe una contraseña inicial configurada para el admin.");
    }

    const isValid = await bcrypt.compare(password, existing.passwordHash);
    if (!isValid) {
      throw new AuthenticationError("Contraseña incorrecta.");
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
