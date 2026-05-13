import OpenAI from "openai";
import type { ResponseOutputItem } from "openai/resources/responses/responses";
import type { Cumpleanero } from "./excel.js";
import { formatDayMonthSpanish } from "./paths.js";

/**
 * Alineado con la guía OpenAI **Image generation** (GPT Image):
 * https://developers.openai.com/api/docs/guides/image-generation
 *
 * - **Image API** (`images.generate`): una sola imagen por prompt (recomendado por OpenAI).
 * - **Responses API** (`responses.create` + herramienta `image_generation`):
 *   https://developers.openai.com/api/docs/api-reference/responses
 *
 * Por defecto: Image API con `gpt-image-2`. Opcional: `OPENAI_IMAGE_BACKEND=responses`.
 */
const DEFAULT_IMAGE_MODELS = [
  "gpt-image-2",
  "gpt-image-1.5",
  "gpt-image-1",
  "gpt-image-1-mini",
  "dall-e-3",
  "dall-e-2",
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

function imageBackend(): "images" | "responses" {
  const v = process.env.OPENAI_IMAGE_BACKEND?.trim().toLowerCase();
  return v === "responses" || v === "response" ? "responses" : "images";
}

function imageModelCandidates(): string[] {
  const env = process.env.OPENAI_IMAGE_MODEL?.trim();
  const rest = DEFAULT_IMAGE_MODELS.filter((m) => m !== env);
  const ordered = env ? [env, ...rest] : [...DEFAULT_IMAGE_MODELS];
  return [...new Set(ordered)];
}

function isGptImageModel(model: string): boolean {
  const m = model.toLowerCase();
  return m.includes("gpt-image") || m === "chatgpt-image-latest";
}

function isDallE(model: string): boolean {
  return model.toLowerCase().includes("dall-e");
}

function defaultSizeForModel(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("dall-e-3")) return "1024x1792";
  if (m.includes("dall-e-2")) return "1024x1024";
  if (isGptImageModel(model)) return "auto";
  return "auto";
}

function resolveImageSize(model: string): string {
  const fromEnv = process.env.OPENAI_IMAGE_SIZE?.trim();
  if (fromEnv) return fromEnv;
  return defaultSizeForModel(model);
}

function resolveOutputFormat(): "png" | "jpeg" | "webp" {
  const f = process.env.OPENAI_IMAGE_OUTPUT_FORMAT?.trim().toLowerCase();
  if (f === "jpeg" || f === "jpg") return "jpeg";
  if (f === "webp") return "webp";
  return "png";
}

function mimeForOutputFormat(f: "png" | "jpeg" | "webp"): string {
  if (f === "jpeg") return "image/jpeg";
  if (f === "webp") return "image/webp";
  return "image/png";
}

/** Calidad: GPT Image → low|medium|high|auto; DALL·E 3 → hd|standard. */
function resolveGenerateQuality(
  model: string,
): OpenAI.Images.ImageGenerateParamsNonStreaming["quality"] {
  const raw = process.env.OPENAI_IMAGE_QUALITY?.trim().toLowerCase();
  if (isGptImageModel(model)) {
    if (raw === "low" || raw === "medium" || raw === "high" || raw === "auto") {
      return raw;
    }
    if (raw === "hd" || raw === "high") return "high";
    if (raw === "standard") return "medium";
    return "auto";
  }
  if (model.toLowerCase().includes("dall-e-3")) {
    return raw === "standard" ? "standard" : "hd";
  }
  return "standard";
}

function resolveModeration(): "auto" | "low" | undefined {
  const m = process.env.OPENAI_IMAGE_MODERATION?.trim().toLowerCase();
  if (m === "low" || m === "auto") return m;
  return undefined;
}

function outputCompression(): number | undefined {
  const n = Number(process.env.OPENAI_IMAGE_OUTPUT_COMPRESSION?.trim());
  if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
  return undefined;
}

