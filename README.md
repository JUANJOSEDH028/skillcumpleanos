# skillcumpleanos

Servidor MCP para Claude Desktop: lee un Excel con colaboradores, detecta cumpleañeros del día y genera una **tarjeta PNG vertical** (Imagen / Gemini). El prompt prioriza **texto legible**; los modelos de difusión a veces alucinan letras: si hace falta calidad de tipografía perfecta, conviene post-proceso (Canva/PowerPoint) con la misma imagen de fondo.

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
    "GEMINI_API_KEY": "PEGA_AQUI_TU_API_KEY",
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
        "GEMINI_API_KEY": "PEGA_AQUI_TU_API_KEY",
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

Por defecto: `%USERPROFILE%\cumpleanos\` en Windows, `~/cumpleanos/` en macOS/Linux, con estructura `YYYY/mes_en_minusculas/DD.png` (ejemplo: `2026/mayo/12.png`).

Para otra carpeta base, define la variable de entorno `CUMPLEANOS_ROOT` en el mismo bloque `env` del JSON.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `GEMINI_API_KEY` | Sí | API key de Google AI / Gemini |
| `CUMPLEANOS_ROOT` | No | Carpeta base en lugar del home del usuario |
| `CUMPLEANOS_TZ` | No | Zona IANA para “hoy” y comparación de cumpleaños. Por defecto **`America/Bogota`** (UTC-5, Bogotá/Lima). Ejemplo alternativo: `America/Lima` |
| `GEMINI_IMAGE_MODEL` | No | Por defecto prueba: `imagen-4.0-generate-001`, `imagen-4.0-fast-generate-001`, `imagen-4.0-ultra-generate-001`. Fuerza un modelo concreto si tu cuenta solo tiene uno habilitado |
| `GEMINI_IMAGE_SIZE` | No | Solo **1K** o **2K** (requisito de Imagen 4 generate/ultra). Por defecto **2K**. El modelo **fast** ignora este parámetro (la API no permite ajustarlo) |

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
