import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

export interface Cumpleanero {
  nombre: string;
  cargo: string;
}

/** Tras normalizar a minúsculas: nombres de columna aceptados (plan original + camelCase típico). */
function validateColumnas(sample: Record<string, unknown>): string | null {
  const hasNombre = "nombre" in sample || "nombrecompleto" in sample;
  const hasFecha = "fecha_nacimiento" in sample || "fechanacimiento" in sample;
  const hasCargo = "cargo" in sample || "nombrecargo" in sample;
  if (hasNombre && hasFecha && hasCargo) return null;
  const missing: string[] = [];
  if (!hasNombre) missing.push("nombre o nombreCompleto");
  if (!hasFecha) missing.push("fecha_nacimiento o fechaNacimiento");
  if (!hasCargo) missing.push("cargo o nombreCargo");
  return `Faltan columnas obligatorias: ${missing.join("; ")}.`;
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[String(k).trim().toLowerCase()] = v;
  }
  return out;
}

/** Interpreta celda de nacimiento: string DD/MM/YYYY, número serial Excel, o Date */
export function parseFechaNacimiento(value: unknown): Date | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
    return null;
  }

  if (typeof value === "string") {
    const s = value.trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const year = parseInt(m[3], 10);
    const d = new Date(year, month, day);
    if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
      return null;
    }
    return d;
  }

  return null;
}

function getNombre(row: Record<string, unknown>): string {
  return String(row.nombre ?? row.nombrecompleto ?? "").trim();
}

function getFechaCell(row: Record<string, unknown>): unknown {
  return row.fecha_nacimiento ?? row.fechanacimiento;
}

function getCargo(row: Record<string, unknown>): string {
  return String(row.cargo ?? row.nombrecargo ?? "").trim();
}

function sameMonthDay(a: Date, b: Date): boolean {
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export type ReadExcelResult =
  | { ok: true; cumpleaneros: Cumpleanero[] }
  | { ok: false; error: string };

/**
 * Lee el Excel, valida columnas y devuelve cumpleañeros cuyo día/mes coincide con `today`.
 */
export async function readCumpleanerosHoy(
  archivo: string,
  today: Date = new Date(),
): Promise<ReadExcelResult> {
  const abs = path.resolve(archivo);
  try {
    await fs.access(abs);
  } catch {
    return {
      ok: false,
      error: `No se encontró el archivo o la ruta no es válida: ${abs}`,
    };
  }

  let workbook: XLSX.WorkBook;
  try {
    // `readFile` del paquete xlsx no está expuesto en todos los bundles ESM;
    // leer el buffer con Node y usar `read` es compatible en Cursor/npx.
    const buf = await fs.readFile(abs);
    workbook = XLSX.read(buf, { type: "buffer", cellDates: true, raw: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `No se pudo leer el archivo Excel: ${msg}` };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { ok: false, error: "El archivo Excel no tiene hojas." };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    return { ok: false, error: "La primera hoja del Excel está vacía." };
  }

  const sample = normalizeRowKeys(rows[0]!);
  const columnasError = validateColumnas(sample);
  if (columnasError) {
    return {
      ok: false,
      error: `${columnasError} También se aceptan los nombres en snake_case: nombre, fecha_nacimiento, cargo.`,
    };
  }

  const cumpleaneros: Cumpleanero[] = [];

  for (const rawRow of rows) {
    const row = normalizeRowKeys(rawRow);
    const nombre = getNombre(row);
    const cargo = getCargo(row);
    const fechaCell = getFechaCell(row);
    const birth = parseFechaNacimiento(fechaCell);

    if (!nombre && !cargo && (fechaCell === "" || fechaCell == null)) continue;

    if (!nombre) continue;

    if (!birth) {
      continue;
    }

    if (sameMonthDay(birth, today)) {
      cumpleaneros.push({ nombre, cargo: cargo || "—" });
    }
  }

  return { ok: true, cumpleaneros };
}
