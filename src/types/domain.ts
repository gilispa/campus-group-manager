import { Prisma, StudentLevel as PrismaStudentLevel } from "@prisma/client";

export const StudentLevel = PrismaStudentLevel;

export type Student = Prisma.StudentGetPayload<{
  include: {
    career: true;
    prepaProgram: true;
  };
}>;
export type Group = Prisma.GroupGetPayload<Record<string, never>>;
export type Category = Prisma.CategoryGetPayload<Record<string, never>>;
export type Role = Prisma.RoleGetPayload<Record<string, never>>;
export type Career = Prisma.CareerGetPayload<Record<string, never>>;
export type PrepaProgram = Prisma.PrepaProgramGetPayload<Record<string, never>>;
export type StudentGroup = Prisma.StudentGroupGetPayload<Record<string, never>>;
export type AdminSettings = Prisma.AdminSettingsGetPayload<Record<string, never>>;
export type StudentLevel = (typeof PrismaStudentLevel)[keyof typeof PrismaStudentLevel];

export interface StudentCreateInput {
  nombre: string;
  matricula: string;
  nivel: StudentLevel;
  careerId?: string | null | undefined;
  prepaProgramId?: string | null | undefined;
  generacion: number;
  foto?: string | null | undefined;
  telefono?: string | null | undefined;
  email?: string | null | undefined;
  notas?: string | null | undefined;
  activo?: boolean;
}

export interface StudentUpdateInput {
  nombre?: string;
  matricula?: string;
  nivel?: StudentLevel;
  careerId?: string | null | undefined;
  prepaProgramId?: string | null | undefined;
  generacion?: number;
  foto?: string | null | undefined;
  telefono?: string | null | undefined;
  email?: string | null | undefined;
  notas?: string | null | undefined;
  activo?: boolean;
}

export interface StudentSearchFilters {
  studentIds?: string[];
  nombre?: string;
  matricula?: string;
  careerId?: string;
  prepaProgramId?: string;
  generacion?: number;
  nivel?: StudentLevel;
  roleId?: string;
  roleIds?: string[];
  groupIds?: string[];
  categoryIds?: string[];
  participationStatus?: ParticipationExportScope;
  activo?: boolean;
}

export interface GroupCreateInput {
  nombre: string;
  descripcion?: string | null | undefined;
  logo?: string | null | undefined;
  categoryId?: string | null | undefined;
}

export interface GroupUpdateInput {
  nombre?: string;
  descripcion?: string | null | undefined;
  logo?: string | null | undefined;
  categoryId?: string | null | undefined;
}

export interface GroupSearchFilters {
  nombre?: string;
  categoryId?: string;
  categoryIds?: string[];
  groupIds?: string[];
  roleIds?: string[];
  studentLevel?: StudentLevel;
  participationStatus?: ParticipationExportScope;
  categoryName?: string;
}

export type ParticipationExportScope = "active" | "all";

export type StudentExportColumn =
  | "nombre"
  | "matricula"
  | "nivel"
  | "career"
  | "prepaProgram"
  | "generacion"
  | "email"
  | "telefono"
  | "notas"
  | "activo"
  | "activeGroups"
  | "activeRoles"
  | "activeGroupCount"
  | "createdAt"
  | "updatedAt";

export type GroupExportColumn =
  | "nombre"
  | "category"
  | "descripcion"
  | "activeStudents"
  | "activeMatriculas"
  | "activeEmails"
  | "activeRoles"
  | "activeStudentCount"
  | "createdAt"
  | "updatedAt";

export interface StudentCsvExportInput {
  filters: StudentSearchFilters;
  columns: StudentExportColumn[];
}

export interface GroupCsvExportInput {
  filters: GroupSearchFilters;
  columns: GroupExportColumn[];
}

export interface BulkImportResult {
  created: number;
  failed: number;
  errors: string[];
}

export interface CategoryCreateInput {
  name: string;
  description?: string | null | undefined;
}

export interface CategoryUpdateInput {
  name?: string;
  description?: string | null | undefined;
}

export interface RoleCreateInput {
  name: string;
  description?: string | null | undefined;
}

export interface RoleUpdateInput {
  name?: string;
  description?: string | null | undefined;
}

export interface CareerCreateInput {
  name: string;
  description?: string | null | undefined;
}

export interface CareerUpdateInput {
  name?: string;
  description?: string | null | undefined;
}

export interface PrepaProgramCreateInput {
  name: string;
  description?: string | null | undefined;
}

export interface PrepaProgramUpdateInput {
  name?: string;
  description?: string | null | undefined;
}

export interface AddStudentToGroupInput {
  studentId: string;
  groupId: string;
  roleId?: string | null;
  joinedAt?: Date;
}

export interface RemoveStudentFromGroupInput {
  studentId: string;
  groupId: string;
  leftAt?: Date;
}

export interface ChangeMembershipRoleInput {
  studentId: string;
  groupId: string;
  roleId?: string | null;
}

export interface AdminLoginInput {
  password: string;
}

export interface SetAdminPasswordInput {
  password: string;
}

export interface AuthResult {
  success: boolean;
  message: string;
}

export interface StudentParticipationRecord extends StudentGroup {
  group: Group & { category: Category | null };
  role: Role | null;
}

export interface GroupParticipationRecord extends StudentGroup {
  student: Student;
  role: Role | null;
}
