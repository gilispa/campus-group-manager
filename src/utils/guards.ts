import { ValidationError } from "./errors";

export function assertNonEmptyString(value: string | undefined | null, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new ValidationError(`${field} es requerido.`);
  }

  return normalized;
}

export function assertOptionalString(value: string | undefined | null): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function assertPositiveYear(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1900 || value > 3000) {
    throw new ValidationError(`${field} debe ser un anio valido.`);
  }

  return value;
}

export function assertPasswordStrength(password: string): string {
  if (password.trim().length < 8) {
    throw new ValidationError("La contrasena debe tener al menos 8 caracteres.");
  }

  return password;
}

export function assertLocalUploadPath(
  value: string | null | undefined,
  allowedPrefix: string,
  field: string
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (!normalized.startsWith(allowedPrefix)) {
    throw new ValidationError(`${field} debe usar una ruta local que inicie con ${allowedPrefix}`);
  }

  return normalized;
}
