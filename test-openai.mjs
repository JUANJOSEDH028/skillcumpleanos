/**
 * Script de prueba rápida: verifica API key y generación de imagen.
 * Uso: node test-openai.mjs <tu-api-key>
 *   o: OPENAI_API_KEY=sk-... node test-openai.mjs
 */
import OpenAI from "openai";
import fs from "node:fs/promises";
import path from "node:path";

const apiKey = process.argv[2] || process.env.OPENAI_API_KEY;

if (!apiKey || !apiKey.startsWith("sk-")) {
  console.error("❌ Pasa la API key como argumento: node test-openai.mjs sk-...");
  console.error("   o define la variable de entorno OPENAI_API_KEY");
  process.exit(1);
}

const client = new OpenAI({ apiKey });

// ── PASO 1: Verificar que la API key es válida ─────────────────────────────
console.log("\n🔑 Paso 1: Verificando API key...");
try {
  const models = await client.models.list();
  const imageModels = models.data
    .filter((m) => m.id.includes("dall-e") || m.id.includes("gpt-image") || m.id.includes("chatgpt-image"))
    .map((m) => m.id)
    .sort();
  console.log("✅ API key válida.");
  console.log(
    "   Modelos de imagen disponibles:",
    imageModels.length ? imageModels.join(", ") : "(ninguno visible en /models)"
  );
} catch (e) {
  console.error("❌ API key inválida o sin acceso:", e.message);
  process.exit(1);
}

// ── PASO 2: Generación rápida con gpt-image-1-mini (más veloz) ─────────────
console.log("\n🖼️  Paso 2: Generando imagen rápida con gpt-image-1-mini...");
let paso2ok = false;
const t0 = Date.now();
try {
  const resp = await client.images.generate({
    model: "gpt-image-1-mini",
    prompt: "A simple birthday card with the text Happy Birthday, white background, clean design.",
    n: 1,
    size: "1024x1024",
    quality: "low",
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const b64 = resp.data?.[0]?.b64_json;
  if (!b64) throw new Error("Respuesta sin b64_json");

  const outFile = path.join(process.cwd(), "test-output-mini.png");
  await fs.writeFile(outFile, Buffer.from(b64, "base64"));
  console.log(`✅ gpt-image-1-mini OK en ${elapsed}s → ${outFile}`);
  paso2ok = true;
} catch (e) {
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.warn(`⚠️  gpt-image-1-mini falló (${elapsed}s): ${e.message}`);
}

// ── PASO 3: Verificar acceso a gpt-image-2 (el que usa el MCP por defecto) ─
console.log("\n🚀 Paso 3: Probando gpt-image-2 con quality=low (puede tardar 30-90s)...");
const t1 = Date.now();
try {
  const resp = await client.images.generate({
    model: "gpt-image-2",
    prompt: "A simple birthday card, white background, the text: Feliz Cumpleaños.",
    n: 1,
    size: "1024x1024",
    quality: "low",
    output_format: "png",
  });

  const elapsed = ((Date.now() - t1) / 1000).toFixed(1);
  const b64 = resp.data?.[0]?.b64_json;
  if (!b64) throw new Error("Respuesta sin b64_json");

  const outFile = path.join(process.cwd(), "test-output-gptimage2.png");
  await fs.writeFile(outFile, Buffer.from(b64, "base64"));
  console.log(`✅ gpt-image-2 OK en ${elapsed}s → ${outFile}`);
} catch (e) {
  const elapsed = ((Date.now() - t1) / 1000).toFixed(1);
  console.error(`❌ gpt-image-2 falló (${elapsed}s): ${e.message}`);
}

console.log("\n✅ Prueba completada.");
