import { GoogleGenAI } from "@google/genai";
import type { Cumpleanero } from "./excel.js";
import { formatDayMonthSpanish, formatTodaySpanish } from "./paths.js";

/** Modelos Imagen 4 probados en orden (Imagen 3 suele no estar en AI Studio v1beta). */
const DEFAULT_IMAGE_MODELS = [
  "imagen-4.0-generate-001",
  "imagen-4.0-fast-generate-001",
  "imagen-4.0-ultra-generate-001",
] as const;

const ESTILOS_CREATIVOS = [
  "Luxury corporate",
  "Modern corporate",
  "Futurista tecnológico",
  "Minimalista elegante",
  "Dark premium",
  "Glassmorphism",
  "Abstracto ejecutivo",
  "Neón elegante",
  "3D corporativo",
  "Diseño creativo empresarial",
] as const;

function imageModelCandidates(): string[] {
  const env = process.env.GEMINI_IMAGE_MODEL?.trim();
  const rest = DEFAULT_IMAGE_MODELS.filter((m) => m !== env);
  const ordered = env ? [env, ...rest] : [...DEFAULT_IMAGE_MODELS];
  return [...new Set(ordered)];
}

/**
 * Imagen 4 generate/ultra: solo `imageSize` 1K o 2K (no 4K).
 * Imagen 4 fast: no enviar `imageSize` (API: "not adjustable").
 */
function buildGenerateImagesConfig(model: string): {
  numberOfImages: number;
  aspectRatio: "9:16";
  outputMimeType: string;
  includeRaiReason: boolean;
  imageSize?: "1K" | "2K";
} {
  const id = model.toLowerCase();
  const base = {
    numberOfImages: 1,
    aspectRatio: "9:16" as const,
    outputMimeType: "image/png",
    includeRaiReason: true,
  };
  if (id.includes("fast")) {
    return base;
  }
  const envSize = process.env.GEMINI_IMAGE_SIZE?.trim();
  const imageSize: "1K" | "2K" =
    envSize === "1K" || envSize === "2K" ? envSize : "2K";
  return { ...base, imageSize };
}

function buildImagePrompt(opts: {
  people: Cumpleanero[];
  fraseMotivacional: string;
  today: Date;
}): string {
  const todayLabel = formatTodaySpanish(opts.today);
  const grupoFecha = formatDayMonthSpanish(opts.today);
  const ejecucionId = Date.now();
  const estiloIdx =
    (ejecucionId + opts.people.length * 17 + opts.fraseMotivacional.length * 31) %
    ESTILOS_CREATIVOS.length;
  const direccionCreativa = ESTILOS_CREATIVOS[estiloIdx]!;
  const fraseEsc = opts.fraseMotivacional.replace(/"/g, "'").trim();

  const listaLiteral = opts.people
    .map((p, i) => `${i + 1}. ${p.nombre} — ${p.cargo}`)
    .join("\n");

  return `IMAGEN ÚNICA (obligatorio):
Genera exactamente UNA sola tarjeta vertical de cumpleaños. Un solo lienzo. NO collage, NO mosaico, NO cuadrícula de varias tarjetas, NO plantillas múltiples, NO storyboard, NO hoja de contacto.

PRIORIDAD ABSOLUTA — TEXTO LEGIBLE:
Los modelos de imagen fallan con texto pequeño o decorativo. Debes:
- Copiar los nombres y cargos CARÁCTER POR CARÁCTER como en la lista "TEXTO LITERAL" de abajo (mismas mayúsculas/minúsculas y tildes).
- Usar tipografía sans-serif MUY GRANDE para nombres y cargos (bloque central o inferior), alto contraste (ej. texto oscuro sobre fondo claro suave, o texto claro sobre banda oscura sólida).
- Sin texto curvo, sin neón sobre letras, sin tipografía script para datos, sin texto sobre patrones recargados.
- Título "¡Feliz Cumpleaños!" grande y claro. La frase motivacional en una o dos líneas, misma fuente simple y grande.
- Máximo 2–3 líneas por persona (nombre y cargo). Si hay muchas personas, lista vertical ordenada, no microtexto.

ESTILO (ejecución ${ejecucionId}, variar fondo y color pero sin sacrificar lectura):
Dirección creativa del fondo y decoración: "${direccionCreativa}".
La decoración festiva (confeti, luces, formas) solo en bordes o zonas SIN texto encima. El área del texto debe ser plana y limpia.

CONTENIDO OBLIGATORIO:
- Fecha del día (español): ${todayLabel}
- Grupo del día: ${grupoFecha}

TEXTO LITERAL (copiar exactamente en la imagen, sin inventar ni traducir):
${listaLiteral}

FRASE MOTIVACIONAL (una sola, copiar exactamente):
"${fraseEsc}"

FORMATO:
Tarjeta vertical 9:16, diseño corporativo limpio y profesional, buena iluminación, nitidez en el texto.

NO incluir logos de terceros. Solo español en los textos visibles.`;
}

export async function generateBirthdayCardImage(opts: {
  people: Cumpleanero[];
  fraseMotivacional: string;
  today?: Date;
}): Promise<{ base64: string; mimeType: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error(
      "Falta la variable de entorno GEMINI_API_KEY. Configúrala en Claude Desktop (entorno del servidor MCP) o en tu sistema.",
    );
  }

  const today = opts.today ?? new Date();
  const prompt = buildImagePrompt({ ...opts, today });

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const candidates = imageModelCandidates();

  const errors: string[] = [];

  for (const model of candidates) {
    const config = buildGenerateImagesConfig(model);
    try {
      const response = await ai.models.generateImages({
        model,
        prompt,
        config,
      });

      const img = response.generatedImages?.[0];
      const bytes = img?.image?.imageBytes;
      if (bytes) {
        return {
          base64: bytes,
          mimeType: img.image?.mimeType ?? "image/png",
        };
      }
      const reason = img?.raiFilteredReason ?? "sin bytes en la respuesta";
      errors.push(`${model}: ${reason}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${model}: ${msg}`);
    }
  }

  throw new Error(
    `No se pudo generar la imagen con ningún modelo probado (${candidates.join(", ")}). ` +
      `Revisa que tu API key tenga acceso a Imagen en Google AI Studio, o fija un modelo válido en GEMINI_IMAGE_MODEL. ` +
      `Detalle: ${errors.join(" | ")}`,
  );
}
