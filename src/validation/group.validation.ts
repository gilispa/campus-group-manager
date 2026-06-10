import { uploadPrefixes } from "../config/paths";
import type { GroupCreateInput, GroupSearchFilters, GroupUpdateInput } from "../types/domain";
import { assertLocalUploadPath, assertNonEmptyString, assertOptionalString } from "../utils/guards";

export function validateGroupCreate(input: GroupCreateInput): GroupCreateInput {
  return {
    ...input,
    nombre: assertNonEmptyString(input.nombre, "El nombre del grupo"),
    giroId: assertNonEmptyString(input.giroId, "El giro del grupo"),
    portfolioId: assertNonEmptyString(input.portfolioId, "El portafolio del grupo"),
    descripcion: assertOptionalString(input.descripcion),
    logo: assertLocalUploadPath(input.logo, uploadPrefixes.groups, "El logo")
  };
}

export function validateGroupUpdate(input: GroupUpdateInput): GroupUpdateInput {
  return {
    ...input,
    ...(input.nombre !== undefined ? { nombre: assertNonEmptyString(input.nombre, "El nombre del grupo") } : {}),
    ...(input.giroId !== undefined
      ? { giroId: assertNonEmptyString(input.giroId, "El giro del grupo") }
      : {}),
    ...(input.portfolioId !== undefined
      ? { portfolioId: assertNonEmptyString(input.portfolioId, "El portafolio del grupo") }
      : {}),
    ...(input.descripcion !== undefined ? { descripcion: assertOptionalString(input.descripcion) } : {}),
    ...(input.logo !== undefined ? { logo: assertLocalUploadPath(input.logo, uploadPrefixes.groups, "El logo") } : {})
  };
}

export function validateGroupSearchFilters(filters: GroupSearchFilters): GroupSearchFilters {
  return {
    ...(filters.nombre ? { nombre: filters.nombre.trim() } : {}),
    ...(filters.giroId ? { giroId: filters.giroId.trim() } : {}),
    ...(filters.giroIds ? { giroIds: normalizeStringList(filters.giroIds) } : {}),
    ...(filters.portfolioId ? { portfolioId: filters.portfolioId.trim() } : {}),
    ...(filters.portfolioIds ? { portfolioIds: normalizeStringList(filters.portfolioIds) } : {}),
    ...(filters.groupIds ? { groupIds: normalizeStringList(filters.groupIds) } : {}),
    ...(filters.roleIds ? { roleIds: normalizeStringList(filters.roleIds) } : {}),
    ...(filters.studentLevel ? { studentLevel: filters.studentLevel } : {}),
    ...(filters.participationStatus ? { participationStatus: filters.participationStatus } : {}),
    ...(filters.giroName ? { giroName: filters.giroName.trim() } : {}),
    ...(filters.portfolioName ? { portfolioName: filters.portfolioName.trim() } : {})
  };
}

function normalizeStringList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}
