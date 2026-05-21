import type {
  AddStudentToGroupInput,
  AdminLoginInput,
  CareerCreateInput,
  CareerUpdateInput,
  CategoryCreateInput,
  CategoryUpdateInput,
  ChangeMembershipRoleInput,
  GroupCsvExportInput,
  GroupCreateInput,
  GroupSearchFilters,
  PrepaProgramCreateInput,
  PrepaProgramUpdateInput,
  GroupUpdateInput,
  RemoveStudentFromGroupInput,
  RoleCreateInput,
  RoleUpdateInput,
  SetAdminPasswordInput,
  StudentCreateInput,
  StudentCsvExportInput,
  StudentSearchFilters,
  StudentUpdateInput
} from "./domain";

export interface AdminStatus {
  initialized: boolean;
  authenticated: boolean;
}

export interface AppMetaSummary {
  students: number;
  groups: number;
  categories: number;
  roles: number;
  activeMemberships: number;
}

export interface IpcChannelMap {
  "auth:status": { input: void; output: AdminStatus };
  "auth:setInitialPassword": { input: SetAdminPasswordInput; output: { id: string } };
  "auth:updatePassword": { input: SetAdminPasswordInput; output: { id: string } };
  "auth:login": { input: AdminLoginInput; output: { success: boolean; message: string } };
  "auth:logout": { input: void; output: { success: boolean } };
  "auth:verifyPassword": { input: { password: string }; output: boolean };

  "categories:create": { input: CategoryCreateInput; output: unknown };
  "categories:update": { input: { id: string; data: CategoryUpdateInput }; output: unknown };
  "categories:delete": { input: { id: string }; output: unknown };
  "categories:permanentDelete": { input: { id: string }; output: unknown };
  "categories:restore": { input: { id: string }; output: unknown };
  "categories:getById": { input: { id: string }; output: unknown };
  "categories:list": { input: void; output: unknown[] };
  "categories:listDeleted": { input: void; output: unknown[] };

  "roles:create": { input: RoleCreateInput; output: unknown };
  "roles:update": { input: { id: string; data: RoleUpdateInput }; output: unknown };
  "roles:delete": { input: { id: string }; output: unknown };
  "roles:permanentDelete": { input: { id: string }; output: unknown };
  "roles:restore": { input: { id: string }; output: unknown };
  "roles:getById": { input: { id: string }; output: unknown };
  "roles:list": { input: void; output: unknown[] };
  "roles:listDeleted": { input: void; output: unknown[] };

  "careers:create": { input: CareerCreateInput; output: unknown };
  "careers:update": { input: { id: string; data: CareerUpdateInput }; output: unknown };
  "careers:delete": { input: { id: string }; output: unknown };
  "careers:permanentDelete": { input: { id: string }; output: unknown };
  "careers:restore": { input: { id: string }; output: unknown };
  "careers:getById": { input: { id: string }; output: unknown };
  "careers:list": { input: void; output: unknown[] };
  "careers:listDeleted": { input: void; output: unknown[] };

  "prepaPrograms:create": { input: PrepaProgramCreateInput; output: unknown };
  "prepaPrograms:update": { input: { id: string; data: PrepaProgramUpdateInput }; output: unknown };
  "prepaPrograms:delete": { input: { id: string }; output: unknown };
  "prepaPrograms:permanentDelete": { input: { id: string }; output: unknown };
  "prepaPrograms:restore": { input: { id: string }; output: unknown };
  "prepaPrograms:getById": { input: { id: string }; output: unknown };
  "prepaPrograms:list": { input: void; output: unknown[] };
  "prepaPrograms:listDeleted": { input: void; output: unknown[] };

  "students:create": { input: StudentCreateInput; output: unknown };
  "students:update": { input: { id: string; data: StudentUpdateInput }; output: unknown };
  "students:delete": { input: { id: string }; output: unknown };
  "students:permanentDelete": { input: { id: string }; output: unknown };
  "students:restore": { input: { id: string }; output: unknown };
  "students:getById": { input: { id: string }; output: unknown };
  "students:list": { input: void; output: unknown[] };
  "students:listDeleted": { input: void; output: unknown[] };
  "students:search": { input: StudentSearchFilters; output: unknown[] };
  "students:exportCsv": { input: StudentCsvExportInput; output: string | null };
  "students:pickPhoto": { input: void; output: string | null };
  "students:savePhoto": { input: { sourcePath: string; currentPhoto?: string | null }; output: string };

  "groups:create": { input: GroupCreateInput; output: unknown };
  "groups:update": { input: { id: string; data: GroupUpdateInput }; output: unknown };
  "groups:delete": { input: { id: string }; output: unknown };
  "groups:permanentDelete": { input: { id: string }; output: unknown };
  "groups:restore": { input: { id: string }; output: unknown };
  "groups:getById": { input: { id: string }; output: unknown };
  "groups:list": { input: void; output: unknown[] };
  "groups:listDeleted": { input: void; output: unknown[] };
  "groups:search": { input: GroupSearchFilters; output: unknown[] };
  "groups:exportCsv": { input: GroupCsvExportInput; output: string | null };
  "groups:pickLogo": { input: void; output: string | null };
  "groups:saveLogo": { input: { sourcePath: string; currentLogo?: string | null }; output: string };

  "memberships:add": { input: AddStudentToGroupInput; output: unknown };
  "memberships:remove": { input: RemoveStudentFromGroupInput; output: unknown };
  "memberships:changeRole": { input: ChangeMembershipRoleInput; output: unknown };
  "memberships:listGroupsOfStudent": { input: { studentId: string }; output: unknown[] };
  "memberships:listGroupsOfStudents": { input: { studentIds: string[] }; output: unknown[] };
  "memberships:listStudentsOfGroup": { input: { groupId: string }; output: unknown[] };
  "memberships:historyByStudent": { input: { studentId: string }; output: unknown[] };
  "memberships:historyByGroup": { input: { groupId: string }; output: unknown[] };

