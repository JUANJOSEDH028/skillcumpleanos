# skillcumpleanos

Servidor MCP para Claude Desktop: lee un Excel con colaboradores, detecta cumpleañeros del día y genera una **tarjeta vertical** usando la API de OpenAI según el caso:

| API (guía [Images and vision](https://developers.openai.com/api/docs/guides/images)) | Uso en este proyecto |
| ------------------------------------------------------------------------------------ | -------------------- |
| **Image API** (`client.images.generate`) | **Por defecto** — modelo **`gpt-image-2`** (y fallbacks). |
| **Responses API** (`client.responses.create` + `tools: [{ type: "image_generation" }]`) | Opcional con `OPENAI_IMAGE_BACKEND=responses` — la imagen sale en `output` como ítems `image_generation_call` → `result` (base64), igual que en la [documentación](https://developers.openai.com/api/docs/guides/images). |

El prompt prioriza **texto legible**; los modelos de difusión a veces alucinan letras: si hace falta tipografía perfecta, conviene post-proceso (Canva/PowerPoint) con la misma imagen de fondo.

> GPT Image (`gpt-image-2`, etc.) puede exigir [verificación de organización](https://help.openai.com/en/articles/10910291-api-organization-verification) en la consola de OpenAI.

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior
- Cuenta en [OpenAI Platform](https://platform.openai.com/api-keys) con API key y facturación / límites para **Image generation**

## Instalación en 5 pasos

1. **Obtén tu API key** en [OpenAI API keys](https://platform.openai.com/api-keys).

2. **Abre** el archivo de configuración de Claude Desktop:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

3. **Pega** (o fusiona) el bloque siguiente dentro de `"mcpServers"`:

```json
"skillcumpleanos": {
  "command": "npx",
  "args": ["-y", "github:JUANJOSEDH028/skillcumpleanos"],
  "env": {
    "OPENAI_API_KEY": "PEGA_AQUI_TU_API_KEY",
    "CUMPLEANOS_TZ": "America/Bogota"
  }
}
```

4. **Reinicia** Claude Desktop para que cargue el servidor MCP.

5. **Pídele a Claude** que use la skill, por ejemplo: *“Usa skillcumpleanos con el archivo `C:\ruta\lista.xlsx`”*. Claude debe llamar primero a `obtener_cumpleaneros_hoy` y, si hay personas, redactar la frase y llamar a `generar_tarjeta_cumpleanos`.

### Ejemplo completo de `mcpServers`

```json
{
  "mcpServers": {
    "skillcumpleanos": {
      "command": "npx",
      "args": ["-y", "github:JUANJOSEDH028/skillcumpleanos"],
      "env": {
        "OPENAI_API_KEY": "PEGA_AQUI_TU_API_KEY",
        "CUMPLEANOS_TZ": "America/Bogota"
      }
    }
  }
}
```

## Excel esperado

Primera hoja. Puedes usar **cualquiera** de estos conjuntos de encabezados (mayúsculas/espacios se ignoran en el nombre de la columna al comparar):

**Opción A (snake_case):** `nombre`, `fecha_nacimiento`, `cargo`

**Opción B (camelCase):** `nombreCompleto`, `fechaNacimiento`, `nombreCargo`

| nombreCompleto | fechaNacimiento | nombreCargo |
|----------------|-----------------|---------------|
| Ana Pérez | 12/05/1990 | Desarrollo |

- Fecha: texto **`DD/MM/AAAA`** (día/mes), **`DD-MM-AAAA`**, **`AAAA-MM-DD`**, **`DD/MM/AA`**, celda tipo fecha en Excel, o ISO con hora (`AAAA-MM-DDTHH:mm...`). Si Excel muestra `12/5/1990 0:00:00`, también se entiende. Las celdas **fecha** en medianoche UTC (típico de Excel) se **normalizan** al día civil correcto y se compara mes/día con hoy (incluye lógica local y UTC en la comparación).
- No necesitas convertir las fechas a texto: las celdas **datetime** de Excel se interpretan con el **número serial** y, si hace falta, el **texto que muestra Excel**.

## Dónde se guardan las imágenes

Por defecto: `%USERPROFILE%\cumpleanos\` en Windows, `~/cumpleanos/` en macOS/Linux, con estructura `YYYY/mes_en_minusculas/DD.png` (u otra extensión si usas `OPENAI_IMAGE_OUTPUT_FORMAT` distinto de PNG, p. ej. `DD.jpg`).

Para otra carpeta base, define la variable de entorno `CUMPLEANOS_ROOT` en el mismo bloque `env` del JSON.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `OPENAI_API_KEY` | Sí | API key de OpenAI (acceso a generación de imágenes) |
| `CUMPLEANOS_ROOT` | No | Carpeta base en lugar del home del usuario |
| `CUMPLEANOS_TZ` | No | Zona IANA para “hoy” y comparación de cumpleaños. Por defecto **`America/Bogota`** (UTC-5, Bogotá/Lima). Ejemplo alternativo: `America/Lima` |
| `OPENAI_IMAGE_BACKEND` | No | **`images`** (por defecto): [Image API](https://developers.openai.com/api/docs/api-reference/images) — `client.images.generate`. **`responses`**: [Responses API](https://developers.openai.com/api/docs/api-reference/responses) — `client.responses.create` con `tools` que incluyen `image_generation`. |
| `OPENAI_RESPONSES_MODEL` | No | Solo si `OPENAI_IMAGE_BACKEND=responses`. Modelo de la petición Responses (orquesta la herramienta). Por defecto **`gpt-4.1-mini`** (como en la guía); puedes usar p. ej. **`gpt-5.5`** si tu cuenta lo admite. |
| `OPENAI_RESPONSES_TOOL` | No | Solo Responses: **`minimal`** → solo `{ "type": "image_generation" }` como en la guía. Cualquier otro valor o vacío → herramienta **extendida** (`model`, `quality`, `size`, `output_format`, etc.). En modo minimal se ignoran los campos extra de la herramienta. |
| `OPENAI_IMAGE_MODEL` | No | **Image API:** orden de prueba por defecto: **`gpt-image-2`**, `gpt-image-1.5`, `dall-e-3`, `dall-e-2`. Fija uno para forzar. **Responses API:** modelo de imagen en la herramienta (p. ej. **`gpt-image-2`**). |
| `OPENAI_IMAGE_SIZE` | No | Tamaño `WIDTHxHEIGHT` o **`auto`** según [guía de imágenes](https://platform.openai.com/docs/guides/images). Por defecto: **`1024x1536`** (retrato) para GPT Image, **`1024x1792`** para DALL·E 3, **`1024x1024`** para DALL·E 2. |
| `OPENAI_IMAGE_QUALITY` | No | **GPT Image:** `low`, `medium`, **`high`** (defecto si no coincide), `auto`. **DALL·E 3:** `hd` o `standard`. |
| `OPENAI_IMAGE_OUTPUT_FORMAT` | No | Solo GPT Image en Image API / tool: **`png`**, `jpeg`, `webp`. Por defecto **png**. |
| `OPENAI_IMAGE_MODERATION` | No | Solo GPT Image: **`auto`** o `low`. |
| `OPENAI_IMAGE_OUTPUT_COMPRESSION` | No | Solo con `jpeg`/`webp`: número **0–100** (compresión de salida). |

## Timeouts (error MCP `-32001: Request timed out`)

Ese código lo devuelve el **cliente MCP** (Cursor, Claude Desktop, etc.) cuando deja de esperar la respuesta de la herramienta. **`generar_tarjeta_cumpleanos`** no termina hasta que OpenAI devuelve la imagen; con **GPT Image** la guía oficial indica que prompts complejos pueden tardar **varios minutos**, así que un límite corto (p. ej. **60 s**) dispara el timeout aunque el servidor siga trabajando.

### 1. Aumentar el timeout del cliente (Cursor)

En Cursor: **Settings → buscar “MCP”** o abre **Settings (JSON)** y prueba valores en **milisegundos** (ej. **10 minutos = 600000**), según la versión de Cursor:

```json
"mcp.server.timeout": 600000,
"mcp.elicitation.timeout": 600000
```

Guarda, **recarga la ventana** (`Developer: Reload Window`) y vuelve a probar. Los nombres exactos pueden variar entre versiones; si no surten efecto, revisa la documentación o el foro de Cursor para tu build.

### 2. Claude Desktop y Claude Cowork

**Claude Cowork** usa el mismo cliente MCP que **Claude Desktop** (stdio / conectores). Hoy **no hay un control en la interfaz de Cowork** para alargar el tiempo de espera de una herramienta MCP.

- Puedes probar en **`claude_desktop_config.json`** un campo **`timeout`** en milisegundos junto al servidor (p. ej. `"timeout": 300000`), pero en muchas versiones **sigue sin aplicarse** al RPC de herramientas y el fallo ~60 s continúa; depende del build de la app.
- Si no puedes subir el límite, usa el **apartado 3** (modelo/calidad más rápidos) o genera la tarjeta **fuera de Cowork** (por ejemplo `node dist/index.js` en local o un script que llame a la misma lógica).

### 3. Hacer la generación más rápida (mismo MCP, sin tocar el IDE)

En el `env` del servidor:

- **`OPENAI_IMAGE_MODEL=dall-e-3`** (suele responder antes que `gpt-image-2` en muchos casos; retrato `1024x1792` con `OPENAI_IMAGE_QUALITY=standard` si quieres ahorrar).
- Para GPT Image: **`OPENAI_IMAGE_QUALITY=low`** o **`medium`**, y tamaño moderado (p. ej. **`1024x1024`** o **`1024x1536`** según [guía de imágenes](https://platform.openai.com/docs/guides/images)).
- **`OPENAI_IMAGE_OUTPUT_FORMAT=jpeg`** puede reducir latencia respecto a PNG en modelos que lo admitan.

## Desarrollo local

```bash
git clone https://github.com/JUANJOSEDH028/skillcumpleanos.git
cd skillcumpleanos
npm install
npm run build
```

En `claude_desktop_config.json` puedes apuntar al código local:

```json
"skillcumpleanos": {
  "command": "node",
  "args": ["C:\\ruta\\completa\\a\\skillcumpleanos\\dist\\index.js"],
  "env": {
    "OPENAI_API_KEY": "tu_key"
  }
}
```

## Código fuente

[https://github.com/JUANJOSEDH028/skillcumpleanos](https://github.com/JUANJOSEDH028/skillcumpleanos)

## Licencia

MIT
