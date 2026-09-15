import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(projectRoot, "docs", "GUIA-DE-USO.md");
const outputPath = path.join(projectRoot, "docs", "GUIA-DE-USO.pdf");
const source = await fs.readFile(sourcePath, "utf8");

function wrap(text, width = 92) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

const lines = [];
for (const rawLine of source.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line) {
    lines.push({ text: "", heading: false });
  } else if (line.startsWith("#")) {
    lines.push({ text: line.replace(/^#+\s*/, ""), heading: true });
    lines.push({ text: "", heading: false });
  } else {
    const printableLine = line
      .replace(/^[-*]\s+/, "- ")
      .replace(/^(\d+)\.\s+/, "$1. ")
      .replace(/[```*]/g, "");
    for (const part of wrap(printableLine)) {
      lines.push({ text: part, heading: false });
    }
  }
}

const pages = [];
for (let index = 0; index < lines.length; index += 45) pages.push(lines.slice(index, index + 45));
const objects = [];
const addObject = (body) => { objects.push(body); return objects.length; };
const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
const pagesId = addObject("");
const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
const pageIds = [];

function pdfText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

for (const page of pages) {
  const commands = ["BT", "/F1 18 Tf", "72 760 Td", "(Guia de uso - GE Finder) Tj", "ET"];
  let y = 724;
  for (const line of page) {
    if (line.text) {
      commands.push("BT", `/F1 ${line.heading ? 14 : 10} Tf`, `72 ${y} Td`, `(${pdfText(line.text)}) Tj`, "ET");
    }
    y -= line.heading ? 20 : 14;
  }
  const stream = commands.join("\n");
  const streamId = addObject(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  pageIds.push(addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`));
}
objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
const offsets = [0];
for (let index = 0; index < objects.length; index += 1) {
  offsets.push(Buffer.byteLength(pdf, "latin1"));
  pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
}
const xrefOffset = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

await fs.writeFile(outputPath, Buffer.from(pdf, "latin1"));
console.log(`PDF creado: ${outputPath}`);