  "backup:export": { input: { destinationFilePath: string }; output: string };
  "backup:import": { input: { sourceFilePath: string }; output: string };
  "backup:pickExportPath": { input: void; output: string | null };
  "backup:pickImportPath": { input: void; output: string | null };

  "meta:summary": { input: void; output: AppMetaSummary };
  "meta:resolveAssetUrl": { input: { assetPath: string | null | undefined }; output: string | null };
  "meta:resolveDroppedPath": { input: { candidatePath: string; kind: "student" | "group" }; output: string | null };
}

export type IpcChannel = keyof IpcChannelMap;

export interface DesktopApi {
  auth: {
    getStatus(): Promise<AdminStatus>;
    setInitialPassword(input: SetAdminPasswordInput): Promise<{ id: string }>;
    updatePassword(input: SetAdminPasswordInput): Promise<{ id: string }>;
    login(input: AdminLoginInput): Promise<{ success: boolean; message: string }>;
    logout(): Promise<{ success: boolean }>;
    verifyPassword(password: string): Promise<boolean>;
  };
  categories: {
    create(input: CategoryCreateInput): Promise<unknown>;
    update(id: string, data: CategoryUpdateInput): Promise<unknown>;
    remove(id: string): Promise<unknown>;
    permanentDelete(id: string): Promise<unknown>;
    restore(id: string): Promise<unknown>;
    getById(id: string): Promise<unknown>;
    list(): Promise<unknown[]>;
    listDeleted(): Promise<unknown[]>;
  };
  roles: {
    create(input: RoleCreateInput): Promise<unknown>;
    update(id: string, data: RoleUpdateInput): Promise<unknown>;
    remove(id: string): Promise<unknown>;
    permanentDelete(id: string): Promise<unknown>;
    restore(id: string): Promise<unknown>;
    getById(id: string): Promise<unknown>;
    list(): Promise<unknown[]>;
    listDeleted(): Promise<unknown[]>;
  };
  careers: {
    create(input: CareerCreateInput): Promise<unknown>;
    update(id: string, data: CareerUpdateInput): Promise<unknown>;
    remove(id: string): Promise<unknown>;
    permanentDelete(id: string): Promise<unknown>;
    restore(id: string): Promise<unknown>;
    getById(id: string): Promise<unknown>;
    list(): Promise<unknown[]>;
    listDeleted(): Promise<unknown[]>;
  };
  prepaPrograms: {
    create(input: PrepaProgramCreateInput): Promise<unknown>;
    update(id: string, data: PrepaProgramUpdateInput): Promise<unknown>;
    remove(id: string): Promise<unknown>;
    permanentDelete(id: string): Promise<unknown>;
    restore(id: string): Promise<unknown>;
    getById(id: string): Promise<unknown>;
    list(): Promise<unknown[]>;
    listDeleted(): Promise<unknown[]>;
  };
  students: {
    create(input: StudentCreateInput): Promise<unknown>;
    update(id: string, data: StudentUpdateInput): Promise<unknown>;
    remove(id: string): Promise<unknown>;
    permanentDelete(id: string): Promise<unknown>;
    restore(id: string): Promise<unknown>;
    getById(id: string): Promise<unknown>;
    list(): Promise<unknown[]>;
    listDeleted(): Promise<unknown[]>;
    search(filters: StudentSearchFilters): Promise<unknown[]>;
    exportCsv(input: StudentCsvExportInput): Promise<string | null>;
    pickPhoto(): Promise<string | null>;
    savePhoto(sourcePath: string, currentPhoto?: string | null): Promise<string>;
  };
  groups: {
    create(input: GroupCreateInput): Promise<unknown>;
    update(id: string, data: GroupUpdateInput): Promise<unknown>;
    remove(id: string): Promise<unknown>;
    permanentDelete(id: string): Promise<unknown>;
    restore(id: string): Promise<unknown>;
    getById(id: string): Promise<unknown>;
    list(): Promise<unknown[]>;
    listDeleted(): Promise<unknown[]>;
    search(filters: GroupSearchFilters): Promise<unknown[]>;
    exportCsv(input: GroupCsvExportInput): Promise<string | null>;
    pickLogo(): Promise<string | null>;
    saveLogo(sourcePath: string, currentLogo?: string | null): Promise<string>;
  };
  memberships: {
    add(input: AddStudentToGroupInput): Promise<unknown>;
    remove(input: RemoveStudentFromGroupInput): Promise<unknown>;
    changeRole(input: ChangeMembershipRoleInput): Promise<unknown>;
    listGroupsOfStudent(studentId: string): Promise<unknown[]>;
    listGroupsOfStudents(studentIds: string[]): Promise<unknown[]>;
    listStudentsOfGroup(groupId: string): Promise<unknown[]>;
    historyByStudent(studentId: string): Promise<unknown[]>;
    historyByGroup(groupId: string): Promise<unknown[]>;
  };
  backup: {
    exportDatabase(destinationFilePath: string): Promise<string>;
    importDatabase(sourceFilePath: string): Promise<string>;
    pickExportPath(): Promise<string | null>;
    pickImportPath(): Promise<string | null>;
  };
  meta: {
    getSummary(): Promise<AppMetaSummary>;
    resolveAssetUrl(assetPath?: string | null): Promise<string | null>;
    resolveDroppedPath(candidatePath: string, kind: "student" | "group"): Promise<string | null>;
    getPathForFile(file: unknown): string | null;
  };
}
