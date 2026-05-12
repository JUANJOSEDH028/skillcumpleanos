import { GoogleGenAI } from "@google/genai";
import type { Cumpleanero } from "./excel.js";
import { formatTodaySpanish } from "./paths.js";

const DEFAULT_MODEL = "imagen-3.0-generate-002";

function getModel(): string {
  return (process.env.GEMINI_IMAGE_MODEL ?? DEFAULT_MODEL).trim();
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
  const model = getModel();

  let response;
  try {
    response = await ai.models.generateImages({
      model,
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: "1:1",
        outputMimeType: "image/png",
        imageSize: "2K",
        includeRaiReason: true,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Error al llamar a la API de Gemini (modelo ${model}): ${msg}`);
  }

  const img = response.generatedImages?.[0];
  const bytes = img?.image?.imageBytes;
  if (!bytes) {
    const reason = img?.raiFilteredReason ?? "sin detalle de la API";
    throw new Error(
      `La API de Gemini no devolvió imagen (posible filtro de seguridad o cuota). Motivo: ${reason}`,
    );
  }

  return {
    base64: bytes,
    mimeType: img.image?.mimeType ?? "image/png",
  };
}
