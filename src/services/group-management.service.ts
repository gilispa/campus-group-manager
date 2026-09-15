import ExcelJS from "exceljs";
import { getPrismaClient } from "../database/prisma";
import type {
  ApplyGroupManagementInput,
  GroupManagementApplyResult,
  GroupManagementPreview,
  GroupManagementPreviewRow
} from "../types/domain";
import { NotFoundError } from "../utils/errors";
import { formatQuotedOptions } from "./import-template.service";

type ParsedManagementRow = {
  lineNumber: number;
  matricula: string;
  nombre: string | null;
  roleName: string | null;
  roleId: string | null;
  studentId: string | null;
  status: "ready" | "pending" | "error";
  message: string;
};

export class GroupManagementService {
  private readonly prisma = getPrismaClient();

  async exportTemplate(groupId: string, destinationPath: string): Promise<string> {
    const group = await this.ensureGroupExists(groupId);
    const roles = await this.prisma.role.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" }
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Gestion Grupos Estudiantiles";
    const template = workbook.addWorksheet("Plantilla");
    template.columns = [
      { header: "Matricula", key: "matricula", width: 18 },
      { header: "Nombre", key: "nombre", width: 32 },
      { header: "Rol", key: "rol", width: 28 }
    ];
    template.getRow(1).font = { bold: true };

    const instructions = workbook.addWorksheet("Instrucciones");
    instructions.columns = [
      { header: "Campo", key: "field", width: 22 },
      { header: "Instruccion", key: "instruction", width: 80 }
    ];
    instructions.getRow(1).font = { bold: true };
    instructions.addRows([
      { field: "Grupo", instruction: group.nombre },
      { field: "Matricula", instruction: "Obligatoria. Debe coincidir con la matricula del alumno en la base." },
      { field: "Nombre", instruction: "Opcional. Se usa para identificar alumnos pendientes si no existen en la base." },
      { field: "Rol", instruction: "Opcional. Copia exactamente uno de los roles entre comillas listados abajo para evitar errores." },
      { field: "Fecha de ingreso", instruction: "No se captura en la plantilla. Se asigna automaticamente con la fecha en que se aplica el cambio de gestion." },
      { field: "Alumnos faltantes", instruction: "Si la matricula no existe, se guardara como pendiente y se vinculara al crear el alumno." }
    ]);

    instructions.addRow({});
    instructions.addRow({ field: "Ejemplo", instruction: `Matricula: A01234567 | Nombre: Nombre Apellido | Rol: ${roles[0]?.name ?? "Nombre exacto del rol"}` });
    instructions.addRow({ field: "Roles actuales", instruction: formatQuotedOptions(roles.map((role) => role.name), "Sin roles registrados") });
    await workbook.xlsx.writeFile(destinationPath);
    return destinationPath;
  }

  async previewImport(groupId: string, filePath: string): Promise<GroupManagementPreview> {
    await this.ensureGroupExists(groupId);
    const rows = await this.analyzeFile(groupId, filePath);
    const previewRows = rows.map((row): GroupManagementPreviewRow => ({
      lineNumber: row.lineNumber,
      matricula: row.matricula,
      nombre: row.nombre,
      roleName: row.roleName,
      status: row.status,
      message: row.message
    }));

    return {
      filePath,
      rows: previewRows,
      ready: rows.filter((row) => row.status === "ready").length,
      pending: rows.filter((row) => row.status === "pending").length,
      errors: rows.filter((row) => row.status === "error").length
    };
  }

  async applyImport(input: ApplyGroupManagementInput): Promise<GroupManagementApplyResult> {
    await this.ensureGroupExists(input.groupId);
    const effectiveAt = parseOptionalDate(input.effectiveAt, "Fecha de cambio") ?? new Date();
    const rows = await this.analyzeFile(input.groupId, input.filePath);
    const errorRows = rows.filter((row) => row.status === "error");
    if (errorRows.length > 0) {
      return {
        archived: 0,
        created: 0,
        pending: 0,
        failed: errorRows.length,
        errors: errorRows.map((row) => `Fila ${row.lineNumber}: ${row.message}`)
      };
    }

    const result: GroupManagementApplyResult = {
      archived: 0,
      created: 0,
      pending: 0,
      failed: 0,
      errors: []
    };

    await this.prisma.$transaction(async (transaction) => {
      const cycle = await transaction.groupManagementCycle.create({
        data: {
          groupId: input.groupId,
          label: input.label?.trim() || `Cambio de gestion ${formatIsoDate(effectiveAt)}`,
          effectiveAt
        }
      });

      const archived = await transaction.studentGroup.updateMany({
        where: {
          groupId: input.groupId,
          active: true
        },
        data: {
          active: false,
          leftAt: effectiveAt
        }
      });
      result.archived = archived.count;

      for (const row of rows) {
        if (row.status === "ready" && row.studentId) {
          await transaction.studentGroup.create({
            data: {
              studentId: row.studentId,
              groupId: input.groupId,
              roleId: row.roleId,
              managementCycleId: cycle.id,
              joinedAt: effectiveAt
            }
          });
          result.created += 1;
          continue;
        }

        const existingPending = await transaction.pendingMembership.findFirst({
          where: {
            groupId: input.groupId,
            matricula: row.matricula,
            status: "PENDING"
          }
        });
        const pendingData = {
          matricula: row.matricula,
          nombre: row.nombre,
          groupId: input.groupId,
          roleId: row.roleId,
          roleName: row.roleName,
          joinedAt: effectiveAt,
          managementCycleId: cycle.id
        };

        if (existingPending) {
          await transaction.pendingMembership.update({
            where: { id: existingPending.id },
            data: pendingData
          });
        } else {
          await transaction.pendingMembership.create({ data: pendingData });
        }
        result.pending += 1;
      }
    });

    return result;
  }

