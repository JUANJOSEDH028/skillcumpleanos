# skillcumpleanos

Servidor MCP para Claude Desktop: lee un Excel con colaboradores, detecta cumpleañeros del día y genera una tarjeta PNG festiva con la API de Gemini. La frase motivacional la escribe Claude en el chat (no hace falta otra API key).

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior
- Cuenta en [Google AI Studio](https://aistudio.google.com/apikey) con API key de Gemini

## Instalación en 5 pasos

1. **Obtén tu API key** de Gemini en [Google AI Studio](https://aistudio.google.com/apikey).

2. **Abre** el archivo de configuración de Claude Desktop:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

3. **Pega** (o fusiona) el bloque siguiente dentro de `"mcpServers"`:

```json
"skillcumpleanos": {
  "command": "npx",
  "args": ["-y", "github:JUANJOSEDH028/skillcumpleanos"],
  "env": {
    "GEMINI_API_KEY": "PEGA_AQUI_TU_API_KEY"
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
        "GEMINI_API_KEY": "PEGA_AQUI_TU_API_KEY"
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

- Fecha: texto **`DD/MM/AAAA`** (día/mes), **`DD-MM-AAAA`**, **`AAAA-MM-DD`**, **`DD/MM/AA`**, celda tipo fecha en Excel, o ISO con hora (`AAAA-MM-DDTHH:mm...`). Si Excel muestra `12/5/1990 0:00:00`, también se entiende. Las celdas **fecha** de Excel a veces vienen en UTC: el servidor compara también por día/mes en UTC para no perder el 12 de mayo (u otro día) por desfase horario.
- Si una fila repite los **títulos** de columna como datos (p. ej. la palabra `nombreCompleto` en la celda de nombre), se omite al contar.

## Dónde se guardan las imágenes

Por defecto: `%USERPROFILE%\cumpleanos\` en Windows, `~/cumpleanos/` en macOS/Linux, con estructura `YYYY/mes_en_minusculas/DD.png` (ejemplo: `2026/mayo/12.png`).

Para otra carpeta base, define la variable de entorno `CUMPLEANOS_ROOT` en el mismo bloque `env` del JSON.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `GEMINI_API_KEY` | Sí | API key de Google AI / Gemini |
| `CUMPLEANOS_ROOT` | No | Carpeta base en lugar del home del usuario |
| `GEMINI_IMAGE_MODEL` | No | Si no la defines, prueba en orden: `imagen-4.0-generate-001`, `imagen-4.0-fast-generate-001`, `imagen-4.0-ultra-generate-001`, luego modelos Imagen 3 si existen. Con esta variable fuerzas uno solo (el que liste tu cuenta en [AI Studio](https://aistudio.google.com/)) |

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
    "GEMINI_API_KEY": "tu_key"
  }
}
```

## Código fuente

[https://github.com/JUANJOSEDH028/skillcumpleanos](https://github.com/JUANJOSEDH028/skillcumpleanos)

## Licencia

MIT
