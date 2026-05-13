#!/usr/bin/env node
import "./tz-default.js";
import fs from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { readCumpleanerosHoy } from "./excel.js";
import { generateBirthdayCardImage, generateCorporateCardImage } from "./openai-image.js";
import { resolveEmailConfig, sendBirthdayEmail, sendCardEmail } from "./email-graph.js";
import { localDateKey, outputImagePath, outputCardPath, formatTodaySpanish } from "./paths.js";
import { readLastPhrase, writeLastPhrase } from "./phrase-store.js";
import type { TipoTarjeta, DatosTarjetaCorporativa } from "./card-types.js";

const INSTRUCTIONS = `Skill de tarjetas corporativas con IA. Tienes tres herramientas:

── HERRAMIENTA 1 y 2: CUMPLEAÑOS (requiere archivo Excel) ──
Usa obtener_cumpleaneros_hoy + generar_tarjeta_cumpleanos SOLO cuando el usuario pida tarjetas de cumpleaños y proporcione la ruta de un archivo .xlsx.

── HERRAMIENTA 3: TARJETAS CORPORATIVAS (NO requiere Excel, NO pidas archivo) ──
Usa generar_tarjeta_corporativa para: aniversario laboral, reconocimiento/logro/ascenso, invitación a evento, descuento/promoción.
NO pidas ningún archivo al usuario. Todos los datos vienen de lo que el usuario te describe.
Flujo obligatorio:
1. Extrae del mensaje del usuario: tipo, nombre del destinatario y detalles relevantes.
2. Redacta en español una frase_eslogan breve (máx. 2 líneas) adecuada al tipo:
   - aniversario → gratitud por años de servicio
   - reconocimiento → felicitación por logro o ascenso
   - invitacion → convocatoria cálida al evento
   - descuento → beneficio y oportunidad para el equipo
3. Llama generar_tarjeta_corporativa con todos los parámetros. No pidas confirmación, genera directamente.`;

const server = new McpServer(
  { name: "skillcumpleanos", version: "1.0.0" },
  { instructions: INSTRUCTIONS },
);

server.registerTool(
  "obtener_cumpleaneros_hoy",
  {
    description:
      "Lee un Excel (.xlsx) con columnas de persona y nacimiento. Acepta: nombre / nombreCompleto, fecha_nacimiento / fechaNacimiento (DD/MM/YYYY o fecha Excel), cargo / nombreCargo. Devuelve cumpleañeros del día y la última frase guardada.",
    inputSchema: {
      archivo: z
        .string()
        .describe("Ruta al archivo .xlsx (absoluta o relativa al directorio de trabajo del servidor MCP)"),
    },
  },
  async ({ archivo }) => {
    const last = await readLastPhrase();
    const result = await readCumpleanerosHoy(archivo);

    if (!result.ok) {
      return {
        content: [{ type: "text", text: result.error }],
        isError: true,
      };
    }

    if (result.cumpleaneros.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                hayCumpleaneros: false,
                mensaje: "No hay cumpleañeros hoy.",
                fechaHoy: formatTodaySpanish(),
                ultimaFrase: last?.frase ?? null,
                ultimaFecha: last?.fecha ?? null,
                diagnostico: {
                  ...result.stats,
                  ayuda:
                    "Se compara solo día y mes con hoy (ver referenciaHoy). Las celdas datetime de Excel se leen con valor serial y texto formateado; no hace falta convertirlas a texto a mano. Si filasConFechaValida < filasConNombre, hay fecha vacía o formato no reconocido. Si filasOmitidasEncabezado > 0, había fila con títulos de columnas. También: DD/MM/AAAA, mes en español, ISO, UTC.",
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              hayCumpleaneros: true,
              fechaHoy: formatTodaySpanish(),
              cumpleaneros: result.cumpleaneros,
              ultimaFrase: last?.frase ?? null,
              ultimaFecha: last?.fecha ?? null,
              siguientePaso:
                "Redacta una frase motivacional nueva en español (máx. 2 líneas), distinta de ultimaFrase si existe. Luego llama generar_tarjeta_cumpleanos con archivo y frase_motivacional.",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "generar_tarjeta_cumpleanos",
  {
    description:
      "Genera la imagen PNG de la tarjeta con OpenAI (DALL·E / imágenes), la guarda en la carpeta cumpleanos del usuario y devuelve la imagen para el chat.",
    inputSchema: {
      archivo: z.string().describe("Misma ruta .xlsx usada en obtener_cumpleaneros_hoy"),
      frase_motivacional: z
        .string()
        .describe("Frase en español (máx. 2 líneas) redactada por Claude para la tarjeta"),
    },
  },
  async ({ archivo, frase_motivacional }) => {
    const result = await readCumpleanerosHoy(archivo);
    if (!result.ok) {
      return {
        content: [{ type: "text", text: result.error }],
        isError: true,
      };
    }
    if (result.cumpleaneros.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No hay cumpleañeros hoy; no se generó imagen.",
          },
        ],
        isError: true,
      };
    }

    const today = new Date();
    let image;
    try {
      image = await generateBirthdayCardImage({
        people: result.cumpleaneros,
        fraseMotivacional: frase_motivacional.trim(),
        today,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: "text", text: msg }],
        isError: true,
      };
    }

    const { dir, fullPath, file } = outputImagePath(today, image.mimeType);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, Buffer.from(image.base64, "base64"));

    const fechaKey = localDateKey(today);
    await writeLastPhrase(fechaKey, frase_motivacional.trim());

    const emailCfg = resolveEmailConfig();
    let emailStatus = "";
    if (emailCfg) {
      try {
        await sendBirthdayEmail({
          config: emailCfg,
          people: result.cumpleaneros,
          fraseMotivacional: frase_motivacional.trim(),
          imageBase64: image.base64,
          imageMimeType: image.mimeType,
          imageFileName: file,
          today,
        });
        emailStatus = `\nCorreo enviado a: ${emailCfg.toEmail}`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        emailStatus = `\nCorreo: error al enviar — ${msg}`;
      }
    }

    const nombres = result.cumpleaneros.map((c) => c.nombre).join(", ");
    const summary = [
      `Cumpleañeros: ${nombres}`,
      `Imagen guardada en: ${fullPath}`,
      `Frase usada registrada para evitar repetición el próximo día.`,
      emailStatus,
    ].filter(Boolean).join("\n");

    return {
      content: [
        { type: "text", text: summary },
        {
          type: "image",
          data: image.base64,
          mimeType: image.mimeType,
        },
      ],
    };
  },
);