  private async ensureGroupExists(groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, deletedAt: null }
    });
    if (!group) {
      throw new NotFoundError("Grupo no encontrado.");
    }

    return group;
  }

  private async analyzeFile(groupId: string, filePath: string): Promise<ParsedManagementRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet("Plantilla") ?? workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("El archivo no tiene hojas para importar.");
    }

    const [students, roles] = await Promise.all([
      this.prisma.student.findMany({ where: { deletedAt: null } }),
      this.prisma.role.findMany({ where: { deletedAt: null } })
    ]);
    const studentByMatricula = new Map(students.map((student) => [normalizeLookupKey(student.matricula), student]));
    const roleByName = new Map(roles.map((role) => [normalizeLookupKey(role.name), role]));
    const headers = buildHeaderIndex(worksheet.getRow(1));
    const seenMatriculas = new Set<string>();
    const rows: ParsedManagementRow[] = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const matricula = readCell(row, headers, "Matricula");
      const nombre = readCell(row, headers, "Nombre") || null;
      const roleName = readCell(row, headers, "Rol") || null;

      if (!matricula && !nombre && !roleName) {
        continue;
      }

      try {
        if (!matricula) {
          throw new Error("La matricula es requerida.");
        }

        const normalizedMatricula = normalizeLookupKey(matricula);
        if (seenMatriculas.has(normalizedMatricula)) {
          throw new Error("La matricula esta duplicada en el archivo.");
        }
        seenMatriculas.add(normalizedMatricula);

        const role = roleName ? roleByName.get(normalizeLookupKey(roleName)) : null;
        if (roleName && !role) {
          throw new Error(`No existe rol "${roleName}".`);
        }

        const student = studentByMatricula.get(normalizedMatricula) ?? null;
        rows.push({
          lineNumber: rowNumber,
          matricula,
          nombre,
          roleName,
          roleId: role?.id ?? null,
          studentId: student?.id ?? null,
          status: student ? "ready" : "pending",
          message: student ? "Listo para vincular." : "Alumno pendiente por agregar a la base."
        });
      } catch (error) {
        rows.push({
          lineNumber: rowNumber,
          matricula,
          nombre,
          roleName,
          roleId: null,
          studentId: null,
          status: "error",
          message: getErrorMessage(error)
        });
      }
    }

    if (rows.length === 0) {
      throw new Error("La plantilla no contiene alumnos para importar.");
    }

    return rows;
  }
}

function buildHeaderIndex(row: ExcelJS.Row): Map<string, number> {
  const headers = new Map<string, number>();
  row.eachCell((cell, colNumber) => {
    headers.set(normalizeHeader(String(cell.value ?? "")), colNumber);
  });
  return headers;
}

function readCell(row: ExcelJS.Row, headers: Map<string, number>, header: string): string {
  const value = readRawCell(row, headers, header);
  if (value instanceof Date) {
    return formatIsoDate(value);
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (typeof value === "object" && "result" in value) {
    return String(value.result ?? "").trim();
  }
  return String(value).trim();
}

function readRawCell(row: ExcelJS.Row, headers: Map<string, number>, header: string): ExcelJS.CellValue | undefined {
  const column = headers.get(normalizeHeader(header));
  if (!column) {
    return undefined;
  }
  return row.getCell(column).value;
}

function parseOptionalDate(value: Date | string | number | ExcelJS.CellValue | null | undefined, field: string): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${field} tiene un formato invalido.`);
    }
    return value;
  }
  if (typeof value === "number") {
    const parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`${field} tiene un formato invalido.`);
    }
    return parsed;
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return parseOptionalDate(value.text, field);
  }
  if (typeof value === "object" && "result" in value) {
    return parseOptionalDate(value.result as string | number | Date | null | undefined, field);
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} tiene un formato invalido.`);
  }
  return parsed;
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

function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Error inesperado.";
}
