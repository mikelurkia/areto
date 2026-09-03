import { readAmountCents } from "@/lib/money";
import type { ParsedImport, ParsedMovement } from "@/lib/movement-import";

/**
 * CSV genérico del proyecto (el plan no fija columnas para "CSV", solo Norma
 * 43): cabecera obligatoria `fecha, concepto, importe` y opcional
 * `fecha_valor, contraparte, saldo`, detectadas por nombre sin importar
 * mayúsculas, acentos ni orden. Mismo `ParsedMovement` de salida que el
 * importador de Norma 43.
 */

export class CsvParseError extends Error {}

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_");
}

function splitRow(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim());
}

function parseCsvDate(raw: string): string | null {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dmy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return null;
}

export function parseMovementsCsv(content: string): ParsedImport {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new CsvParseError("csvEmpty");

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const header = splitRow(lines[0], delimiter).map(normalizeHeader);
  const columnIndex = (key: string) => header.indexOf(key);

  for (const key of ["fecha", "concepto", "importe"]) {
    if (columnIndex(key) === -1) throw new CsvParseError("csvMissingColumn");
  }

  const movements: ParsedMovement[] = [];

  for (const line of lines.slice(1)) {
    const cells = splitRow(line, delimiter);

    const bookedOn = parseCsvDate(cells[columnIndex("fecha")] ?? "");
    if (!bookedOn) throw new CsvParseError("csvInvalidRow");

    const concept = (cells[columnIndex("concepto")] ?? "").trim();
    if (!concept) throw new CsvParseError("csvInvalidRow");

    const amountCents = readAmountCents(cells[columnIndex("importe")] ?? "");
    if (amountCents === null) throw new CsvParseError("csvInvalidRow");

    const valueOnIndex = columnIndex("fecha_valor");
    const valueOn = valueOnIndex >= 0 ? parseCsvDate(cells[valueOnIndex] ?? "") : null;

    const counterpartyIndex = columnIndex("contraparte");
    const counterparty =
      counterpartyIndex >= 0 ? cells[counterpartyIndex]?.trim() || null : null;

    const balanceIndex = columnIndex("saldo");
    const balanceCents =
      balanceIndex >= 0 ? readAmountCents(cells[balanceIndex] ?? "") : null;

    movements.push({ bookedOn, valueOn, amountCents, concept, counterparty, balanceCents });
  }

  if (movements.length === 0) throw new CsvParseError("csvNoMovements");

  const dates = movements.map((m) => m.bookedOn).sort();
  return { movements, fromDate: dates[0], toDate: dates[dates.length - 1] };
}
