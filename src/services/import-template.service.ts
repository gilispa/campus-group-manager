import ExcelJS from "exceljs";

export type InstructionRow = { field: string; instruction: string };
export type ImportRow = Record<string, string> & { __sourceRow?: string };

export async function writeImportTemplate(
  destinationPath: string,
  headers: string[],
  instructions: InstructionRow[]
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gestion Grupos Estudiantiles";
  const template = workbook.addWorksheet("Plantilla");
  template.columns = headers.map((header) => ({ header, key: header, width: Math.max(18, Math.min(34, header.length + 12)) }));
  template.getRow(1).font = { bold: true };
  template.views = [{ state: "frozen", ySplit: 1 }];

  const sheet = workbook.addWorksheet("Instrucciones");
  sheet.columns = [
    { header: "Campo", key: "field", width: 28 },
    { header: "Instruccion y opciones para copiar y pegar", key: "instruction", width: 100 }
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { wrapText: true };
  sheet.addRows(instructions);
  sheet.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
  await workbook.xlsx.writeFile(destinationPath);
  return destinationPath;
}

export async function readImportWorkbook(filePath: string, expectedHeaders: string[] = []): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = selectImportWorksheet(workbook, expectedHeaders);
  if (!worksheet) throw new Error("El archivo no contiene una hoja con datos para importar.");

  const headerRowNumber = findHeaderRow(worksheet, expectedHeaders);
  if (!headerRowNumber) {
    const expected = expectedHeaders.length > 0 ? ` Debe incluir encabezados como: ${expectedHeaders.join(", ")}.` : "";
    throw new Error(`No se encontro la fila de encabezados.${expected}`);
  }

  const headers = getRowValues(worksheet.getRow(headerRowNumber)).map(normalizeHeader);
  const rows: ImportRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    const values = getRowValues(row);
    if (!values.some((value) => value.trim())) return;
    rows.push({
      ...Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
      __sourceRow: String(rowNumber)
    });
  });
  return rows;
}

function selectImportWorksheet(workbook: ExcelJS.Workbook, expectedHeaders: string[]): ExcelJS.Worksheet | undefined {
  const namedTemplate = workbook.getWorksheet("Plantilla");
  if (namedTemplate && findHeaderRow(namedTemplate, expectedHeaders)) return namedTemplate;

  return workbook.worksheets
    .map((worksheet) => ({ worksheet, headerRow: findHeaderRow(worksheet, expectedHeaders) }))
    .sort((left, right) => Number(Boolean(right.headerRow)) - Number(Boolean(left.headerRow)))[0]?.worksheet;
}

function findHeaderRow(worksheet: ExcelJS.Worksheet, expectedHeaders: string[]): number | null {
  const normalizedExpected = new Set(expectedHeaders.map(normalizeHeader));
  const maxRow = Math.min(worksheet.rowCount, 50);

  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    const headers = getRowValues(worksheet.getRow(rowNumber)).map(normalizeHeader).filter(Boolean);
    if (headers.length === 0) continue;

    if (expectedHeaders.length === 0) return rowNumber;
    const matches = headers.filter((header) => normalizedExpected.has(header)).length;
    const requiredMatches = Math.min(2, normalizedExpected.size);
    if (matches >= requiredMatches) return rowNumber;
  }

  return null;
}

function getRowValues(row: ExcelJS.Row): string[] {
  const values: string[] = [];
  for (let column = 1; column <= row.cellCount; column += 1) {
    values.push(row.getCell(column).text.trim());
  }
  return values;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}