function buildImagePrompt(opts: {
  people: Cumpleanero[];
  fraseMotivacional: string;
  today: Date;
}): string {
  const ejecucionId = Date.now();
  const estiloIdx =
    (ejecucionId + opts.people.length * 17 + opts.fraseMotivacional.length * 31) %
    ESTILOS_CREATIVOS.length;
  const direccionCreativa = ESTILOS_CREATIVOS[estiloIdx]!;
  const fraseEsc = opts.fraseMotivacional.replace(/"/g, "'").trim();

  const fechaLabel = formatDayMonthSpanish(opts.today);
  const listaPersonas = opts.people
    .map((p) => `- ${p.nombre} — ${p.cargo}`)
    .join("\n");

  return `Crea una tarjeta corporativa premium de cumpleaños con diseño dinámico y adaptable.

⚠️ IMAGEN ÚNICA OBLIGATORIA (ID: ${ejecucionId}):
Genera exactamente UNA sola tarjeta vertical. Un solo lienzo. NO collage, NO mosaico, NO cuadrícula de varias tarjetas, NO storyboard.

⚠️ VARIACIÓN CREATIVA OBLIGATORIA:
Usa una dirección creativa completamente diferente en cada ejecución. NO reutilizar la misma composición, distribución, colores, fondos ni decoración.
Dirección creativa de esta ejecución: "${direccionCreativa}".

OBJETIVO:
Tarjeta institucional de cumpleaños donde los empleados estén agrupados correctamente según su fecha. La IA organiza la información de forma limpia, elegante y fácil de leer.

ADAPTACIÓN AUTOMÁTICA DEL DISEÑO según cantidad de personas:
- Pocas personas (1–2): diseño más visual y protagonista, nombres grandes y centrales.
- Varias personas (3+): grid elegante, tarjetas internas o columnas balanceadas, excelente aprovechamiento del espacio.

VARIACIÓN DINÁMICA (cambiar entre ejecuciones):
- Paleta de colores, tipografía, fondos, estilo gráfico, decoración, distribución, elementos festivos, iluminación.
- Variar entre: Luxury corporate, Modern corporate, Futurista tecnológico, Minimalista elegante, Dark premium, Glassmorphism, Abstracto ejecutivo, Neón elegante, 3D corporativo, Diseño creativo empresarial.

ELEMENTOS VISUALES FESTIVOS (usar de forma aleatoria y elegante):
Globos, confeti, luces, regalos, pasteles, chispas, elementos abstractos, formas geométricas, decoraciones tecnológicas, detalles metálicos, iluminación cinematográfica.
La decoración festiva solo en bordes o zonas SIN texto encima. El área del texto debe ser plana y limpia.

TEXTO PRINCIPAL:
- Título: "¡Feliz Cumpleaños!"
- Subtítulo opcional: "Celebramos este día especial junto a nuestro equipo"

TEXTO LITERAL — copiar carácter por carácter en la imagen (mismas mayúsculas, minúsculas y tildes):
${fechaLabel}
${listaPersonas}

FRASE MOTIVACIONAL (copiar exactamente, una sola):
"${fraseEsc}"

CALIDAD VISUAL:
Tarjeta institucional premium, diseño corporativo moderno, composición profesional, excelente legibilidad, elegante y emotiva, ultra detallada, iluminación cinematográfica, acabado profesional de alta calidad.
Tipografía sans-serif grande para nombres y cargos, alto contraste. Sin texto curvo, sin script para datos.

FORMATO: Tarjeta vertical 9:16, resolución 4K, premium corporate birthday card, modern typography, elegant celebration design.
NO incluir logos de terceros. Solo español en los textos visibles.`;
}

function extractImageFromResponsesOutput(
  output: Array<ResponseOutputItem>,
  mimeType: string,
): { base64: string; mimeType: string } | null {
  for (const item of output) {
    if (item.type !== "image_generation_call") continue;
    const r = item.result;
    if (r) return { base64: r, mimeType };
  }
  return null;
}

function responsesToolMinimal(): boolean {
  const v = process.env.OPENAI_RESPONSES_TOOL?.trim().toLowerCase();
  return v === "minimal" || v === "1" || v === "true" || v === "yes";
}

/**
 * Igual que en la guía: `response.output` → ítems con `type === "image_generation_call"` → `result` (base64).
 */
async function generateViaResponsesApi(
  client: OpenAI,
  prompt: string,
): Promise<{ base64: string; mimeType: string }> {
  /** Guía Image generation: ejemplos con `gpt-5.5` y herramienta `image_generation`. */
  const chatModel =
    process.env.OPENAI_RESPONSES_MODEL?.trim() || "gpt-5.5";
  const imageModel =
    process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
  const size = resolveImageSize(imageModel);
  const outputFormat = resolveOutputFormat();
  const quality = resolveGenerateQuality(imageModel);
  const gptQuality =
    quality === "standard" || quality === "hd"
      ? "high"
      : (quality as "low" | "medium" | "high" | "auto");

  const tools: OpenAI.Responses.Tool[] = responsesToolMinimal()
    ? [{ type: "image_generation", action: "generate" }]
    : (() => {
        const moderation = resolveModeration();
        const tool: OpenAI.Responses.Tool.ImageGeneration = {
          type: "image_generation",
          action: "generate",
          model: imageModel as OpenAI.Responses.Tool.ImageGeneration["model"],
          quality: gptQuality,
          size: size as OpenAI.Responses.Tool.ImageGeneration["size"],
          output_format: outputFormat,
        };
        if (moderation) tool.moderation = moderation;
        const oc = outputCompression();
        if (
          oc !== undefined &&
          (outputFormat === "jpeg" || outputFormat === "webp")
        ) {
          tool.output_compression = oc;
        }
        return [tool];
      })();

  const input = `Generate an image. Follow this brief exactly (one vertical birthday card):\n\n${prompt}`;

  const response = await client.responses.create({
    model: chatModel,
    input,
    tools,
  });

  if (response.error) {
    const msg =
      "message" in response.error && response.error.message
        ? String(response.error.message)
        : JSON.stringify(response.error);
    throw new Error(`Responses API: ${msg}`);
  }

  const mime = mimeForOutputFormat(outputFormat);
  const extracted = extractImageFromResponsesOutput(response.output ?? [], mime);
  if (extracted) return extracted;

  throw new Error(
    "Responses API no devolvió ningún `image_generation_call` con `result`. " +
      `Revisa que el modelo ${chatModel} soporte la herramienta image_generation.`,
  );
}

async function generateViaImageApi(
  client: OpenAI,
  prompt: string,
): Promise<{ base64: string; mimeType: string }> {
  const candidates = imageModelCandidates();
  const errors: string[] = [];
  const outputFormat = resolveOutputFormat();
  const mimeDefault = mimeForOutputFormat(outputFormat);

  for (const model of candidates) {
    const size = resolveImageSize(model);
    try {
      const base: OpenAI.Images.ImageGenerateParamsNonStreaming = {
        model,
        prompt,
        n: 1,
        size: size as OpenAI.Images.ImageGenerateParamsNonStreaming["size"],
        quality: resolveGenerateQuality(model),
      };

      if (isDallE(model)) {
        base.response_format = "b64_json";
      }

      if (isGptImageModel(model)) {
        base.output_format = outputFormat;
        const mod = resolveModeration();
        if (mod) base.moderation = mod;
        const oc = outputCompression();
        if (oc !== undefined && (outputFormat === "jpeg" || outputFormat === "webp")) {
          base.output_compression = oc;
        }
      }

      const response = await client.images.generate(base);
      const first = response.data?.[0];
      const b64 = first?.b64_json;
      if (b64) {
        return { base64: b64, mimeType: mimeDefault };
      }
      const url = first?.url;
      if (url) {
        const r = await fetch(url);
        if (!r.ok) {
          errors.push(`${model}: URL de imagen HTTP ${r.status}`);
          continue;
        }
        const buf = Buffer.from(await r.arrayBuffer());
        return {
          base64: buf.toString("base64"),
          mimeType:
            r.headers.get("content-type")?.split(";")[0]?.trim() || mimeDefault,
        };
      }
      errors.push(`${model}: respuesta sin b64_json ni url`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${model}: ${msg}`);
    }
  }

  throw new Error(
    `No se pudo generar la imagen con ningún modelo probado (${candidates.join(", ")}). ` +
      `Revisa OPENAI_API_KEY, verificación de organización para GPT Image, y tamaños válidos por modelo. ` +
      `Detalle: ${errors.join(" | ")}`,
  );
}

export async function generateBirthdayCardImage(opts: {
  people: Cumpleanero[];
  fraseMotivacional: string;
  today?: Date;
}): Promise<{ base64: string; mimeType: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error(
      "Falta la variable de entorno OPENAI_API_KEY. Configúrala en Claude Desktop (entorno del servidor MCP) o en tu sistema.",
    );
  }

  const today = opts.today ?? new Date();
  const prompt = buildImagePrompt({ ...opts, today });
  const client = new OpenAI({ apiKey: apiKey.trim() });

  if (imageBackend() === "responses") {
    return generateViaResponsesApi(client, prompt);
  }
  return generateViaImageApi(client, prompt);
}
