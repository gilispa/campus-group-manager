import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { DesktopApi, IpcChannel, IpcChannelMap } from "../types/ipc";

async function invoke<K extends IpcChannel>(channel: K, input: IpcChannelMap[K]["input"]) {
  try {
    return await ipcRenderer.invoke(channel, input) as IpcChannelMap[K]["output"];
  } catch (error) {
    throw new Error(cleanIpcErrorMessage(error));
  }
}

function cleanIpcErrorMessage(error: unknown): string {
  const rawMessage = error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : "Ocurrio un error inesperado.";

  return rawMessage
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^(?:(?:[A-Z][A-Za-z]*Error|Error):\s*)+/, "")
    .trim();
}

const desktopApi: DesktopApi = {
  auth: {
    getStatus: () => invoke("auth:status", undefined),
    setInitialPassword: (input) => invoke("auth:setInitialPassword", input),
    updatePassword: (input) => invoke("auth:updatePassword", input),
    login: (input) => invoke("auth:login", input),
    logout: () => invoke("auth:logout", undefined),
    verifyPassword: (password) => invoke("auth:verifyPassword", { password })
  },
  categories: {
    create: (input) => invoke("categories:create", input),
    update: (id, data) => invoke("categories:update", { id, data }),
    remove: (id) => invoke("categories:delete", { id }),
    permanentDelete: (id) => invoke("categories:permanentDelete", { id }),
    restore: (id) => invoke("categories:restore", { id }),
    getById: (id) => invoke("categories:getById", { id }),
    list: () => invoke("categories:list", undefined),
    listDeleted: () => invoke("categories:listDeleted", undefined)
  },
  giros: {
    create: (input) => invoke("giros:create", input),
    update: (id, data) => invoke("giros:update", { id, data }),
    remove: (id) => invoke("giros:delete", { id }),
    permanentDelete: (id) => invoke("giros:permanentDelete", { id }),
    restore: (id) => invoke("giros:restore", { id }),
    getById: (id) => invoke("giros:getById", { id }),
    list: () => invoke("giros:list", undefined),
    listDeleted: () => invoke("giros:listDeleted", undefined)
  },
  portfolios: {
    create: (input) => invoke("portfolios:create", input),
    update: (id, data) => invoke("portfolios:update", { id, data }),
    remove: (id) => invoke("portfolios:delete", { id }),
    permanentDelete: (id) => invoke("portfolios:permanentDelete", { id }),
    restore: (id) => invoke("portfolios:restore", { id }),
    getById: (id) => invoke("portfolios:getById", { id }),
    list: () => invoke("portfolios:list", undefined),
    listDeleted: () => invoke("portfolios:listDeleted", undefined)
  },
  roles: {
    create: (input) => invoke("roles:create", input),
    update: (id, data) => invoke("roles:update", { id, data }),
    remove: (id) => invoke("roles:delete", { id }),
    permanentDelete: (id) => invoke("roles:permanentDelete", { id }),
    restore: (id) => invoke("roles:restore", { id }),
    getById: (id) => invoke("roles:getById", { id }),
    list: () => invoke("roles:list", undefined),
    listDeleted: () => invoke("roles:listDeleted", undefined)
  },
  careers: {
    create: (input) => invoke("careers:create", input),
    update: (id, data) => invoke("careers:update", { id, data }),
    remove: (id) => invoke("careers:delete", { id }),
    permanentDelete: (id) => invoke("careers:permanentDelete", { id }),
    restore: (id) => invoke("careers:restore", { id }),
    getById: (id) => invoke("careers:getById", { id }),
    list: () => invoke("careers:list", undefined),
    listDeleted: () => invoke("careers:listDeleted", undefined)
  },
  prepaPrograms: {
    create: (input) => invoke("prepaPrograms:create", input),
    update: (id, data) => invoke("prepaPrograms:update", { id, data }),
    remove: (id) => invoke("prepaPrograms:delete", { id }),
    permanentDelete: (id) => invoke("prepaPrograms:permanentDelete", { id }),
    restore: (id) => invoke("prepaPrograms:restore", { id }),
    getById: (id) => invoke("prepaPrograms:getById", { id }),
    list: () => invoke("prepaPrograms:list", undefined),
    listDeleted: () => invoke("prepaPrograms:listDeleted", undefined)
  },
  students: {
    create: (input) => invoke("students:create", input),
    update: (id, data) => invoke("students:update", { id, data }),
    remove: (id) => invoke("students:delete", { id }),
    permanentDelete: (id) => invoke("students:permanentDelete", { id }),
    restore: (id) => invoke("students:restore", { id }),
    getById: (id) => invoke("students:getById", { id }),
    list: () => invoke("students:list", undefined),
    listDeleted: () => invoke("students:listDeleted", undefined),
    search: (filters) => invoke("students:search", filters),
    exportCsv: (input) => invoke("students:exportCsv", input),
    exportTemplateCsv: () => invoke("students:exportTemplateCsv", undefined),
    importCsv: () => invoke("students:importCsv", undefined),
    pickPhoto: () => invoke("students:pickPhoto", undefined),
    savePhoto: (sourcePath, currentPhoto) =>
      invoke("students:savePhoto", {
        sourcePath,
        ...(currentPhoto !== undefined ? { currentPhoto } : {})
      }),
    graduate: (input) => invoke("students:graduate", input)
  },
  groups: {
    create: (input) => invoke("groups:create", input),
    update: (id, data) => invoke("groups:update", { id, data }),
    remove: (id) => invoke("groups:delete", { id }),
    permanentDelete: (id) => invoke("groups:permanentDelete", { id }),
    restore: (id) => invoke("groups:restore", { id }),
    getById: (id) => invoke("groups:getById", { id }),
    list: () => invoke("groups:list", undefined),
    listDeleted: () => invoke("groups:listDeleted", undefined),
    search: (filters) => invoke("groups:search", filters),
    exportCsv: (input) => invoke("groups:exportCsv", input),
    exportTemplateCsv: () => invoke("groups:exportTemplateCsv", undefined),
    importCsv: () => invoke("groups:importCsv", undefined),
    pickLogo: () => invoke("groups:pickLogo", undefined),
    saveLogo: (sourcePath, currentLogo) =>
      invoke("groups:saveLogo", {
        sourcePath,
        ...(currentLogo !== undefined ? { currentLogo } : {})
      })
  },
  memberships: {
    add: (input) => invoke("memberships:add", input),
    remove: (input) => invoke("memberships:remove", input),
    changeRole: (input) => invoke("memberships:changeRole", input),
    listGroupsOfStudent: (studentId) => invoke("memberships:listGroupsOfStudent", { studentId }),
    listGroupsOfStudents: (studentIds) => invoke("memberships:listGroupsOfStudents", { studentIds }),
    listStudentsOfGroup: (groupId) => invoke("memberships:listStudentsOfGroup", { groupId }),
    historyByStudent: (studentId) => invoke("memberships:historyByStudent", { studentId }),
    historyByGroup: (groupId) => invoke("memberships:historyByGroup", { groupId }),
    exportCsv: (input) => invoke("memberships:exportCsv", input),
    exportTemplateCsv: () => invoke("memberships:exportTemplateCsv", undefined),
    importCsv: () => invoke("memberships:importCsv", undefined)
  },
  groupManagement: {
    exportTemplateXlsx: (groupId) => invoke("groupManagement:exportTemplateXlsx", { groupId }),
    previewImportXlsx: (groupId) => invoke("groupManagement:previewImportXlsx", { groupId }),
    applyImportXlsx: (input) => invoke("groupManagement:applyImportXlsx", input)
  },
  pendingMemberships: {
    list: (filters = {}) => invoke("pendingMemberships:list", filters),
    cancel: (id) => invoke("pendingMemberships:cancel", { id })
  },
  backup: {
    exportDatabase: (destinationFilePath) => invoke("backup:export", { destinationFilePath }),
    importDatabase: (sourceFilePath) => invoke("backup:import", { sourceFilePath }),
    pickExportPath: () => invoke("backup:pickExportPath", undefined),
    pickImportPath: () => invoke("backup:pickImportPath", undefined)
  },
  meta: {
    getSummary: () => invoke("meta:summary", undefined),
    getOperationalSummary: () => invoke("meta:operationalSummary", undefined),
    resolveAssetUrl: (assetPath) => invoke("meta:resolveAssetUrl", { assetPath }),
    resolveDroppedPath: (candidatePath, kind) => invoke("meta:resolveDroppedPath", { candidatePath, kind }),
    getPathForFile: (file) => webUtils.getPathForFile(file as File)
  },
  reports: {
    exportCsv: (input) => invoke("reports:exportCsv", input)
  }
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
