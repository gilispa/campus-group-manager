import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, IpcChannel, IpcChannelMap } from "../types/ipc";

function invoke<K extends IpcChannel>(channel: K, input: IpcChannelMap[K]["input"]) {
  return ipcRenderer.invoke(channel, input) as Promise<IpcChannelMap[K]["output"]>;
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
    restore: (id) => invoke("categories:restore", { id }),
    getById: (id) => invoke("categories:getById", { id }),
    list: () => invoke("categories:list", undefined),
    listDeleted: () => invoke("categories:listDeleted", undefined)
  },
  roles: {
    create: (input) => invoke("roles:create", input),
    update: (id, data) => invoke("roles:update", { id, data }),
    remove: (id) => invoke("roles:delete", { id }),
    restore: (id) => invoke("roles:restore", { id }),
    getById: (id) => invoke("roles:getById", { id }),
    list: () => invoke("roles:list", undefined),
    listDeleted: () => invoke("roles:listDeleted", undefined)
  },
  careers: {
    create: (input) => invoke("careers:create", input),
    update: (id, data) => invoke("careers:update", { id, data }),
    remove: (id) => invoke("careers:delete", { id }),
    restore: (id) => invoke("careers:restore", { id }),
    getById: (id) => invoke("careers:getById", { id }),
    list: () => invoke("careers:list", undefined),
    listDeleted: () => invoke("careers:listDeleted", undefined)
  },
  prepaPrograms: {
    create: (input) => invoke("prepaPrograms:create", input),
    update: (id, data) => invoke("prepaPrograms:update", { id, data }),
    remove: (id) => invoke("prepaPrograms:delete", { id }),
    restore: (id) => invoke("prepaPrograms:restore", { id }),
    getById: (id) => invoke("prepaPrograms:getById", { id }),
    list: () => invoke("prepaPrograms:list", undefined),
    listDeleted: () => invoke("prepaPrograms:listDeleted", undefined)
  },
  students: {
    create: (input) => invoke("students:create", input),
    update: (id, data) => invoke("students:update", { id, data }),
    remove: (id) => invoke("students:delete", { id }),
    restore: (id) => invoke("students:restore", { id }),
    getById: (id) => invoke("students:getById", { id }),
    list: () => invoke("students:list", undefined),
    listDeleted: () => invoke("students:listDeleted", undefined),
    search: (filters) => invoke("students:search", filters),
    exportCsv: (filters) => invoke("students:exportCsv", filters),
    pickPhoto: () => invoke("students:pickPhoto", undefined),
    savePhoto: (sourcePath, currentPhoto) =>
      invoke("students:savePhoto", {
        sourcePath,
        ...(currentPhoto !== undefined ? { currentPhoto } : {})
      })
  },
  groups: {
    create: (input) => invoke("groups:create", input),
    update: (id, data) => invoke("groups:update", { id, data }),
    remove: (id) => invoke("groups:delete", { id }),
    restore: (id) => invoke("groups:restore", { id }),
    getById: (id) => invoke("groups:getById", { id }),
    list: () => invoke("groups:list", undefined),
    listDeleted: () => invoke("groups:listDeleted", undefined),
    search: (filters) => invoke("groups:search", filters),
    exportCsv: (filters) => invoke("groups:exportCsv", filters),
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
    historyByGroup: (groupId) => invoke("memberships:historyByGroup", { groupId })
  },
  backup: {
    exportDatabase: (destinationFilePath) => invoke("backup:export", { destinationFilePath }),
    importDatabase: (sourceFilePath) => invoke("backup:import", { sourceFilePath }),
    pickExportPath: () => invoke("backup:pickExportPath", undefined),
    pickImportPath: () => invoke("backup:pickImportPath", undefined)
  },
  meta: {
    getSummary: () => invoke("meta:summary", undefined),
    resolveAssetUrl: (assetPath) => invoke("meta:resolveAssetUrl", { assetPath }),
    resolveDroppedPath: (candidatePath, kind) => invoke("meta:resolveDroppedPath", { candidatePath, kind })
  }
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
