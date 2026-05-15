import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import { dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import { appPaths, uploadPrefixes } from "../config/paths";
import { createBackendServices } from "../main/container";
import type { IpcChannel, IpcChannelMap } from "../types/ipc";
import { AuthenticationError } from "../utils/errors";

type Handler<K extends IpcChannel> = (input: IpcChannelMap[K]["input"], event: IpcMainInvokeEvent) => Promise<IpcChannelMap[K]["output"]>;

const publicChannels = new Set<IpcChannel>(["auth:status", "auth:setInitialPassword", "auth:login"]);
const authenticatedSenders = new Set<number>();

export function registerIpcHandlers(): void {
  const services = createBackendServices();

  const handlers: { [K in IpcChannel]: Handler<K> } = {
    "auth:status": async (_input, event) => ({
      ...(await services.adminAuthService.getStatus()),
      authenticated: authenticatedSenders.has(event.sender.id)
    }),
    "auth:setInitialPassword": async (input) => {
      const result = await services.adminAuthService.setInitialPassword(input);
      return { id: result.id };
    },
    "auth:updatePassword": async (input) => {
      const result = await services.adminAuthService.updatePassword(input);
      return { id: result.id };
    },
    "auth:login": async (input, event) => {
      const result = await services.adminAuthService.loginAdmin(input);
      authenticatedSenders.add(event.sender.id);
      event.sender.once("destroyed", () => authenticatedSenders.delete(event.sender.id));
      return result;
    },
    "auth:logout": async (_input, event) => {
      authenticatedSenders.delete(event.sender.id);
      return { success: true };
    },
    "auth:verifyPassword": async (input) => services.adminAuthService.verifyPassword(input.password),

    "categories:create": async (input) => services.categoryService.createCategory(input),
    "categories:update": async (input) => services.categoryService.updateCategory(input.id, input.data),
    "categories:delete": async (input) => services.categoryService.deleteCategory(input.id),
    "categories:restore": async (input) => services.categoryService.restoreCategory(input.id),
    "categories:getById": async (input) => services.categoryService.getCategoryById(input.id),
    "categories:list": async () => services.categoryService.listCategories(),
    "categories:listDeleted": async () => services.categoryService.listDeletedCategories(),

    "roles:create": async (input) => services.roleService.createRole(input),
    "roles:update": async (input) => services.roleService.updateRole(input.id, input.data),
    "roles:delete": async (input) => services.roleService.deleteRole(input.id),
    "roles:restore": async (input) => services.roleService.restoreRole(input.id),
    "roles:getById": async (input) => services.roleService.getRoleById(input.id),
    "roles:list": async () => services.roleService.listRoles(),
    "roles:listDeleted": async () => services.roleService.listDeletedRoles(),

    "careers:create": async (input) => services.careerService.createCareer(input),
    "careers:update": async (input) => services.careerService.updateCareer(input.id, input.data),
    "careers:delete": async (input) => services.careerService.deleteCareer(input.id),
    "careers:restore": async (input) => services.careerService.restoreCareer(input.id),
    "careers:getById": async (input) => services.careerService.getCareerById(input.id),
    "careers:list": async () => services.careerService.listCareers(),
    "careers:listDeleted": async () => services.careerService.listDeletedCareers(),

    "prepaPrograms:create": async (input) => services.prepaProgramService.createPrepaProgram(input),
    "prepaPrograms:update": async (input) => services.prepaProgramService.updatePrepaProgram(input.id, input.data),
    "prepaPrograms:delete": async (input) => services.prepaProgramService.deletePrepaProgram(input.id),
    "prepaPrograms:restore": async (input) => services.prepaProgramService.restorePrepaProgram(input.id),
    "prepaPrograms:getById": async (input) => services.prepaProgramService.getPrepaProgramById(input.id),
    "prepaPrograms:list": async () => services.prepaProgramService.listPrepaPrograms(),
    "prepaPrograms:listDeleted": async () => services.prepaProgramService.listDeletedPrepaPrograms(),

    "students:create": async (input) => services.studentService.createStudent(input),
    "students:update": async (input) => services.studentService.updateStudent(input.id, input.data),
    "students:delete": async (input) => services.studentService.deleteStudent(input.id),
    "students:restore": async (input) => services.studentService.restoreStudent(input.id),
    "students:getById": async (input) => services.studentService.getStudentById(input.id),
    "students:list": async () => services.studentService.listStudents(),
    "students:listDeleted": async () => services.studentService.listDeletedStudents(),
    "students:search": async (input) => services.studentService.searchStudents(input),
    "students:exportCsv": async (input) => {
      const rows = await services.studentService.searchStudents(input);
      return exportCsv("estudiantes.csv", [
        ["Nombre", "Matricula", "Nivel", "Generacion", "Email", "Telefono", "Activo"],
        ...rows.map((student) => [
          student.nombre,
          student.matricula,
          student.nivel,
          student.generacion,
          student.email ?? "",
          student.telefono ?? "",
          student.activo ? "Si" : "No"
        ])
      ]);
    },
    "students:pickPhoto": async () => {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "Imagenes", extensions: ["png", "jpg", "jpeg", "webp"] }]
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    "students:savePhoto": async (input) => services.studentService.saveStudentPhoto(input.sourcePath, input.currentPhoto),

    "groups:create": async (input) => services.groupService.createGroup(input),
    "groups:update": async (input) => services.groupService.updateGroup(input.id, input.data),
    "groups:delete": async (input) => services.groupService.deleteGroup(input.id),
    "groups:restore": async (input) => services.groupService.restoreGroup(input.id),
    "groups:getById": async (input) => services.groupService.getGroupById(input.id),
    "groups:list": async () => services.groupService.listGroups(),
    "groups:listDeleted": async () => services.groupService.listDeletedGroups(),
    "groups:search": async (input) => services.groupService.searchGroups(input),
    "groups:exportCsv": async (input) => {
      const rows = await services.groupService.searchGroups(input);
      return exportCsv("grupos.csv", [
        ["Nombre", "Categoria", "Descripcion", "Creado"],
        ...rows.map((group) => {
          const groupWithCategory = group as typeof group & { category?: { name: string } | null };
          return [
            group.nombre,
            groupWithCategory.category?.name ?? "Sin categoria",
            group.descripcion ?? "",
            group.createdAt
          ];
        })
      ]);
    },
    "groups:pickLogo": async () => {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "Imagenes", extensions: ["png", "jpg", "jpeg", "webp"] }]
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    "groups:saveLogo": async (input) => services.groupService.saveGroupLogo(input.sourcePath, input.currentLogo),

    "memberships:add": async (input) => services.studentGroupService.addStudentToGroup(input),
    "memberships:remove": async (input) => services.studentGroupService.removeStudentFromGroup(input),
    "memberships:changeRole": async (input) => services.studentGroupService.changeRole(input),
    "memberships:listGroupsOfStudent": async (input) => services.studentGroupService.listGroupsOfStudent(input.studentId),
    "memberships:listGroupsOfStudents": async (input) => services.studentGroupService.listGroupsOfStudents(input.studentIds),
    "memberships:listStudentsOfGroup": async (input) => services.studentGroupService.listStudentsOfGroup(input.groupId),
    "memberships:historyByStudent": async (input) => services.studentGroupService.getParticipationHistoryByStudent(input.studentId),
    "memberships:historyByGroup": async (input) => services.studentGroupService.getParticipationHistoryByGroup(input.groupId),

    "backup:export": async (input) => services.backupService.exportDatabase(input.destinationFilePath),
    "backup:import": async (input) => services.backupService.importDatabase(input.sourceFilePath),
    "backup:pickExportPath": async () => {
      const result = await dialog.showSaveDialog({
        defaultPath: "grupos-backup.zip",
        filters: [
          { name: "Respaldo completo (ZIP)", extensions: ["zip"] },
          { name: "Solo base de datos SQLite (legacy)", extensions: ["db"] }
        ]
      });
      return result.canceled ? null : (result.filePath ?? null);
    },
    "backup:pickImportPath": async () => {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
          { name: "Respaldos compatibles", extensions: ["zip", "db"] },
          { name: "Respaldo completo (ZIP)", extensions: ["zip"] },
          { name: "Solo base de datos SQLite (legacy)", extensions: ["db"] }
        ]
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },

    "meta:summary": async () => services.metaService.getSummary(),
    "meta:resolveAssetUrl": async (input) => resolveAssetUrl(input.assetPath),
    "meta:resolveDroppedPath": async (input) => resolveDroppedPath(input.candidatePath, input.kind)
  };

  (Object.keys(handlers) as IpcChannel[]).forEach((channel) => {
    ipcMain.handle(channel, async (event, input) => {
      if (!publicChannels.has(channel) && !authenticatedSenders.has(event.sender.id)) {
        throw new AuthenticationError("Sesion requerida.");
      }

      return handlers[channel](input, event);
    });
  });
}

