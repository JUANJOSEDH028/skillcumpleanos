import OpenAI from "openai";
import type { ResponseOutputItem } from "openai/resources/responses/responses";
import type { Cumpleanero } from "./excel.js";
import { formatDayMonthSpanish } from "./paths.js";
import type { DatosTarjetaCorporativa, TipoTarjeta } from "./card-types.js";

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

export interface EstiloTarjeta {
  nombre: string;
  paleta: string;
  fondo: string;
  tipografia: string;
  decoracion: string;
  ambiente: string;
}

export const ESTILOS_TARJETA: EstiloTarjeta[] = [
  {
    nombre: "Luxury Gold",
    paleta: "negro profundo (#0A0A0A), dorado (#D4AF37), marfil (#FFFFF0), champagne (#F7E7CE)",
    fondo: "fondo negro aterciopelado con destellos dorados sutiles y textura de seda",
    tipografia: "serif elegante para el título, sans-serif dorada para nombres, alto contraste blanco sobre negro",
    decoracion: "filigrana dorada en bordes, cinta y lazo dorado, estrellas doradas, destellos de luz cálida",
    ambiente: "lujoso, exclusivo, premium, como tarjeta de invitación de gala corporativa",
  },
  {
    nombre: "Tropical Vibrante",
    paleta: "turquesa (#00CED1), coral (#FF6B6B), amarillo sol (#FFD700), verde lima (#32CD32), blanco",
    fondo: "gradiente vibrante de turquesa a coral con formas abstractas festivas",
    tipografia: "sans-serif bold y colorida, letras con sombra blanca para los nombres",
    decoracion: "globos de colores, confeti multicolor, estrellas brillantes, elementos festivos tropicales",
    ambiente: "alegre, vibrante, energético, celebración corporativa festiva",
  },
  {
    nombre: "Minimalista Elegante",
    paleta: "blanco puro (#FFFFFF), gris claro (#F5F5F5), antracita (#2C2C2C), acento azul (#0066CC)",
    fondo: "fondo blanco o gris muy claro con líneas geométricas sutiles y generoso espacio en blanco",
    tipografia: "sans-serif ultradelgada y moderna, tipografía grande y bien espaciada",
    decoracion: "líneas finas geométricas, un solo punto de acento azul, sin decoración recargada",
    ambiente: "minimalista, sobrio, diseño escandinavo, clean corporate moderno",
  },
  {
    nombre: "Dark Neon",
    paleta: "negro (#000000), neón rosa (#FF00FF), cyan eléctrico (#00FFFF), morado (#9B59B6), blanco",
    fondo: "fondo negro con gradiente de luces de neón brillantes, efecto glow, atmósfera nocturna urbana",
    tipografia: "sans-serif futurista con efecto glow neón en los nombres, muy impactante",
    decoracion: "luces de neón en bordes, estrellas brillantes, destellos eléctricos, confeti luminoso",
    ambiente: "futurista, tecnológico, cyberpunk corporativo premium",
  },
  {
    nombre: "Glassmorphism Azul",
    paleta: "azul marino (#1A1A4E), azul eléctrico (#4169E1), blanco translúcido, lila (#9370DB)",
    fondo: "gradiente de azul profundo a lila con formas geométricas de vidrio esmerilado (blur)",
    tipografia: "sans-serif blanca sobre paneles de vidrio esmerilado, efecto frosted glass",
    decoracion: "burbujas de vidrio, esfera cristalina, reflexiones de luz, partículas flotantes",
    ambiente: "moderno, tecnológico premium, glassmorphism UI, sofisticado y fresco",
  },
  {
    nombre: "Corporativo Rojo",
    paleta: "rojo corporativo (#C0392B), carmesí (#8B0000), blanco (#FFFFFF), gris oscuro (#2C3E50)",
    fondo: "fondo rojo profundo con textura sutil y diagonal de diseño con acento gris oscuro",
    tipografia: "sans-serif blanca bold para contraste máximo, títulos grandes e impactantes",
    decoracion: "cinta roja elegante, detalles geométricos blancos, confeti institucional sutil",
    ambiente: "corporativo fuerte, institucional, poderoso, marca empresarial sólida",
  },
  {
    nombre: "Naturaleza Verde",
    paleta: "verde esmeralda (#2ECC71), verde bosque (#1A5276), dorado (#D4AF37), crema (#FDFEFE)",
    fondo: "fondo verde esmeralda con elementos botánicos abstractos y hojas geométricas doradas",
    tipografia: "serif elegante en crema y dorado, combinación natural y sofisticada",
    decoracion: "hojas doradas abstractas, flores geométricas, ramas elegantes como marcos",
    ambiente: "natural, refrescante, corporativo sostenible premium, vida y crecimiento",
  },
  {
    nombre: "Sunset Gradient",
    paleta: "naranja (#FF6B35), rosa (#FF1493), púrpura (#8B008B), azul noche (#000080), dorado",
    fondo: "gradiente dramático de naranja-rosa a púrpura-azul oscuro, como atardecer cinematográfico",
    tipografia: "sans-serif blanca con sombra para legibilidad sobre el gradiente, moderna",
    decoracion: "confeti en tonos cálidos, estrellas doradas, destellos de luz, rayos de sunset",
    ambiente: "cálido, emotivo, cinematográfico, dramático y bello, sunset corporativo premium",
  },
  {
    nombre: "Tech Abstracto",
    paleta: "azul oscuro (#0D1B2A), azul acero (#1B4F72), cyan (#00BCD4), blanco, gris metálico",
    fondo: "fondo azul oscuro con patrones de circuitos abstractos, grid tecnológico y partículas",
    tipografia: "monospace o sans-serif tech, cyan para nombres, blanco para texto secundario",
    decoracion: "circuitos abstractos, nodos conectados, partículas tech, hexágonos, formas 3D",
    ambiente: "tecnológico, innovador, digital, startup corporativa, high-tech celebration",
  },
  {
    nombre: "Pastel Acuarela",
    paleta: "rosa pastel (#FFB6C1), lavanda (#E6E6FA), menta (#98FF98), melocotón (#FFDAB9), blanco",
    fondo: "fondo blanco con manchas suaves de acuarela en pastel, textura artística pintada a mano",
    tipografia: "sans-serif redondeada y amigable, colores suaves, cálido y cercano",
    decoracion: "flores de acuarela, globos pastel, confeti suave, arco iris pastel, puntos de color",
    ambiente: "cálido, artístico, celebración alegre y dulce, arte hecho a mano premium",
  },
];

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
  const estiloIdx = Math.floor(Math.random() * ESTILOS_TARJETA.length);
  const estilo = ESTILOS_TARJETA[estiloIdx]!;
  const fraseEsc = opts.fraseMotivacional.replace(/"/g, "'").trim();

  const fechaLabel = formatDayMonthSpanish(opts.today);
  const listaPersonas = opts.people
    .map((p) => `- ${p.nombre} — ${p.cargo}`)
    .join("\n");

  return `Crea una tarjeta corporativa premium de cumpleaños con diseño dinámico y adaptable.

⚠️ IMAGEN ÚNICA OBLIGATORIA (ID: ${ejecucionId}):
Genera exactamente UNA sola tarjeta vertical. Un solo lienzo. NO collage, NO mosaico, NO cuadrícula de varias tarjetas, NO storyboard.

ESTILO Y DIRECCIÓN ARTÍSTICA — "${estilo.nombre}":
- Paleta de colores: ${estilo.paleta}
- Fondo: ${estilo.fondo}
- Tipografía: ${estilo.tipografia}
- Decoración: ${estilo.decoracion}
- Ambiente: ${estilo.ambiente}
Respeta fielmente esta dirección artística en colores, composición y decoración. NO mezclar con otros estilos.

OBJETIVO:
Tarjeta institucional de cumpleaños donde los empleados estén agrupados correctamente según su fecha. Información organizada de forma limpia, elegante y fácil de leer.

ADAPTACIÓN AUTOMÁTICA DEL DISEÑO según cantidad de personas:
- Pocas personas (1–2): diseño más visual y protagonista, nombres grandes y centrales.
- Varias personas (3+): grid elegante, tarjetas internas o columnas balanceadas, excelente aprovechamiento del espacio.

ELEMENTOS VISUALES FESTIVOS (en bordes o zonas SIN texto encima):
Globos, confeti, luces, regalos, pasteles, chispas, elementos abstractos, formas geométricas, detalles metálicos.
El área del texto debe ser plana, limpia y con alto contraste.

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

// ─── Tarjetas corporativas genéricas ──────────────────────────────────────────

interface ConfigTipo {
  tituloTarjeta: string;
  subtitulo: string;
  objetivoDescripcion: string;
  elementosVisuales: string;
}

const CONFIG_POR_TIPO: Record<TipoTarjeta, ConfigTipo> = {
  aniversario: {
    tituloTarjeta: "¡Feliz Aniversario!",
    subtitulo: "Gracias por tu dedicación y compromiso con nuestra empresa",
    objetivoDescripcion:
      "Tarjeta de aniversario laboral corporativa que celebra los años de servicio del empleado.",
    elementosVisuales:
      "Trofeos, medallas doradas, estrellas doradas, cintas de honor, número grande de años de servicio, calendario estilizado.",
  },
  reconocimiento: {
    tituloTarjeta: "¡Felicitaciones!",
    subtitulo: "Reconocemos tu esfuerzo y logro excepcional",
    objetivoDescripcion:
      "Tarjeta institucional de reconocimiento que destaca un logro, ascenso o meta alcanzada.",
    elementosVisuales:
      "Trofeos brillantes, estrellas, destellos de luz, podio, corona elegante, medallas corporativas.",
  },
  invitacion: {
    tituloTarjeta: "Están Invitados",
    subtitulo: "Los esperamos en este importante evento corporativo",
    objetivoDescripcion:
      "Tarjeta de invitación a evento corporativo (conferencia, reunión, fiesta institucional).",
    elementosVisuales:
      "Sobre de carta elegante, confeti institucional, reloj o calendario, sello corporativo, elementos de evento.",
  },
  descuento: {
    tituloTarjeta: "Oferta Especial",
    subtitulo: "Aprovecha esta promoción exclusiva para nuestro equipo",
    objetivoDescripcion:
      "Tarjeta de anuncio de descuento o promoción corporativa interna.",
    elementosVisuales:
      "Etiqueta de precio estilizada, porcentaje grande y llamativo, cinta de oferta, destellos, elementos de celebración.",
  },
};

export function buildCardPrompt(opts: DatosTarjetaCorporativa): string {
  const ejecucionId = Date.now();
  const estiloIdx = Math.floor(Math.random() * ESTILOS_TARJETA.length);
  const estilo = ESTILOS_TARJETA[estiloIdx]!;
  const cfg = CONFIG_POR_TIPO[opts.tipo];
  const fraseEsc = opts.frase_eslogan.replace(/"/g, "'").trim();
  const fechaLabel = formatDayMonthSpanish(opts.today);

  const lineasInfo: string[] = [`- Destinatario: ${opts.nombre_destinatario}`];
  if (opts.anos_servicio) lineasInfo.push(`- Años de servicio: ${opts.anos_servicio}`);
  if (opts.fecha_evento) lineasInfo.push(`- Fecha del evento: ${opts.fecha_evento}`);
  if (opts.detalle) lineasInfo.push(`- Detalle: ${opts.detalle}`);
  const bloqueInfo = lineasInfo.join("\n");

  return `Crea una tarjeta corporativa premium de tipo "${opts.tipo}" con diseño dinámico y adaptable.

⚠️ IMAGEN ÚNICA OBLIGATORIA (ID: ${ejecucionId}):
Genera exactamente UNA sola tarjeta vertical. Un solo lienzo. NO collage, NO mosaico, NO cuadrícula, NO storyboard.

ESTILO Y DIRECCIÓN ARTÍSTICA — "${estilo.nombre}":
- Paleta de colores: ${estilo.paleta}
- Fondo: ${estilo.fondo}
- Tipografía: ${estilo.tipografia}
- Decoración: ${estilo.decoracion}
- Ambiente: ${estilo.ambiente}
Respeta fielmente esta dirección artística en colores, composición y decoración. NO mezclar con otros estilos.

OBJETIVO:
${cfg.objetivoDescripcion}

TEXTO PRINCIPAL:
- Título: "${cfg.tituloTarjeta}"
- Subtítulo: "${cfg.subtitulo}"

ELEMENTOS VISUALES COMPLEMENTARIOS (solo en bordes o zonas SIN texto encima):
${cfg.elementosVisuales}
El área del texto debe ser plana, limpia y con alto contraste.

TEXTO LITERAL — copiar carácter por carácter en la imagen (mismas mayúsculas, minúsculas y tildes):
Fecha: ${fechaLabel}
${bloqueInfo}

FRASE / ESLOGAN (copiar exactamente, una sola vez):
"${fraseEsc}"

CALIDAD VISUAL:
Tarjeta institucional premium, diseño corporativo moderno, composición profesional, excelente legibilidad, elegante, ultra detallada, iluminación cinematográfica, acabado profesional de alta calidad.
Tipografía sans-serif grande para nombre y datos, alto contraste. Sin texto curvo, sin script para datos.

FORMATO: Tarjeta vertical 9:16, resolución 4K, premium corporate card, modern typography, elegant design.
NO incluir logos de terceros. Solo español en los textos visibles.`;
}

export async function generateCorporateCardImage(
  opts: DatosTarjetaCorporativa,
): Promise<{ base64: string; mimeType: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error(
      "Falta la variable de entorno OPENAI_API_KEY. Configúrala en Claude Desktop (entorno del servidor MCP) o en tu sistema.",
    );
  }
  const prompt = buildCardPrompt(opts);
  const client = new OpenAI({ apiKey: apiKey.trim() });
  if (imageBackend() === "responses") {
    return generateViaResponsesApi(client, prompt);
  }
  return generateViaImageApi(client, prompt);
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
