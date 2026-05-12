# 📋 Historia de Usuario — Skill Cumpleaños

---

## Identificación

| Campo | Detalle |
|---|---|
| **ID** | SKL-001 |
| **Nombre** | Generación automática de tarjeta de cumpleaños diaria |
| **Épica** | Skills distribuibles para Claude Desktop |
| **Versión** | 2.0 |

---

## Historia

> **Como** usuario de Claude Desktop/Cowork,
> **quiero** ejecutar `/skillcumpleaños` pasando la ruta de un archivo Excel con nombres, cargos y fechas de nacimiento,
> **para** obtener automáticamente una tarjeta de cumpleaños visual del día, con los cumpleañeros de hoy, una frase motivacional generada por IA, y que quede guardada organizadamente en mi computador.

---

## Contexto

En empresas como Laproff, reconocer los cumpleaños de los colaboradores es parte de la cultura organizacional. Actualmente este proceso es manual: alguien revisa una lista, diseña una tarjeta y la comparte. Esta skill automatiza todo ese flujo desde Claude Desktop con un solo comando diario.

---

## Parámetros de entrada

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `archivo` | Ruta `.xlsx` | ✅ | Ruta al archivo Excel con la lista de colaboradores |

### Estructura esperada del Excel

| nombre | fecha_nacimiento | cargo |
|---|---|---|
| Jorge Andres Penagos Mora | 12/05/1985 | Operario de Producción |
| Miriam Stella Molina Gil | 12/05/1979 | Empresaria |

---

## Flujo del sistema

```
Usuario ejecuta /skillcumpleaños --archivo="ruta/archivo.xlsx"
        ↓
MCP lee y valida el Excel
        ↓
Filtra colaboradores cuyo día y mes coincidan con HOY
        ↓
¿Hay cumpleañeros?
   ├── NO → Responde "No hay cumpleañeros hoy 🎉"
   └── SI →
         Genera frase motivacional aleatoria con Claude
                ↓
         Construye prompt para Gemini con:
         - Fecha de hoy
         - Nombres y cargos de cumpleañeros
         - Frase motivacional generada
                ↓
         Gemini genera imagen estilo tarjeta festiva
                ↓
         Guarda imagen en:
         /cumpleanos/2026/mayo/12.png
                ↓
         Devuelve imagen en el chat de Claude
```

---

## Criterios de Aceptación

### CA-01 — Invocación del comando
- El usuario puede invocar `/skillcumpleaños` desde Claude Desktop
- El comando recibe la ruta del archivo Excel como parámetro
- Si el archivo no existe o la ruta es inválida, retorna un mensaje de error claro

### CA-02 — Lectura del Excel
- El sistema lee correctamente archivos `.xlsx`
- Reconoce las columnas `nombre`, `fecha_nacimiento` y `cargo`
- Si el archivo tiene columnas faltantes, retorna un mensaje indicando cuáles faltan
- Soporta fechas en formato `DD/MM/YYYY`

### CA-03 — Filtrado por fecha
- Compara únicamente día y mes (ignora el año) con la fecha actual del sistema
- Si no hay cumpleañeros hoy, responde con mensaje amigable sin generar imagen
- Si hay uno o más cumpleañeros, continúa el flujo de generación

### CA-04 — Generación de frase motivacional
- La frase es generada por Claude en cada ejecución
- Varía cada día, no se repite la misma frase dos días consecutivos
- Tiene un tono positivo, breve (máximo 2 líneas) y en español

### CA-05 — Generación de imagen
- La imagen es generada por la API de Gemini
- Incluye: fecha del día, título "Feliz Cumpleaños", lista de cumpleañeros con nombre y cargo, frase motivacional
- El estilo visual es festivo (confeti, colores vivos, tipografía celebratoria)
- Formato de salida: PNG, resolución mínima 1080x1080px

### CA-06 — Almacenamiento organizado
- La imagen se guarda automáticamente en la ruta `/cumpleanos/YYYY/mes/DD.png`
- Ejemplo: `/cumpleanos/2026/mayo/12.png`
- Si la carpeta no existe, el sistema la crea automáticamente
- Si ya existe una imagen para esa fecha, la sobreescribe

### CA-07 — Respuesta en el chat
- Claude muestra la imagen generada directamente en el chat
- Muestra también los nombres de los cumpleañeros del día en texto
- Confirma la ruta donde fue guardada la imagen

### CA-08 — Instalación sin fricción
- El usuario solo necesita Node.js instalado
- La instalación se completa pegando un bloque JSON en `claude_desktop_config.json`
- El usuario configura su API Key de Gemini como variable de entorno

---

## Definition of Done

### Código
- [ ] Repositorio público en GitHub con el código fuente completo
- [ ] `package.json` configurado para funcionar con `npx` sin instalación previa
- [ ] Servidor MCP registrado y reconocido por Claude Desktop
- [ ] Prompt `/skillcumpleaños` invocable con su parámetro `--archivo`

### Funcionalidad
- [ ] Lectura correcta de archivos `.xlsx` con las 3 columnas definidas
- [ ] Filtrado correcto por día y mes respecto a la fecha actual
- [ ] Frase motivacional generada por Claude en cada ejecución
- [ ] Imagen generada por API de Gemini con el diseño festivo definido
- [ ] Imagen guardada en estructura de carpetas `/cumpleanos/YYYY/mes/DD.png`
- [ ] Imagen retornada y visible en el chat de Claude Desktop

### Calidad
- [ ] Manejo de errores para archivo no encontrado
- [ ] Manejo de errores para columnas faltantes en el Excel
- [ ] Manejo de errores para fallo en la API de Gemini
- [ ] Probado con lista de 1 cumpleañero
- [ ] Probado con lista de múltiples cumpleañeros el mismo día
- [ ] Probado con día sin cumpleañeros

### Distribución
- [ ] README en español con instrucciones en máximo 5 pasos
- [ ] Bloque JSON de configuración listo para copiar y pegar
- [ ] Instrucciones para configurar la API Key de Gemini
- [ ] Probado en una máquina limpia siguiendo solo el README

---

## Notas técnicas

| Componente | Tecnología |
|---|---|
| Servidor MCP | Node.js + SDK oficial MCP Anthropic |
| Lectura Excel | `xlsx` (librería npm) |
| Generación frase | Claude (interno al MCP) |
| Generación imagen | Google Gemini API |
| Distribución | GitHub + npx |
| Almacenamiento | Sistema de archivos local |