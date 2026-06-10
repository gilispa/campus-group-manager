import { uploadPrefixes } from "../config/paths";
import { StudentLevel } from "../types/domain";
import type { StudentCreateInput, StudentSearchFilters, StudentUpdateInput, StudentLevel as StudentLevelType } from "../types/domain";
import { assertLocalUploadPath, assertNonEmptyString, assertOptionalString, assertPositiveInteger } from "../utils/guards";
import { ValidationError } from "../utils/errors";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string | undefined | null): string | null | undefined {
  const email = assertOptionalString(value);
  if (email && !emailPattern.test(email)) {
    throw new ValidationError("El email no tiene un formato valido.");
  }

  return email;
}

function normalizeAcademicLinks(
  level: StudentLevelType,
  academicPending: boolean,
  careerId?: string | null,
  prepaProgramId?: string | null
): { careerId: string | null; prepaProgramId: string | null } {
  const normalizedCareerId = assertOptionalString(careerId);
  const normalizedPrepaProgramId = assertOptionalString(prepaProgramId);

  if (level === StudentLevel.PROFESIONAL) {
    if (academicPending) {
      return {
        careerId: normalizedCareerId ?? null,
        prepaProgramId: null
      };
    }

    if (!normalizedCareerId) {
      throw new ValidationError("La carrera es requerida para estudiantes de nivel PROFESIONAL.");
    }

    return {
      careerId: normalizedCareerId,
      prepaProgramId: null
    };
  }

  if (!normalizedPrepaProgramId) {
    throw new ValidationError("El programa es requerido para estudiantes de nivel PREPA.");
  }

  return {
    careerId: null,
    prepaProgramId: normalizedPrepaProgramId
  };
}

function normalizeGeneration(value: number | null | undefined, academicPending: boolean): number | null {
  if (value === null || value === undefined) {
    if (academicPending) {
      return null;
    }

    throw new ValidationError("La generacion es requerida.");
  }

  return assertPositiveInteger(value, "La generacion");
}

export function validateStudentCreate(input: StudentCreateInput): StudentCreateInput {
  const nombre = assertNonEmptyString(input.nombre, "El nombre");
  const matricula = assertNonEmptyString(input.matricula, "La matricula");
  const academicPending = input.academicPending ?? false;
  const generacion = normalizeGeneration(input.generacion, academicPending);
  const academicLinks = normalizeAcademicLinks(input.nivel, academicPending, input.careerId, input.prepaProgramId);
  const foto = assertLocalUploadPath(input.foto, uploadPrefixes.students, "La foto");

  return {
    ...input,
    nombre,
    matricula,
    generacion,
    academicPending,
    ...academicLinks,
    foto,
    telefono: assertOptionalString(input.telefono),
    email: normalizeEmail(input.email),
    notas: assertOptionalString(input.notas)
  };
}

export function validateStudentUpdate(
  current: { nivel: StudentLevelType; careerId: string | null; prepaProgramId: string | null; academicPending: boolean },
  input: StudentUpdateInput
): StudentUpdateInput {
  const nextLevel = input.nivel ?? current.nivel;
  const nextCareerId = input.careerId !== undefined ? input.careerId : current.careerId;
  const nextPrepaProgramId = input.prepaProgramId !== undefined ? input.prepaProgramId : current.prepaProgramId;
  const nextAcademicPending = input.academicPending ?? current.academicPending;
  const academicLinks = normalizeAcademicLinks(nextLevel, nextAcademicPending, nextCareerId, nextPrepaProgramId);

  return {
    ...input,
    ...(input.nombre !== undefined ? { nombre: assertNonEmptyString(input.nombre, "El nombre") } : {}),
    ...(input.matricula !== undefined ? { matricula: assertNonEmptyString(input.matricula, "La matricula") } : {}),
    ...(input.generacion !== undefined ? { generacion: normalizeGeneration(input.generacion, nextAcademicPending) } : {}),
    ...(input.academicPending !== undefined ? { academicPending: nextAcademicPending } : {}),
    ...(input.foto !== undefined
      ? { foto: assertLocalUploadPath(input.foto, uploadPrefixes.students, "La foto") }
      : {}),
    ...(input.telefono !== undefined ? { telefono: assertOptionalString(input.telefono) } : {}),
    ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
    ...(input.notas !== undefined ? { notas: assertOptionalString(input.notas) } : {}),
    ...academicLinks
  };
}

export function validateStudentSearchFilters(filters: StudentSearchFilters): StudentSearchFilters {
  return {
    ...(filters.studentIds ? { studentIds: normalizeStringList(filters.studentIds) } : {}),
    ...(filters.nombre ? { nombre: filters.nombre.trim() } : {}),
    ...(filters.matricula ? { matricula: filters.matricula.trim() } : {}),
    ...(filters.careerId ? { careerId: filters.careerId.trim() } : {}),
    ...(filters.prepaProgramId ? { prepaProgramId: filters.prepaProgramId.trim() } : {}),
    ...(filters.generacion !== undefined ? { generacion: assertPositiveInteger(filters.generacion, "La generacion") } : {}),
    ...(filters.nivel ? { nivel: filters.nivel } : {}),
    ...(filters.roleId ? { roleId: filters.roleId.trim() } : {}),
    ...(filters.roleIds ? { roleIds: normalizeStringList(filters.roleIds) } : {}),
    ...(filters.groupIds ? { groupIds: normalizeStringList(filters.groupIds) } : {}),
    ...(filters.giroIds ? { giroIds: normalizeStringList(filters.giroIds) } : {}),
    ...(filters.portfolioIds ? { portfolioIds: normalizeStringList(filters.portfolioIds) } : {}),
    ...(filters.participationStatus ? { participationStatus: filters.participationStatus } : {}),
    ...(filters.activo !== undefined ? { activo: filters.activo } : {})
  };
}

function normalizeStringList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}
