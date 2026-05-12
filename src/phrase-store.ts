import fs from "node:fs/promises";
import path from "node:path";
import { metaDir } from "./paths.js";

export interface LastPhrase {
  /** Fecha local YYYY-MM-DD en que se usó la frase */
  fecha: string;
  frase: string;
}

const FILE = "lastPhrase.json";

export async function readLastPhrase(): Promise<LastPhrase | null> {
  try {
    const p = path.join(metaDir(), FILE);
    const raw = await fs.readFile(p, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (
      data &&
      typeof data === "object" &&
      "fecha" in data &&
      "frase" in data &&
      typeof (data as LastPhrase).fecha === "string" &&
      typeof (data as LastPhrase).frase === "string"
    ) {
      return data as LastPhrase;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeLastPhrase(fecha: string, frase: string): Promise<void> {
  const dir = metaDir();
  await fs.mkdir(dir, { recursive: true });
  const body: LastPhrase = { fecha, frase };
  await fs.writeFile(path.join(dir, FILE), JSON.stringify(body, null, 2), "utf8");
}
