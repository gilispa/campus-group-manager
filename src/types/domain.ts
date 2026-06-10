import { Prisma, StudentLevel as PrismaStudentLevel } from "@prisma/client";

export const StudentLevel = PrismaStudentLevel;

export type Student = Prisma.StudentGetPayload<{
  include: {
    career: true;
    prepaProgram: true;
  };
}>;
export type Group = Prisma.GroupGetPayload<Record<string, never>>;
export type Giro = Prisma.GiroGetPayload<Record<string, never>>;
export type Category = Giro;
export type Portfolio = Prisma.PortfolioGetPayload<Record<string, never>>;
export type Role = Prisma.RoleGetPayload<Record<string, never>>;
export type Career = Prisma.CareerGetPayload<Record<string, never>>;
export type PrepaProgram = Prisma.PrepaProgramGetPayload<Record<string, never>>;
export type StudentGroup = Prisma.StudentGroupGetPayload<Record<string, never>>;
export type GroupManagementCycle = Prisma.GroupManagementCycleGetPayload<Record<string, never>>;
export type PendingMembership = Prisma.PendingMembershipGetPayload<Record<string, never>>;
export type AdminSettings = Prisma.AdminSettingsGetPayload<Record<string, never>>;
export type StudentLevel = (typeof PrismaStudentLevel)[keyof typeof PrismaStudentLevel];
export type PendingMembershipStatus = "PENDING" | "RESOLVED" | "CANCELLED";

export interface StudentCreateInput {
  nombre: string;
  matricula: string;
  nivel: StudentLevel;
  careerId?: string | null | undefined;
  prepaProgramId?: string | null | undefined;
  generacion?: number | null | undefined;
  academicPending?: boolean;
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
  generacion?: number | null | undefined;
  academicPending?: boolean;
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
  giroIds?: string[];
  portfolioIds?: string[];
  participationStatus?: ParticipationExportScope;
  activo?: boolean;
}

export interface GroupCreateInput {
  nombre: string;
  descripcion?: string | null | undefined;
  logo?: string | null | undefined;
  giroId?: string | null | undefined;
  portfolioId?: string | null | undefined;
}

export interface GroupUpdateInput {
  nombre?: string;
  descripcion?: string | null | undefined;
  logo?: string | null | undefined;
  giroId?: string | null | undefined;
  portfolioId?: string | null | undefined;
}

export interface GroupSearchFilters {
  nombre?: string;
  giroId?: string;
  giroIds?: string[];
  portfolioId?: string;
  portfolioIds?: string[];
  groupIds?: string[];
  roleIds?: string[];
  studentLevel?: StudentLevel;
  participationStatus?: ParticipationExportScope;
  giroName?: string;
  portfolioName?: string;
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
  | "giro"
  | "portfolio"
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

export interface MembershipCsvExportInput {
  participationStatus?: ParticipationExportScope;
  groupIds?: string[];
  studentIds?: string[];
  roleIds?: string[];
}

export interface ParticipationCsvImportRow {
  matricula: string;
  groupName: string;
  roleName?: string | null;
  joinedAt?: Date | string | null;
  leftAt?: Date | string | null;
  active?: boolean | null;
}

export interface GroupManagementTemplateInput {
  groupId: string;
}

export interface GroupManagementImportPreviewInput {
  groupId: string;
}

export interface GroupManagementPreviewRow {
  lineNumber: number;
  matricula: string;
  nombre: string | null;
  roleName: string | null;
  status: "ready" | "pending" | "error";
  message: string;
}

export interface GroupManagementPreview {
  filePath: string | null;
  rows: GroupManagementPreviewRow[];
  ready: number;
  pending: number;
  errors: number;
}

export interface ApplyGroupManagementInput {
  groupId: string;
  filePath: string;
  label?: string | null;
  effectiveAt?: Date | string | null;
}

export interface GroupManagementApplyResult {
  archived: number;
  created: number;
  pending: number;
  failed: number;
  errors: string[];
}

export interface PendingMembershipSearchFilters {
  groupId?: string;
  status?: PendingMembershipStatus;
}

export interface GraduateStudentsInput {
  level: StudentLevel;
  studentIds: string[];
  prepaContinuingStudentIds?: string[];
}

export interface GraduateStudentsResult {
  graduated: number;
  transitioned: number;
  deactivatedMemberships: number;
}

export type ReportExportKind =
  | "participations"
  | "studentsWithoutActiveGroup"
  | "groupsWithoutLeader"
  | "groupsWithLowMembership"
  | "emptyCategories"
  | "unusedRoles"
  | "inactiveStudentsWithActiveMembership"
  | "groupSummary";

export interface ReportCsvExportInput {
  kind: ReportExportKind;
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

export type GiroCreateInput = CategoryCreateInput;
export type GiroUpdateInput = CategoryUpdateInput;

export interface PortfolioCreateInput {
  name: string;
  description?: string | null | undefined;
}

export interface PortfolioUpdateInput {
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
  managementCycleId?: string | null;
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

export interface UpdateAdminPasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthResult {
  success: boolean;
  message: string;
}

export interface StudentParticipationRecord extends StudentGroup {
  group: Group & { giro: Giro | null; portfolio: Portfolio | null };
  role: Role | null;
}

export interface GroupParticipationRecord extends StudentGroup {
  student: Student;
  role: Role | null;
}

export interface OperationalSummary {
  studentsWithoutActiveGroup: number;
  groupsWithoutLeader: number;
  groupsWithLowMembership: number;
  emptyCategories: number;
  unusedRoles: number;
  inactiveStudentsWithActiveMembership: number;
  studentAlerts: Array<{ id: string; nombre: string; matricula: string }>;
  groupsWithoutLeaderRows: Array<{ id: string; nombre: string; activeMembers: number }>;
  groupsWithLowMembershipRows: Array<{ id: string; nombre: string; activeMembers: number }>;
  emptyCategoryRows: Array<{ id: string; name: string }>;
  unusedRoleRows: Array<{ id: string; name: string }>;
  inactiveStudentRows: Array<{ id: string; nombre: string; matricula: string }>;
}

export interface DashboardSegmentSummary {
  students: number;
  groups: number;
  studentsInGroups: number;
  studentsWithoutGroup: number;
}

export interface DashboardSummary {
  general: DashboardSegmentSummary;
  prepa: DashboardSegmentSummary;
  profesional: DashboardSegmentSummary;
}
