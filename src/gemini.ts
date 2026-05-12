import { GoogleGenAI } from "@google/genai";
import type { Cumpleanero } from "./excel.js";
import { formatTodaySpanish } from "./paths.js";

/** Orden de prueba si no defines GEMINI_IMAGE_MODEL (Imagen 4 suele estar antes en AI Studio). */
const DEFAULT_IMAGE_MODELS = [
  "imagen-4.0-generate-001",
  "imagen-3.0-generate-002",
  "imagen-3.0-generate-001",
] as const;

function imageModelCandidates(): string[] {
  const env = process.env.GEMINI_IMAGE_MODEL?.trim();
  const rest = DEFAULT_IMAGE_MODELS.filter((m) => m !== env);
  const ordered = env ? [env, ...rest] : [...DEFAULT_IMAGE_MODELS];
  return [...new Set(ordered)];
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
  const todayLabel = formatTodaySpanish(today);
  const lista = opts.people.map((p) => `- ${p.nombre} (${p.cargo})`).join("\n");

  const prompt = `Tarjeta de cumpleaños cuadrada 1:1, estilo festivo corporativo amigable, mínimo 1080x1080 píxeles de apariencia visual.
Título grande y muy legible en español: "Feliz Cumpleaños".
Mostrar claramente la fecha del día en español: ${todayLabel}.
Lista de cumpleañeros (nombre y cargo), texto legible en español:
${lista}
Frase motivacional (máximo dos líneas, español), bien visible:
"${opts.fraseMotivacional.replace(/"/g, "'")}"
Estética: confeti, colores vivos, tipografía celebratoria, fondo festivo, composición equilibrada, sin logos de terceros.`;

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const candidates = imageModelCandidates();

  const config = {
    numberOfImages: 1,
    aspectRatio: "1:1" as const,
    outputMimeType: "image/png",
    imageSize: "2K" as const,
    includeRaiReason: true,
  };

  const errors: string[] = [];

  for (const model of candidates) {
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
