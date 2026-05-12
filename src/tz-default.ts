/**
 * Zona horaria para “hoy” y comparación de cumpleaños (Bogotá / Lima, UTC-5, sin DST).
 * El proceso MCP suele heredar TZ del sistema; fijarla evita desfaces con Excel.
 *
 * Sobrescribe con variable de entorno `CUMPLEANOS_TZ` (ej. `America/Lima`, `UTC`).
 */
const zona = process.env.CUMPLEANOS_TZ?.trim() || "America/Bogota";
process.env.TZ = zona;