server.registerTool(
  "generar_tarjeta_corporativa",
  {
    description:
      "Genera una tarjeta corporativa PNG de tipo aniversario laboral, reconocimiento/logro, " +
      "invitación a evento o descuento/promoción. Recibe todos los datos como parámetros directos " +
      "(sin Excel). Claude debe redactar la frase_eslogan antes de llamar este tool.",
    inputSchema: {
      tipo: z
        .enum(["aniversario", "reconocimiento", "invitacion", "descuento"])
        .describe(
          "Tipo de tarjeta: aniversario (años de servicio), reconocimiento (logro/ascenso), " +
          "invitacion (evento corporativo), descuento (promoción interna)",
        ),
      nombre_destinatario: z
        .string()
        .min(1)
        .describe("Nombre de la persona homenajeada o audiencia. Ej: 'María González', 'Equipo de Ventas'"),
      frase_eslogan: z
        .string()
        .min(1)
        .describe("Frase motivacional o eslogan en español (máx. 2 líneas) redactada por Claude para la tarjeta"),
      detalle: z
        .string()
        .optional()
        .describe(
          "Texto secundario según el tipo. " +
          "Reconocimiento: nombre del logro o cargo nuevo. " +
          "Invitación: nombre del evento. " +
          "Descuento: descripción del beneficio (ej. '30% en capacitaciones').",
        ),
      anos_servicio: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Solo para tipo=aniversario. Número de años cumplidos en la empresa."),
      fecha_evento: z
        .string()
        .optional()
        .describe("Solo para tipo=invitacion. Fecha u hora en texto libre (ej. 'Viernes 20 de Junio, 6 PM')."),
    },
  },
  async ({ tipo, nombre_destinatario, frase_eslogan, detalle, anos_servicio, fecha_evento }) => {
    const today = new Date();

    const datos: DatosTarjetaCorporativa = {
      tipo: tipo as TipoTarjeta,
      nombre_destinatario: nombre_destinatario.trim(),
      frase_eslogan: frase_eslogan.trim(),
      detalle: detalle?.trim(),
      anos_servicio,
      fecha_evento: fecha_evento?.trim(),
      today,
    };

    let image: { base64: string; mimeType: string };
    try {
      image = await generateCorporateCardImage(datos);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: msg }], isError: true };
    }

    const slug = nombre_destinatario.trim().split(/\s+/).slice(0, 2).join("-");
    const { dir, fullPath, file } = outputCardPath(tipo, today, image.mimeType, slug);
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, Buffer.from(image.base64, "base64"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: `Error guardando imagen: ${msg}` }], isError: true };
    }

    const emailCfg = resolveEmailConfig();
    let emailStatus = "";
    if (emailCfg) {
      const asuntoMap: Record<string, string> = {
        aniversario: anos_servicio
          ? `Feliz Aniversario — ${nombre_destinatario} · ${anos_servicio} años`
          : `Feliz Aniversario — ${nombre_destinatario}`,
        reconocimiento: `Reconocimiento — ${nombre_destinatario}${detalle ? ` · ${detalle}` : ""}`,
        invitacion: `Invitación — ${detalle ?? nombre_destinatario}`,
        descuento: `Oferta Especial — ${detalle ?? nombre_destinatario}`,
      };
      const asunto = asuntoMap[tipo] ?? `Tarjeta corporativa — ${nombre_destinatario}`;
      try {
        await sendCardEmail({
          config: emailCfg,
          asunto,
          imageBase64: image.base64,
          imageMimeType: image.mimeType,
          imageFileName: file,
        });
        emailStatus = `\nCorreo enviado a: ${emailCfg.toEmail}`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        emailStatus = `\nCorreo: error al enviar — ${msg}`;
      }
    }

    const summary = [
      `Tipo: ${tipo}`,
      `Destinatario: ${nombre_destinatario}`,
      `Imagen guardada en: ${fullPath}`,
      emailStatus,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [
        { type: "text", text: summary },
        { type: "image", data: image.base64, mimeType: image.mimeType },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
