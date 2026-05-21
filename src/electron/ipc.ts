import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import { dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import { appPaths, uploadPrefixes } from "../config/paths";
import { createBackendServices } from "../main/container";
import type { IpcChannel, IpcChannelMap } from "../types/ipc";
import type { GroupExportColumn, StudentExportColumn } from "../types/domain";
import { AuthenticationError } from "../utils/errors";

type Handler<K extends IpcChannel> = (input: IpcChannelMap[K]["input"], event: IpcMainInvokeEvent) => Promise<IpcChannelMap[K]["output"]>;

const publicChannels = new Set<IpcChannel>(["auth:status", "auth:setInitialPassword", "auth:login"]);
const authenticatedSenders = new Set<number>();
const defaultStudentExportColumns: StudentExportColumn[] = [
  "nombre",
  "matricula",
  "nivel",
  "career",
  "prepaProgram",
  "generacion",
  "email",
  "telefono",
  "notas",
  "activo",
  "activeGroups",
  "activeRoles",
  "activeGroupCount",
  "createdAt",
  "updatedAt"
];
const defaultGroupExportColumns: GroupExportColumn[] = [
  "nombre",
  "category",
  "descripcion",
  "activeStudents",
  "activeStudentCount",
  "activeMatriculas",
  "activeEmails",
  "activeRoles",
  "createdAt",
  "updatedAt"
];
const studentExportLabels: Record<StudentExportColumn, string> = {
  nombre: "Nombre",
  matricula: "Matricula",
  nivel: "Nivel",
  career: "Carrera",
  prepaProgram: "Programa prepa",
  generacion: "Generacion",
  email: "Email",
  telefono: "Telefono",
  notas: "Notas",
  activo: "Activo",
  activeGroups: "Grupos activos",
  activeRoles: "Roles activos",
  activeGroupCount: "Total grupos activos",
  createdAt: "Creado",
  updatedAt: "Actualizado"
};
const groupExportLabels: Record<GroupExportColumn, string> = {
  nombre: "Nombre",
  category: "Categoria",
  descripcion: "Descripcion",
  activeStudents: "Estudiantes activos",
  activeMatriculas: "Matriculas activas",
  activeEmails: "Correos activos",
  activeRoles: "Roles presentes",
  activeStudentCount: "Total estudiantes activos",
  createdAt: "Creado",
  updatedAt: "Actualizado"
};
const studentImportHeaders = ["Nombre", "Matricula", "Nivel", "Carrera", "Programa prepa", "Generacion", "Email", "Telefono", "Notas", "Activo"];
const groupImportHeaders = ["Nombre", "Categoria", "Descripcion"];

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
    "categories:permanentDelete": async (input) => services.categoryService.permanentlyDeleteCategory(input.id),
    "categories:restore": async (input) => services.categoryService.restoreCategory(input.id),
    "categories:getById": async (input) => services.categoryService.getCategoryById(input.id),
    "categories:list": async () => services.categoryService.listCategories(),
    "categories:listDeleted": async () => services.categoryService.listDeletedCategories(),

    "roles:create": async (input) => services.roleService.createRole(input),
    "roles:update": async (input) => services.roleService.updateRole(input.id, input.data),
    "roles:delete": async (input) => services.roleService.deleteRole(input.id),
    "roles:permanentDelete": async (input) => services.roleService.permanentlyDeleteRole(input.id),
    "roles:restore": async (input) => services.roleService.restoreRole(input.id),
    "roles:getById": async (input) => services.roleService.getRoleById(input.id),
    "roles:list": async () => services.roleService.listRoles(),
    "roles:listDeleted": async () => services.roleService.listDeletedRoles(),

    "careers:create": async (input) => services.careerService.createCareer(input),
    "careers:update": async (input) => services.careerService.updateCareer(input.id, input.data),
    "careers:delete": async (input) => services.careerService.deleteCareer(input.id),
    "careers:permanentDelete": async (input) => services.careerService.permanentlyDeleteCareer(input.id),
    "careers:restore": async (input) => services.careerService.restoreCareer(input.id),
    "careers:getById": async (input) => services.careerService.getCareerById(input.id),
    "careers:list": async () => services.careerService.listCareers(),
    "careers:listDeleted": async () => services.careerService.listDeletedCareers(),

    "prepaPrograms:create": async (input) => services.prepaProgramService.createPrepaProgram(input),
    "prepaPrograms:update": async (input) => services.prepaProgramService.updatePrepaProgram(input.id, input.data),
    "prepaPrograms:delete": async (input) => services.prepaProgramService.deletePrepaProgram(input.id),
    "prepaPrograms:permanentDelete": async (input) => services.prepaProgramService.permanentlyDeletePrepaProgram(input.id),
    "prepaPrograms:restore": async (input) => services.prepaProgramService.restorePrepaProgram(input.id),
    "prepaPrograms:getById": async (input) => services.prepaProgramService.getPrepaProgramById(input.id),
    "prepaPrograms:list": async () => services.prepaProgramService.listPrepaPrograms(),
    "prepaPrograms:listDeleted": async () => services.prepaProgramService.listDeletedPrepaPrograms(),

    "students:create": async (input) => services.studentService.createStudent(input),
    "students:update": async (input) => services.studentService.updateStudent(input.id, input.data),
    "students:delete": async (input) => services.studentService.deleteStudent(input.id),
    "students:permanentDelete": async (input) => services.studentService.permanentlyDeleteStudent(input.id),
    "students:restore": async (input) => services.studentService.restoreStudent(input.id),
    "students:getById": async (input) => services.studentService.getStudentById(input.id),
    "students:list": async () => services.studentService.listStudents(),
    "students:listDeleted": async () => services.studentService.listDeletedStudents(),
    "students:search": async (input) => services.studentService.searchStudents(input),
    "students:exportCsv": async (input) => {
      const columns = selectExportColumns(input.columns, defaultStudentExportColumns, studentExportLabels);
      const rows = await services.studentService.searchStudents(input.filters);
      const memberships = await services.studentGroupService.listGroupsOfStudents(rows.map((student) => student.id));
      const membershipsByStudentId = new Map<string, typeof memberships>();

      for (const student of rows) {
        membershipsByStudentId.set(student.id, memberships.filter((membership) => membership.studentId === student.id));
      }

      return exportCsv("estudiantes.csv", [
        columns.map((column) => studentExportLabels[column]),
        ...rows.map((student) => {
          const relatedMemberships = membershipsByStudentId.get(student.id) ?? [];
          const activeMemberships = relatedMemberships
            .filter((membership) => (input.filters.participationStatus === "all" || membership.active) && membership.group.deletedAt === null);

          const activeGroupNames = activeMemberships.map((membership) => membership.group.nombre);
          const activeRoleNames = Array.from(new Set(activeMemberships.map((membership) => membership.role?.name ?? "Sin rol")));
          const values: Record<StudentExportColumn, string | number | Date> = {
            nombre: student.nombre,
            matricula: student.matricula,
            nivel: student.nivel,
            career: student.career?.name ?? "",
            prepaProgram: student.prepaProgram?.name ?? "",
            generacion: student.generacion,
            email: student.email ?? "",
            telefono: student.telefono ?? "",
            notas: student.notas ?? "",
            activo: student.activo ? "Si" : "No",
            activeGroups: activeGroupNames.join("; "),
            activeRoles: activeRoleNames.join("; "),
            activeGroupCount: activeGroupNames.length,
            createdAt: student.createdAt,
            updatedAt: student.updatedAt
          };
          return columns.map((column) => values[column]);
        })
      ]);
    },
    "students:exportTemplateCsv": async () => exportCsv("plantilla-estudiantes.csv", [studentImportHeaders]),
    "students:importCsv": async () => {
      const filePath = await pickCsvImportFile();
      if (!filePath) {
        return { created: 0, failed: 0, errors: [] };
      }

      const rows = parseCsv(await fs.readFile(filePath, "utf8"));
      const careers = await services.careerService.listCareers();
      const programs = await services.prepaProgramService.listPrepaPrograms();
      const careerByName = createNameLookup(careers);
      const programByName = createNameLookup(programs);
      const result = { created: 0, failed: 0, errors: [] as string[] };

      for (const [index, row] of rows.entries()) {
        const lineNumber = index + 2;
        try {
          const nivel = normalizeLevel(getCsvValue(row, "Nivel"));
          const careerName = getCsvValue(row, "Carrera");
          const programName = getCsvValue(row, "Programa prepa");
          const career = careerName ? careerByName.get(normalizeLookupKey(careerName)) : null;
          const program = programName ? programByName.get(normalizeLookupKey(programName)) : null;

          if (nivel === "PROFESIONAL" && !career) {
            throw new Error(`La carrera "${careerName}" no existe.`);
          }

          if (nivel === "PREPA" && !program) {
            throw new Error(`El programa prepa "${programName}" no existe.`);
          }

          await services.studentService.createStudent({
            nombre: getCsvValue(row, "Nombre"),
            matricula: getCsvValue(row, "Matricula"),
            nivel,
            careerId: nivel === "PROFESIONAL" ? career?.id : null,
            prepaProgramId: nivel === "PREPA" ? program?.id : null,
            generacion: parsePositiveInteger(getCsvValue(row, "Generacion"), "Generacion"),
            email: optionalCsvValue(row, "Email"),
            telefono: optionalCsvValue(row, "Telefono"),
            notas: optionalCsvValue(row, "Notas"),
            activo: parseOptionalBoolean(getCsvValue(row, "Activo")) ?? true
          });
          result.created += 1;
        } catch (error) {
          result.failed += 1;
          result.errors.push(`Fila ${lineNumber}: ${getErrorMessage(error)}`);
        }
      }

      return result;
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
    "groups:permanentDelete": async (input) => services.groupService.permanentlyDeleteGroup(input.id),
    "groups:restore": async (input) => services.groupService.restoreGroup(input.id),
    "groups:getById": async (input) => services.groupService.getGroupById(input.id),
    "groups:list": async () => services.groupService.listGroups(),
    "groups:listDeleted": async () => services.groupService.listDeletedGroups(),
    "groups:search": async (input) => services.groupService.searchGroups(input),
    "groups:exportCsv": async (input) => {
      const columns = selectExportColumns(input.columns, defaultGroupExportColumns, groupExportLabels);
      const rows = await services.groupService.searchGroups(input.filters);
      return exportCsv("grupos.csv", [
        columns.map((column) => groupExportLabels[column]),
        ...await Promise.all(rows.map(async (group) => {
          const memberships = await services.studentGroupService.listStudentsOfGroup(group.id);
          const activeMembers = memberships.filter((membership) => (input.filters.participationStatus === "all" || membership.active) && membership.student.deletedAt === null);
          const activeStudentNames = activeMembers.map((membership) => membership.student.nombre);
          const activeMatriculas = activeMembers.map((membership) => membership.student.matricula);
          const activeEmails = activeMembers.map((membership) => membership.student.email ?? "").filter(Boolean);
          const activeRoles = Array.from(new Set(activeMembers.map((membership) => membership.role?.name ?? "Sin rol")));
          const groupWithCategory = group as typeof group & { category?: { name: string } | null };
          const values: Record<GroupExportColumn, string | number | Date> = {
            nombre: group.nombre,
            category: groupWithCategory.category?.name ?? "Sin categoria",
            descripcion: group.descripcion ?? "",
            activeStudents: activeStudentNames.join("; "),
            activeMatriculas: activeMatriculas.join("; "),
            activeEmails: activeEmails.join("; "),
            activeRoles: activeRoles.join("; "),
            activeStudentCount: activeStudentNames.length,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt
          };
          return columns.map((column) => values[column]);
        }))
      ]);
    },
    "groups:exportTemplateCsv": async () => exportCsv("plantilla-grupos.csv", [groupImportHeaders]),
    "groups:importCsv": async () => {
      const filePath = await pickCsvImportFile();
      if (!filePath) {
        return { created: 0, failed: 0, errors: [] };
      }

      const rows = parseCsv(await fs.readFile(filePath, "utf8"));
      const categories = await services.categoryService.listCategories();
      const categoryByName = createNameLookup(categories);
      const result = { created: 0, failed: 0, errors: [] as string[] };

      for (const [index, row] of rows.entries()) {
        const lineNumber = index + 2;
        try {
          const categoryName = getCsvValue(row, "Categoria");
          const category = categoryByName.get(normalizeLookupKey(categoryName));
          if (!category) {
            throw new Error(`La categoria "${categoryName}" no existe.`);
          }

          await services.groupService.createGroup({
            nombre: getCsvValue(row, "Nombre"),
            categoryId: category.id,
            descripcion: optionalCsvValue(row, "Descripcion")
          });
          result.created += 1;
        } catch (error) {
          result.failed += 1;
          result.errors.push(`Fila ${lineNumber}: ${getErrorMessage(error)}`);
        }
      }

      return result;
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

function selectExportColumns<T extends string>(
  requested: T[],
  fallback: T[],
  labels: Record<T, string>
): T[] {
  const allowed = new Set(Object.keys(labels));
  const columns = requested.filter((column) => allowed.has(column));
  return columns.length > 0 ? columns : fallback;
}

async function pickCsvImportFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "CSV", extensions: ["csv"] }]
  });

  return result.canceled ? null : (result.filePaths[0] ?? null);
}

