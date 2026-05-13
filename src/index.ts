#!/usr/bin/env node
import "./tz-default.js";
import fs from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { readCumpleanerosHoy } from "./excel.js";
import { generateBirthdayCardImage } from "./openai-image.js";
import { resolveEmailConfig, sendBirthdayEmail } from "./email-graph.js";
import { localDateKey, outputImagePath, formatTodaySpanish } from "./paths.js";
import { readLastPhrase, writeLastPhrase } from "./phrase-store.js";

const INSTRUCTIONS = `Skill cumpleaños: primero usa la herramienta obtener_cumpleaneros_hoy con la ruta del Excel. Si hay cumpleañeros, escribe en español una frase motivacional breve (máximo dos líneas), positiva y distinta de la última frase indicada si aplica. Luego llama generar_tarjeta_cumpleanos con la misma ruta y la frase. Si no hay cumpleañeros, responde de forma amigable sin generar imagen.`;

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
