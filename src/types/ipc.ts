import type {
  AddStudentToGroupInput,
  AdminLoginInput,
  ApplyGroupManagementInput,
  BulkImportResult,
  CareerCreateInput,
  CareerUpdateInput,
  CategoryCreateInput,
  CategoryUpdateInput,
  ChangeMembershipRoleInput,
  DashboardSummary,
  GiroCreateInput,
  GiroUpdateInput,
  GraduateStudentsInput,
  GraduateStudentsResult,
  GroupManagementApplyResult,
  GroupManagementImportPreviewInput,
  GroupManagementPreview,
  GroupManagementTemplateInput,
  ReportCsvExportInput,
  GroupCsvExportInput,
  GroupCreateInput,
  GroupSearchFilters,
  MembershipCsvExportInput,
  OperationalSummary,
  PendingMembershipSearchFilters,
  PortfolioCreateInput,
  PortfolioUpdateInput,
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
  StudentUpdateInput,
  UpdateAdminPasswordInput
} from "./domain";

export interface AdminStatus {
  initialized: boolean;
  authenticated: boolean;
}

export type AppMetaSummary = DashboardSummary;

export interface IpcChannelMap {
  "auth:status": { input: void; output: AdminStatus };
  "auth:setInitialPassword": { input: SetAdminPasswordInput; output: { id: string } };
  "auth:updatePassword": { input: UpdateAdminPasswordInput; output: { id: string } };
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

  "giros:create": { input: GiroCreateInput; output: unknown };
  "giros:update": { input: { id: string; data: GiroUpdateInput }; output: unknown };
  "giros:delete": { input: { id: string }; output: unknown };
  "giros:permanentDelete": { input: { id: string }; output: unknown };
  "giros:restore": { input: { id: string }; output: unknown };
  "giros:getById": { input: { id: string }; output: unknown };
  "giros:list": { input: void; output: unknown[] };
  "giros:listDeleted": { input: void; output: unknown[] };

  "portfolios:create": { input: PortfolioCreateInput; output: unknown };
  "portfolios:update": { input: { id: string; data: PortfolioUpdateInput }; output: unknown };
  "portfolios:delete": { input: { id: string }; output: unknown };
  "portfolios:permanentDelete": { input: { id: string }; output: unknown };
  "portfolios:restore": { input: { id: string }; output: unknown };
  "portfolios:getById": { input: { id: string }; output: unknown };
  "portfolios:list": { input: void; output: unknown[] };
  "portfolios:listDeleted": { input: void; output: unknown[] };

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
  "students:exportTemplateCsv": { input: void; output: string | null };
  "students:importCsv": { input: void; output: BulkImportResult };
  "students:pickPhoto": { input: void; output: string | null };
  "students:savePhoto": { input: { sourcePath: string; currentPhoto?: string | null }; output: string };
  "students:graduate": { input: GraduateStudentsInput; output: GraduateStudentsResult };

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
  "groups:exportTemplateCsv": { input: void; output: string | null };
  "groups:importCsv": { input: void; output: BulkImportResult };
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
  "memberships:exportCsv": { input: MembershipCsvExportInput; output: string | null };
  "memberships:exportTemplateCsv": { input: void; output: string | null };
  "memberships:importCsv": { input: void; output: BulkImportResult };

  "groupManagement:exportTemplateXlsx": { input: GroupManagementTemplateInput; output: string | null };
  "groupManagement:previewImportXlsx": { input: GroupManagementImportPreviewInput; output: GroupManagementPreview };
  "groupManagement:applyImportXlsx": { input: ApplyGroupManagementInput; output: GroupManagementApplyResult };

  "pendingMemberships:list": { input: PendingMembershipSearchFilters; output: unknown[] };
  "pendingMemberships:cancel": { input: { id: string }; output: unknown };

  "backup:export": { input: { destinationFilePath: string }; output: string };
  "backup:import": { input: { sourceFilePath: string }; output: string };
  "backup:pickExportPath": { input: void; output: string | null };
  "backup:pickImportPath": { input: void; output: string | null };

  "meta:summary": { input: void; output: AppMetaSummary };
  "meta:operationalSummary": { input: void; output: OperationalSummary };
  "reports:exportCsv": { input: ReportCsvExportInput; output: string | null };
  "meta:resolveAssetUrl": { input: { assetPath: string | null | undefined }; output: string | null };
  "meta:resolveDroppedPath": { input: { candidatePath: string; kind: "student" | "group" }; output: string | null };
}

export type IpcChannel = keyof IpcChannelMap;

export interface DesktopApi {
  auth: {
    getStatus(): Promise<AdminStatus>;
    setInitialPassword(input: SetAdminPasswordInput): Promise<{ id: string }>;
    updatePassword(input: UpdateAdminPasswordInput): Promise<{ id: string }>;
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
  giros: {
    create(input: GiroCreateInput): Promise<unknown>;
    update(id: string, data: GiroUpdateInput): Promise<unknown>;
    remove(id: string): Promise<unknown>;
    permanentDelete(id: string): Promise<unknown>;
    restore(id: string): Promise<unknown>;
    getById(id: string): Promise<unknown>;
    list(): Promise<unknown[]>;
    listDeleted(): Promise<unknown[]>;
  };
  portfolios: {
    create(input: PortfolioCreateInput): Promise<unknown>;
    update(id: string, data: PortfolioUpdateInput): Promise<unknown>;
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
    exportTemplateCsv(): Promise<string | null>;
    importCsv(): Promise<BulkImportResult>;
    pickPhoto(): Promise<string | null>;
    savePhoto(sourcePath: string, currentPhoto?: string | null): Promise<string>;
    graduate(input: GraduateStudentsInput): Promise<GraduateStudentsResult>;
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
    exportTemplateCsv(): Promise<string | null>;
    importCsv(): Promise<BulkImportResult>;
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
    exportCsv(input: MembershipCsvExportInput): Promise<string | null>;
    exportTemplateCsv(): Promise<string | null>;
    importCsv(): Promise<BulkImportResult>;
  };
  groupManagement: {
    exportTemplateXlsx(groupId: string): Promise<string | null>;
    previewImportXlsx(groupId: string): Promise<GroupManagementPreview>;
    applyImportXlsx(input: ApplyGroupManagementInput): Promise<GroupManagementApplyResult>;
  };
  pendingMemberships: {
    list(filters?: PendingMembershipSearchFilters): Promise<unknown[]>;
    cancel(id: string): Promise<unknown>;
  };
  backup: {
    exportDatabase(destinationFilePath: string): Promise<string>;
    importDatabase(sourceFilePath: string): Promise<string>;
    pickExportPath(): Promise<string | null>;
    pickImportPath(): Promise<string | null>;
  };
  meta: {
    getSummary(): Promise<AppMetaSummary>;
    getOperationalSummary(): Promise<OperationalSummary>;
    resolveAssetUrl(assetPath?: string | null): Promise<string | null>;
    resolveDroppedPath(candidatePath: string, kind: "student" | "group"): Promise<string | null>;
    getPathForFile(file: unknown): string | null;
  };
  reports: {
    exportCsv(input: ReportCsvExportInput): Promise<string | null>;
  };
}