function parseCsv(content: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;
  const normalizedContent = content.replace(/^\uFEFF/, "");

  for (let index = 0; index < normalizedContent.length; index += 1) {
    const char = normalizedContent[index];
    const nextChar = normalizedContent[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  const [headers = [], ...bodyRows] = rows;
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  return bodyRows
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, row[index]?.trim() ?? ""])));
}

function getCsvValue(row: Record<string, string>, header: string): string {
  return row[normalizeHeader(header)] ?? "";
}

function optionalCsvValue(row: Record<string, string>, header: string): string | null {
  const value = getCsvValue(row, header).trim();
  return value || null;
}

function normalizeHeader(value: string): string {
  return normalizeLookupKey(value).replace(/\s+/g, "");
}

function normalizeLookupKey(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function createNameLookup<T extends { id: string; name: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [normalizeLookupKey(item.name), item]));
}

function normalizeLevel(value: string): "PREPA" | "PROFESIONAL" {
  const normalized = normalizeLookupKey(value);
  if (normalized === "prepa") {
    return "PREPA";
  }

  if (normalized === "profesional") {
    return "PROFESIONAL";
  }

  throw new Error("Nivel debe ser PREPA o PROFESIONAL.");
}

function parsePositiveInteger(value: string, field: string): number {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${field} debe ser un numero entero positivo.`);
  }

  return numberValue;
}

function parseOptionalBoolean(value: string): boolean | null {
  const normalized = normalizeLookupKey(value);
  if (!normalized) {
    return null;
  }

  if (["si", "s", "true", "1", "activo"].includes(normalized)) {
    return true;
  }

  if (["no", "n", "false", "0", "inactivo"].includes(normalized)) {
    return false;
  }

  throw new Error("Activo debe ser Si o No.");
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Error inesperado.";
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
