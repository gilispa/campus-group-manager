import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { readImportWorkbook, writeImportTemplate } from "../src/services/import-template.service";

const studentHeaders = ["Nombre", "Matricula", "Nivel", "Carrera", "Programa prepa", "Generacion", "Email", "Telefono", "Notas", "Activo"];

test("Excel imports normalize headers and find them after title rows", async () => {
  const testDir = await fs.mkdtemp(path.join(process.cwd(), "data", "test-runs", "excel-import-"));
  const filePath = path.join(testDir, "estudiantes.xlsx");

  try {
    const workbook = new ExcelJS.Workbook();
    const cover = workbook.addWorksheet("Portada");
    cover.getCell("A1").value = "Archivo de apoyo";
    const sheet = workbook.addWorksheet("Datos 2026");
    sheet.getCell("A1").value = "Importacion de estudiantes";
    sheet.getCell("A2").value = "Completa los datos a partir de la siguiente fila";
    sheet.getRow(4).values = ["NOMBRE", "Matrícula", "Nivel", "Carrera", "Programa Prepa", "Generación", "Email", "Teléfono", "Notas", "Activo"];
    sheet.getRow(5).values = ["Ana Lopez", "A001", "PROFESIONAL", "Ingenieria", "", 2026, "ana@example.com", "", "", "Sí"];
    await workbook.xlsx.writeFile(filePath);

    const rows = await readImportWorkbook(filePath, studentHeaders);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.nombre, "Ana Lopez");
    assert.equal(rows[0]?.matricula, "A001");
    assert.equal(rows[0]?.generacion, "2026");
    assert.equal(rows[0]?.activo, "Sí");
    assert.equal(rows[0]?.__sourceRow, "5");
  } finally {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});

test("generated Excel templates remain importable", async () => {
  const testDir = await fs.mkdtemp(path.join(process.cwd(), "data", "test-runs", "excel-template-"));
  const filePath = path.join(testDir, "plantilla.xlsx");

  try {
    await writeImportTemplate(filePath, studentHeaders, []);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    workbook.getWorksheet("Plantilla")?.addRow(["Luis Perez", "A002", "PREPA", "", "Bachillerato", 2026]);
    await workbook.xlsx.writeFile(filePath);

    const rows = await readImportWorkbook(filePath, studentHeaders);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.matricula, "A002");
    assert.equal(rows[0]?.programaprepa, "Bachillerato");
  } finally {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});