function resolveAssetUrl(assetPath: string | null | undefined): string | null {
  if (!assetPath) {
    return null;
  }

  if (assetPath.startsWith(uploadPrefixes.students)) {
    return pathToFileURL(path.join(appPaths.studentUploadsDir, path.basename(assetPath))).toString();
  }

  if (assetPath.startsWith(uploadPrefixes.groups)) {
    return pathToFileURL(path.join(appPaths.groupUploadsDir, path.basename(assetPath))).toString();
  }

  return null;
}

async function resolveDroppedPath(candidatePath: string, kind: "student" | "group"): Promise<string | null> {
  const normalized = candidatePath.trim();
  if (!normalized) {
    return null;
  }

  const decodedPath = normalized.startsWith("file://")
    ? fileURLToPath(normalized)
    : normalized;

  const extension = path.extname(decodedPath).toLowerCase();
  const allowed = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  if (!allowed.has(extension)) {
    throw new Error("Formato de imagen no permitido.");
  }

  await fs.access(decodedPath);
  return decodedPath;
}

async function exportCsv(defaultPath: string, rows: Array<Array<string | number | boolean | Date | null | undefined>>): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: [{ name: "CSV", extensions: ["csv"] }]
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  const csv = rows
    .map((row) => row.map((cell) => csvCell(cell)).join(","))
    .join("\r\n");
  await fs.writeFile(result.filePath, `\uFEFF${csv}`, "utf8");
  return result.filePath;
}

function csvCell(value: string | number | boolean | Date | null | undefined): string {
  const normalized = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}
