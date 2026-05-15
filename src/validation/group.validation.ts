import { uploadPrefixes } from "../config/paths";
import type { GroupCreateInput, GroupSearchFilters, GroupUpdateInput } from "../types/domain";
import { assertLocalUploadPath, assertNonEmptyString, assertOptionalString } from "../utils/guards";

export function validateGroupCreate(input: GroupCreateInput): GroupCreateInput {
  return {
    ...input,
    nombre: assertNonEmptyString(input.nombre, "El nombre del grupo"),
    categoryId: assertNonEmptyString(input.categoryId, "La categoria del grupo"),
    descripcion: assertOptionalString(input.descripcion),
    logo: assertLocalUploadPath(input.logo, uploadPrefixes.groups, "El logo")
  };
}

export function validateGroupUpdate(input: GroupUpdateInput): GroupUpdateInput {
  return {
    ...input,
    ...(input.nombre !== undefined ? { nombre: assertNonEmptyString(input.nombre, "El nombre del grupo") } : {}),
    ...(input.categoryId !== undefined
      ? { categoryId: assertNonEmptyString(input.categoryId, "La categoria del grupo") }
      : {}),
    ...(input.descripcion !== undefined ? { descripcion: assertOptionalString(input.descripcion) } : {}),
    ...(input.logo !== undefined ? { logo: assertLocalUploadPath(input.logo, uploadPrefixes.groups, "El logo") } : {})
  };
}

export function validateGroupSearchFilters(filters: GroupSearchFilters): GroupSearchFilters {
  return {
    ...(filters.nombre ? { nombre: filters.nombre.trim() } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId.trim() } : {}),
    ...(filters.categoryName ? { categoryName: filters.categoryName.trim() } : {})
  };
}
