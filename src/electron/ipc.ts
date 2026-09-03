import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import { dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import { appPaths, uploadPrefixes } from "../config/paths";
import { createBackendServices } from "../main/container";
import type { IpcChannel, IpcChannelMap } from "../types/ipc";
import type {
  GroupExportColumn,
  MembershipCsvExportInput,
  ReportExportKind,
  StudentExportColumn
} from "../types/domain";
import { AuthenticationError } from "../utils/errors";
import { readImportWorkbook, writeImportTemplate } from "../services/import-template.service";

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
  "giro",
  "portfolio",
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
  giro: "Giro",
  portfolio: "Portafolio",
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
const groupImportHeaders = ["Nombre", "Giro", "Portafolio", "Descripcion"];
const membershipImportHeaders = ["Matricula", "Grupo", "Rol", "FechaIngreso", "FechaSalida", "Activo"];
const reportLabelByKind: Record<ReportExportKind, string> = {
  participations: "reporte-pertenencias.csv",
  studentsWithoutActiveGroup: "reporte-estudiantes-sin-grupo.csv",
  groupsWithoutLeader: "reporte-grupos-sin-lider.csv",
  groupsWithLowMembership: "reporte-grupos-baja-pertenencia.csv",
  emptyCategories: "reporte-giros-vacios.csv",
  unusedRoles: "reporte-roles-sin-uso.csv",
  inactiveStudentsWithActiveMembership: "reporte-estudiantes-inactivos-con-pertenencia.csv",
  groupSummary: "reporte-resumen-grupos.csv"
};

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

    "giros:create": async (input) => services.giroService.createCategory(input),
    "giros:update": async (input) => services.giroService.updateCategory(input.id, input.data),
    "giros:delete": async (input) => services.giroService.deleteCategory(input.id),
    "giros:permanentDelete": async (input) => services.giroService.permanentlyDeleteCategory(input.id),
    "giros:restore": async (input) => services.giroService.restoreCategory(input.id),
    "giros:getById": async (input) => services.giroService.getCategoryById(input.id),
    "giros:list": async () => services.giroService.listCategories(),
    "giros:listDeleted": async () => services.giroService.listDeletedCategories(),

    "portfolios:create": async (input) => services.portfolioService.createPortfolio(input),
    "portfolios:update": async (input) => services.portfolioService.updatePortfolio(input.id, input.data),
    "portfolios:delete": async (input) => services.portfolioService.deletePortfolio(input.id),
    "portfolios:permanentDelete": async (input) => services.portfolioService.permanentlyDeletePortfolio(input.id),
    "portfolios:restore": async (input) => services.portfolioService.restorePortfolio(input.id),
    "portfolios:getById": async (input) => services.portfolioService.getPortfolioById(input.id),
    "portfolios:list": async () => services.portfolioService.listPortfolios(),
    "portfolios:listDeleted": async () => services.portfolioService.listDeletedPortfolios(),

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
          const values: Record<StudentExportColumn, string | number | Date | null> = {
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
    "students:exportTemplateXlsx": async () => {
      const result = await dialog.showSaveDialog({ defaultPath: "plantilla-estudiantes.xlsx", filters: [{ name: "Excel", extensions: ["xlsx"] }] });
      if (result.canceled || !result.filePath) return null;
      const [careers, programs] = await Promise.all([services.careerService.listCareers(), services.prepaProgramService.listPrepaPrograms()]);
      return writeImportTemplate(result.filePath, studentImportHeaders, [
        { field: "Nombre", instruction: "Obligatorio. Nombre completo del estudiante." },
        { field: "Matricula", instruction: "Obligatoria. Debe ser unica." },
        { field: "Nivel", instruction: "Copia una opcion exacta: PREPA o PROFESIONAL." },
        { field: "Carrera", instruction: `Obligatoria para PROFESIONAL. Opciones actuales: ${careers.map((item) => item.name).join(", ") || "Sin carreras registradas"}` },
        { field: "Programa prepa", instruction: `Obligatorio para PREPA. Opciones actuales: ${programs.map((item) => item.name).join(", ") || "Sin programas registrados"}` },
        { field: "Generacion", instruction: "Obligatoria. Numero entero positivo, por ejemplo 2026." },
        { field: "Email / Telefono / Notas", instruction: "Opcionales. Deja vacio si no aplica." },
        { field: "Activo", instruction: "Opcional. Copia Si o No; si se deja vacio se toma como Si." },
        { field: "Ejemplo", instruction: `Nombre: Ana Lopez | Matricula: A01234567 | Nivel: PROFESIONAL | Carrera: ${careers[0]?.name ?? "Carrera"} | Generacion: 2026 | Activo: Si` }
      ]);
    },
    "students:importCsv": async () => {
      const filePath = await pickCsvImportFile();
      if (!filePath) {
        return { created: 0, failed: 0, errors: [] };
      }

      const rows = await readImportRows(filePath, studentImportHeaders);
      const careers = await services.careerService.listCareers();
      const programs = await services.prepaProgramService.listPrepaPrograms();
      const careerByName = createNameLookup(careers);
      const programByName = createNameLookup(programs);
      const result = { created: 0, failed: 0, errors: [] as string[] };

      for (const [index, row] of rows.entries()) {
        const lineNumber = getImportRowNumber(row, index + 2);
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
    "students:graduate": async (input) => services.studentService.graduateStudents(input),

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
          const groupWithCatalogs = group as typeof group & { giro?: { name: string } | null; portfolio?: { name: string } | null };
          const values: Record<GroupExportColumn, string | number | Date> = {
            nombre: group.nombre,
            giro: groupWithCatalogs.giro?.name ?? "Sin giro",
            portfolio: groupWithCatalogs.portfolio?.name ?? "Sin portafolio",
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
    "groups:exportTemplateXlsx": async () => {
      const result = await dialog.showSaveDialog({ defaultPath: "plantilla-grupos.xlsx", filters: [{ name: "Excel", extensions: ["xlsx"] }] });
      if (result.canceled || !result.filePath) return null;
      const [giros, portfolios] = await Promise.all([services.giroService.listCategories(), services.portfolioService.listPortfolios()]);
      return writeImportTemplate(result.filePath, groupImportHeaders, [
        { field: "Nombre", instruction: "Obligatorio. Nombre del grupo." },
        { field: "Giro", instruction: `Obligatorio. Copia una opcion exacta: ${giros.map((item) => item.name).join(", ") || "Sin giros registrados"}` },
        { field: "Portafolio", instruction: `Obligatorio. Copia una opcion exacta: ${portfolios.map((item) => item.name).join(", ") || "Sin portafolios registrados"}` },
        { field: "Descripcion", instruction: "Opcional. Descripcion del grupo." },
        { field: "Ejemplo", instruction: `Nombre: Grupo ejemplo | Giro: ${giros[0]?.name ?? "Giro"} | Portafolio: ${portfolios[0]?.name ?? "Portafolio"}` }
      ]);
    },
    "groups:importCsv": async () => {
      const filePath = await pickCsvImportFile();
      if (!filePath) {
        return { created: 0, failed: 0, errors: [] };
      }

      const rows = await readImportRows(filePath, groupImportHeaders);
      const giros = await services.giroService.listCategories();
      const portfolios = await services.portfolioService.listPortfolios();
      const giroByName = createNameLookup(giros);
      const portfolioByName = createNameLookup(portfolios);
      const result = { created: 0, failed: 0, errors: [] as string[] };

      for (const [index, row] of rows.entries()) {
        const lineNumber = getImportRowNumber(row, index + 2);
        try {
          const giroName = getCsvValue(row, "Giro") || getCsvValue(row, "Categoria");
          const portfolioName = getCsvValue(row, "Portafolio");
          const giro = giroByName.get(normalizeLookupKey(giroName));
          const portfolio = portfolioByName.get(normalizeLookupKey(portfolioName));
          if (!giro) {
            throw new Error(`El giro "${giroName}" no existe.`);
          }
          if (!portfolio) {
            throw new Error(`El portafolio "${portfolioName}" no existe.`);
          }

          await services.groupService.createGroup({
            nombre: getCsvValue(row, "Nombre"),
            giroId: giro.id,
            portfolioId: portfolio.id,
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
    "memberships:exportCsv": async (input) => {
      const rows = await services.studentGroupService.listMembershipsForCsvExport(input);
      return exportCsv("pertenencias.csv", [
        ["Matricula", "Estudiante", "Grupo", "Giro", "Portafolio", "Rol", "Ingreso", "Salida", "Vigente"],
        ...rows.map((membership) => [
          membership.student.matricula,
          membership.student.nombre,
          membership.group.nombre,
          membership.group.giro?.name ?? "Sin giro",
          membership.group.portfolio?.name ?? "Sin portafolio",
          membership.role?.name ?? "Sin rol",
          membership.joinedAt,
          membership.leftAt,
          membership.active ? "Si" : "No"
        ])
      ]);
    },
    "memberships:exportTemplateXlsx": async () => {
      const result = await dialog.showSaveDialog({ defaultPath: "plantilla-pertenencias.xlsx", filters: [{ name: "Excel", extensions: ["xlsx"] }] });
      if (result.canceled || !result.filePath) return null;
      const [groups, roles] = await Promise.all([services.groupService.listGroups(), services.roleService.listRoles()]);
      return writeImportTemplate(result.filePath, membershipImportHeaders, [
        { field: "Matricula", instruction: "Obligatoria. Debe coincidir con un estudiante existente." },
        { field: "Grupo", instruction: `Obligatorio. Copia una opcion exacta: ${groups.map((item) => item.nombre).join(", ") || "Sin grupos registrados"}` },
        { field: "Rol", instruction: `Opcional. Copia una opcion exacta: ${roles.map((item) => item.name).join(", ") || "Sin roles registrados"}` },
        { field: "FechaIngreso / FechaSalida", instruction: "Opcionales. Usa una fecha reconocible, preferentemente AAAA-MM-DD." },
        { field: "Activo", instruction: "Opcional. Copia Si o No; si se deja vacio se toma como vigente." },
        { field: "Ejemplo", instruction: `Matricula: A01234567 | Grupo: ${groups[0]?.nombre ?? "Grupo"} | Rol: ${roles[0]?.name ?? "Rol"} | Activo: Si` }
      ]);
    },
    "memberships:importCsv": async () => {
      const filePath = await pickCsvImportFile();
      if (!filePath) {
        return { created: 0, failed: 0, errors: [] };
      }

      const rows = await readImportRows(filePath, membershipImportHeaders);
      return services.studentGroupService.importMemberships(
        rows.map((row) => {
          return {
            matricula: getCsvValue(row, "Matricula"),
            groupName: getCsvValue(row, "Grupo"),
            roleName: optionalCsvValue(row, "Rol"),
            joinedAt: optionalCsvValue(row, "FechaIngreso"),
            leftAt: optionalCsvValue(row, "FechaSalida"),
            active: parseOptionalBoolean(getCsvValue(row, "Activo")),
            sourceRow: getImportRowNumber(row, 0)
          };
        })
      );
    },

    "groupManagement:exportTemplateXlsx": async (input) => {
      const result = await dialog.showSaveDialog({
        defaultPath: "plantilla-cambio-gestion.xlsx",
        filters: [{ name: "Excel", extensions: ["xlsx"] }]
      });
      if (result.canceled || !result.filePath) {
        return null;
      }

      return services.groupManagementService.exportTemplate(input.groupId, result.filePath);
    },
    "groupManagement:previewImportXlsx": async (input) => {
      const filePath = await pickXlsxImportFile();
      if (!filePath) {
        return { filePath: null, rows: [], ready: 0, pending: 0, errors: 0 };
      }

      return services.groupManagementService.previewImport(input.groupId, filePath);
    },
    "groupManagement:applyImportXlsx": async (input) => services.groupManagementService.applyImport(input),

    "pendingMemberships:list": async (input) => services.pendingMembershipService.listPendingMemberships(input),
    "pendingMemberships:cancel": async (input) => services.pendingMembershipService.cancelPendingMembership(input.id),

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
    "meta:operationalSummary": async () => services.metaService.getOperationalSummary(),
    "reports:exportCsv": async (input) => exportOperationalReportCsv(input.kind, services),
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
    filters: [{ name: "Excel o CSV", extensions: ["xlsx", "csv"] }]
  });

  return result.canceled ? null : (result.filePaths[0] ?? null);
}

async function readImportRows(filePath: string, expectedHeaders: string[]): Promise<Array<Record<string, string>>> {
  return filePath.toLowerCase().endsWith(".xlsx")
    ? readImportWorkbook(filePath, expectedHeaders)
    : parseCsv(await fs.readFile(filePath, "utf8"));
}

async function pickXlsxImportFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Excel", extensions: ["xlsx"] }]
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

function getImportRowNumber(row: Record<string, string>, fallback: number): number {
  const sourceRow = Number(row.__sourceRow);
  return Number.isInteger(sourceRow) && sourceRow > 0 ? sourceRow : fallback;
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

async function exportOperationalReportCsv(
  kind: ReportExportKind,
  services: ReturnType<typeof createBackendServices>
): Promise<string | null> {
  const operational = await services.metaService.getOperationalSummary();
  if (kind === "participations") {
    const rows = await services.studentGroupService.listMembershipsForCsvExport({ participationStatus: "all" });
    return exportCsv(reportLabelByKind[kind], [
      ["Matricula", "Estudiante", "Grupo", "Giro", "Portafolio", "Rol", "Ingreso", "Salida", "Vigente"],
      ...rows.map((membership) => [
        membership.student.matricula,
        membership.student.nombre,
        membership.group.nombre,
        membership.group.giro?.name ?? "Sin giro",
        membership.group.portfolio?.name ?? "Sin portafolio",
        membership.role?.name ?? "Sin rol",
        membership.joinedAt,
        membership.leftAt,
        membership.active ? "Si" : "No"
      ])
    ]);
  }

  if (kind === "studentsWithoutActiveGroup") {
    return exportCsv(reportLabelByKind[kind], [
      ["Matricula", "Nombre"],
      ...operational.studentAlerts.map((student) => [student.matricula, student.nombre])
    ]);
  }

  if (kind === "groupsWithoutLeader") {
    return exportCsv(reportLabelByKind[kind], [
      ["Grupo", "Miembros activos"],
      ...operational.groupsWithoutLeaderRows.map((group) => [group.nombre, group.activeMembers])
    ]);
  }

  if (kind === "groupsWithLowMembership") {
    return exportCsv(reportLabelByKind[kind], [
      ["Grupo", "Miembros activos"],
      ...operational.groupsWithLowMembershipRows.map((group) => [group.nombre, group.activeMembers])
    ]);
  }

  if (kind === "emptyCategories") {
    return exportCsv(reportLabelByKind[kind], [
      ["Giro"],
      ...operational.emptyCategoryRows.map((giro) => [giro.name])
    ]);
  }

  if (kind === "unusedRoles") {
    return exportCsv(reportLabelByKind[kind], [
      ["Rol"],
      ...operational.unusedRoleRows.map((role) => [role.name])
    ]);
  }

  if (kind === "inactiveStudentsWithActiveMembership") {
    return exportCsv(reportLabelByKind[kind], [
      ["Matricula", "Nombre"],
      ...operational.inactiveStudentRows.map((student) => [student.matricula, student.nombre])
    ]);
  }

  const groups = await services.groupService.listGroups();
  const groupRows = await Promise.all(groups.map(async (group) => {
    const groupWithCatalogs = group as typeof group & { giro?: { name: string } | null; portfolio?: { name: string } | null };
    const memberships = await services.studentGroupService.listStudentsOfGroup(group.id);
    const activeMembers = memberships.filter((membership) => membership.active && membership.student.deletedAt === null);
    const hasLeader = activeMembers.some((membership) => {
      const roleName = membership.role?.name ?? "";
      const normalized = roleName
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return normalized === "lider" || normalized === "presidente" || normalized === "coordinador";
    });

    return [
      group.nombre,
      groupWithCatalogs.giro?.name ?? "Sin giro",
      groupWithCatalogs.portfolio?.name ?? "Sin portafolio",
      activeMembers.length,
      hasLeader ? "Si" : "No"
    ];
  }));
  return exportCsv(reportLabelByKind[kind], [
    ["Grupo", "Giro", "Portafolio", "Miembros vigentes", "Tiene lider"],
    ...groupRows
  ]);
}
