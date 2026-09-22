/* ════════════════════════════════════════════════════════════════════════════
 * sync-lenta-rotacion.js — coloca un Excel fresco de SIESA para el panel de
 * lenta rotación, validándolo antes de tocar el archivo que usa el dashboard.
 * ════════════════════════════════════════════════════════════════════════════
 * Este script NO habla con SharePoint. Solo la sesión de Claude que tiene el
 * conector de Microsoft 365 autorizado puede descargar el archivo; este script
 * recibe esa descarga ya guardada en disco y hace la parte determinista:
 * validar que es un Excel real con las columnas que el dashboard necesita, y
 * reemplazar el archivo publicado solo si el contenido cambió de verdad.
 *
 * Uso:
 *   node scripts/sync-lenta-rotacion.js <ruta-al-xlsx-descargado>
 *
 * Salida:
 *   - Código 0 y "CAMBIÓ" en stdout si reemplazó lenta-rotacion/data/inventario-siesa.xlsx
 *   - Código 0 y "SIN CAMBIOS" si el contenido era idéntico (no toca nada — evita
 *     commits vacíos)
 *   - Código 1 si el archivo no abre como Excel o le faltan columnas obligatorias
 *     (nunca reemplaza el archivo publicado con algo sospechoso)
 *
 * Requiere: node_modules/xlsx — si no está, correr `npm install` en la raíz
 * primero (no forma parte de la instalación por defecto del repo).
 * ════════════════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");

const ROOT = path.resolve(__dirname, "..");
const DESTINO = path.join(ROOT, "lenta-rotacion", "data", "inventario-siesa.xlsx");

// Mismas obligatorias que documenta lenta-rotacion/README.md — si el detector
// del dashboard no las encuentra, la carga falla ahí también. Se valida acá
// primero para no publicar un archivo que el dashboard va a rechazar.
const COLUMNAS_OBLIGATORIAS = ["Bodega", "Ítem", "Marca", "Referencia"];

function fallar(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function main() {
  const origen = process.argv[2];
  if (!origen) fallar("uso: node scripts/sync-lenta-rotacion.js <ruta-al-xlsx-descargado>");
  if (!fs.existsSync(origen)) fallar(`no existe el archivo: ${origen}`);

  const buf = fs.readFileSync(origen);

  // Blob corrupto o que no es un Excel real: se rechaza, no se inventa dato
  // (mismo criterio que scripts/ingest-despachos.js usa para Inventario.xlsx).
  let wb;
  try {
    wb = XLSX.read(buf, { cellDates: false });
  } catch (e) {
    fallar(`el archivo no abre como Excel válido (${e.message})`);
  }

  const hoja = wb.SheetNames[0];
  const ws = wb.Sheets[hoja];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  if (!matrix.length) fallar("el archivo abre pero no tiene filas");

  // Misma heurística de encabezado que ExcelDataSource en el dashboard: la
  // primera fila con 3+ celdas de texto no vacías.
  let hIdx = matrix.findIndex(r => r.filter(c => typeof c === "string" && c.trim()).length >= 3);
  if (hIdx < 0) hIdx = 0;
  const columnas = matrix[hIdx].map(c => (c == null ? "" : String(c).trim()));

  const faltantes = COLUMNAS_OBLIGATORIAS.filter(c => !columnas.includes(c));
  if (faltantes.length) {
    fallar(
      `faltan columnas obligatorias: ${faltantes.join(", ")} ` +
      `(encontradas: ${columnas.filter(Boolean).join(", ") || "ninguna"})`
    );
  }

  const filas = matrix.length - hIdx - 1;
  const hashSha = buf => crypto.createHash("sha256").update(buf).digest("hex");

  if (fs.existsSync(DESTINO)) {
    const actual = fs.readFileSync(DESTINO);
    if (hashSha(actual) === hashSha(buf)) {
      console.log(`SIN CAMBIOS — el contenido es idéntico al ya publicado (${filas} filas, hoja "${hoja}")`);
      process.exit(0);
    }
  }

  fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
  fs.writeFileSync(DESTINO, buf);
  console.log(`CAMBIÓ — publicado ${path.relative(ROOT, DESTINO)}`);
  console.log(`  hoja usada: "${hoja}"  ·  filas: ${filas}  ·  columnas: ${columnas.filter(Boolean).length}`);
  console.log(`  obligatorias presentes: ${COLUMNAS_OBLIGATORIAS.join(", ")}`);
}

main();
