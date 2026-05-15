import type { AdminLoginInput, SetAdminPasswordInput } from "../types/domain";
import { assertPasswordStrength } from "../utils/guards";

export function validateInitialPassword(input: SetAdminPasswordInput): SetAdminPasswordInput {
  return { password: assertPasswordStrength(input.password) };
}

export function validateAdminLogin(input: AdminLoginInput): AdminLoginInput {
  return { password: assertPasswordStrength(input.password) };
}
