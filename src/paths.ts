import path from "node:path";
import os from "node:os";

/** Meses en español minúsculas (carpetas), índice 0 = enero */
export const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const DIAS_ES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

export function getCumpleanosRoot(): string {
  const fromEnv = process.env.CUMPLEANOS_ROOT;
  if (fromEnv && fromEnv.trim()) return path.resolve(fromEnv.trim());
  return path.join(os.homedir(), "cumpleanos");
}

export function metaDir(): string {
  return path.join(getCumpleanosRoot(), ".meta");
}

function extensionFromMime(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes("jpeg")) return "jpg";
  if (m.includes("webp")) return "webp";
  return "png";
}

/** Ruta de imagen del día: `cumpleanos/YYYY/mes/DD.<ext>` bajo la raíz configurada */
export function outputImagePath(
  date: Date = new Date(),
  mimeType = "image/png",
): {
  dir: string;
  file: string;
  fullPath: string;
} {
  const y = date.getFullYear();
  const mes = MESES_ES[date.getMonth()];
  const dd = String(date.getDate()).padStart(2, "0");
  const dir = path.join(getCumpleanosRoot(), String(y), mes);
  const ext = extensionFromMime(mimeType);
  const file = `${dd}.${ext}`;
  return { dir, file, fullPath: path.join(dir, file) };
}

/** Etiqueta legible de la fecha de hoy en español */
export function formatTodaySpanish(date: Date = new Date()): string {
  const diaSemana = DIAS_ES[date.getDay()];
  const d = date.getDate();
  const mes = MESES_ES[date.getMonth()];
  const y = date.getFullYear();
  return `${diaSemana}, ${d} de ${mes} de ${y}`;
}

/** Solo día y mes en español, p. ej. "12 de Mayo" (para agrupación en la tarjeta) */
export function formatDayMonthSpanish(date: Date = new Date()): string {
  const d = date.getDate();
  const mesRaw = MESES_ES[date.getMonth()];
  const mes = mesRaw.charAt(0).toUpperCase() + mesRaw.slice(1);
  return `${d} de ${mes}`;
}

/** Fecha local YYYY-MM-DD (para almacenar última frase) */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
