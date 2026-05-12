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
  const listaGrupo = opts.people.map((p) => `- ${p.nombre} — ${p.cargo}`).join("\n");
  const ejecucionId = Date.now();
  const estiloIdx =
    (ejecucionId + opts.people.length * 17 + opts.fraseMotivacional.length * 31) %
    ESTILOS_CREATIVOS.length;
  const direccionCreativa = ESTILOS_CREATIVOS[estiloIdx]!;
  const fraseEsc = opts.fraseMotivacional.replace(/"/g, "'").trim();

  return `Crea una tarjeta corporativa premium de cumpleaños con diseño dinámico y adaptable.

⚠️ IMPORTANTE:
La tarjeta debe cambiar visualmente en cada ejecución.
NO reutilizar la misma composición, distribución, colores, fondos ni decoración.
Cada diseño debe tener una dirección creativa diferente manteniendo estética profesional, moderna y elegante.

CONTEXTO_DE_VARIACIÓN (único para esta generación, ejecución ${ejecucionId}):
Dirección creativa preferente OBLIGATORIA para ESTA imagen: "${direccionCreativa}".
Interpreta ese estilo de forma clara y distinta a cualquier tarjeta genérica o repetida.

OBJETIVO:
Generar una tarjeta institucional de cumpleaños donde los empleados estén agrupados correctamente según su fecha de cumpleaños.

La tarjeta puede contener:
- Una sola persona
- Varias personas en la misma fecha
- Varias fechas diferentes en una misma tarjeta (en este archivo, hoy todos comparten la misma fecha de cumpleaños; agrúpalos en un solo bloque claro)

La IA debe organizar automáticamente la información de forma limpia, elegante y fácil de leer.

REGLAS DE AGRUPACIÓN:
Agrupar los empleados por fecha de cumpleaños y mostrar cada grupo claramente separado.

ADAPTACIÓN AUTOMÁTICA DEL DISEÑO:
La composición debe adaptarse automáticamente según:
- Cantidad de fechas
- Cantidad de personas por fecha
- Longitud de nombres
- Cantidad de texto

Si hay muchas personas:
- usar diseño tipo grid elegante
- tarjetas internas
- columnas balanceadas
- excelente aprovechamiento del espacio

Si hay pocas personas:
- usar diseño más visual y protagonista

VARIACIÓN CREATIVA OBLIGATORIA:
Cambiar dinámicamente:
- Paleta de colores
- Tipografía
- Fondos
- Estilo gráfico
- Decoración
- Distribución
- Elementos festivos
- Iluminación
- Estética visual

Variar entre estilos (elige uno principal coherente con la dirección asignada arriba, sin mezclar caos):
- Luxury corporate, Modern corporate, Futurista tecnológico, Minimalista elegante, Dark premium, Glassmorphism, Abstracto ejecutivo, Neón elegante, 3D corporativo, Diseño creativo empresarial

ELEMENTOS VISUALES FESTIVOS:
Usar de forma aleatoria y elegante (no todos a la vez; selecciona un conjunto coherente con el estilo):
- Globos, confeti, luces, regalos, pasteles, chispas, elementos abstractos, formas geométricas, decoraciones tecnológicas, detalles metálicos, iluminación cinematográfica

TEXTO PRINCIPAL:
Título muy legible en español:
"¡Feliz Cumpleaños!"

Subtítulo opcional (puede ir discreto):
"Celebramos este día especial junto a nuestro equipo"

Mostrar también la fecha de referencia del día (texto en español): ${todayLabel}

FRASE MOTIVACIONAL (solo esta, corta y elegante; tema: crecimiento, éxito, liderazgo, felicidad, trabajo en equipo o nuevos comienzos):
"${fraseEsc}"

CALIDAD VISUAL:
- Tarjeta institucional premium, corporativa moderna, composición profesional
- Excelente legibilidad, elegante y emotiva, ultra detallada
- Iluminación cinematográfica, acabado de alta calidad

FORMATO Y SALIDA:
Formato vertical (retrato), proporción 9:16, máxima nitidez y detalle que permita el modelo, premium corporate birthday card, modern typography, elegant celebration design, ultra detailed, realistic lighting.

⚠️ MUY IMPORTANTE:
Usa una dirección creativa completamente diferente en cada ejecución; esta ejecución está anclada al estilo "${direccionCreativa}".

INFORMACIÓN DE CUMPLEAÑOS (obligatorio en el diseño, agrupada por fecha):

${grupoFecha}
${listaGrupo}

No incluyas marcas de terceros ni logos ajenos. Texto en español.`;
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
