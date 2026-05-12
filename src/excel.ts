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
    const key = String(k)
      .trim()
      .replace(/^\uFEFF/, "")
      .replace(/\u200B/g, "")
      .toLowerCase();
    out[key] = v;
  }
  return out;
}

/** Interpreta celda de nacimiento: Date, serial Excel, DD/MM/AAAA, AAAA-MM-DD, DD-MM-AAAA, con u sin hora */
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
    let s = value.trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}T/i.test(s)) {
      s = s.split("T")[0]!.trim();
    }
    // Excel a veces exporta "12/5/1990 0:00:00" o con coma decimal en hora
    const tIdx = s.search(/\s+[0-9]/);
    if (tIdx > 0 && /[/\-.]/.test(s.slice(0, tIdx))) {
      s = s.slice(0, tIdx).trim();
    }

    // ISO YYYY-MM-DD
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const day = parseInt(m[3], 10);
      const d = new Date(year, month, day);
      if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) return d;
      return null;
    }

    // DD/MM/YYYY o DD-MM-YYYY
    m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const year = parseInt(m[3], 10);
      const d = new Date(year, month, day);
      if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
        return null;
      }
      return d;
    }

    // Año de 2 dígitos DD/MM/YY (heurística 1950–2049)
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (m) {
      let year = parseInt(m[3], 10);
      year += year >= 50 ? 1900 : 2000;
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const d = new Date(year, month, day);
      if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
        return null;
      }
      return d;
    }

    return null;
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

/** Fila duplicada del encabezado: el nombre es literalmente el título de la columna */
function esFilaEncabezadoRepetido(nombre: string): boolean {
  const n = nombre.trim().toLowerCase().replace(/\s+/g, " ");
  const compact = n.replace(/\s/g, "");
  const falsos = new Set([
    "nombrecompleto",
    "nombre",
    "nombre completo",
    "fechanacimiento",
    "fecha_nacimiento",
    "fecha nacimiento",
    "nombrecargo",
    "nombre cargo",
    "cargo",
  ]);
  return falsos.has(n) || falsos.has(compact);
}

/**
 * ¿El cumpleaños (mes/día) coincide con `today` en el calendario local del usuario?
 * Incluye comparación por **UTC** del nacimiento: Excel/xlsx suele entregar Date en medianoche UTC
 * y en América eso se ve como el **día anterior** en hora local (ej. 12-may queda 11-may).
 */
function sameMonthDay(birth: Date, today: Date): boolean {
  const tm = today.getMonth();
  const td = today.getDate();
  const localOk = birth.getMonth() === tm && birth.getDate() === td;
  const utcOk = birth.getUTCMonth() === tm && birth.getUTCDate() === td;
  return localOk || utcOk;
}

export interface LecturaStats {
  filasLeidas: number;
  filasConNombre: number;
  filasConFechaValida: number;
  /** Cuántas filas (con fecha válida) tienen el mismo mes/día que "hoy" en el servidor */
  filasConMesDiaIgualHoy: number;
  filasOmitidasEncabezado: number;
  /** Con qué fecha/zona compara el proceso Node (el MCP corre en tu PC) */
  referenciaHoy: {
    dia: number;
    mes: number;
    anio: number;
    zonaHoraria: string;
    isoUtc: string;
  };
}

export type ReadExcelResult =
  | { ok: true; cumpleaneros: Cumpleanero[]; stats: LecturaStats }
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
  let filasConNombre = 0;
  let filasConFechaValida = 0;
  let filasConMesDiaIgualHoy = 0;
  let filasOmitidasEncabezado = 0;

  for (const rawRow of rows) {
    const row = normalizeRowKeys(rawRow);
    const nombre = getNombre(row);
    const cargo = getCargo(row);
    const fechaCell = getFechaCell(row);
    const birth = parseFechaNacimiento(fechaCell);

    if (!nombre && !cargo && (fechaCell === "" || fechaCell == null)) continue;

    if (!nombre) continue;

    if (esFilaEncabezadoRepetido(nombre)) {
      filasOmitidasEncabezado += 1;
      continue;
    }

    filasConNombre += 1;

    if (!birth) {
      continue;
    }
    filasConFechaValida += 1;

    if (sameMonthDay(birth, today)) {
      filasConMesDiaIgualHoy += 1;
      cumpleaneros.push({ nombre, cargo: cargo || "—" });
    }
  }

  const stats: LecturaStats = {
    filasLeidas: rows.length,
    filasConNombre,
    filasConFechaValida,
    filasConMesDiaIgualHoy,
    filasOmitidasEncabezado,
    referenciaHoy: {
      dia: today.getDate(),
      mes: today.getMonth() + 1,
      anio: today.getFullYear(),
      zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isoUtc: today.toISOString(),
    },
  };

  return { ok: true, cumpleaneros, stats };
}
