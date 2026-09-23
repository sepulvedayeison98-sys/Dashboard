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
 *   node scripts/sync-lenta-rotacion.js <ruta-al-xlsx-descargado> [--aceptar-caida]
 *
 * Salida:
 *   - Código 0 y "CAMBIÓ" en stdout si reemplazó lenta-rotacion/data/inventario-siesa.xlsx
 *   - Código 0 y "SIN CAMBIOS" si el contenido era idéntico (no toca nada — evita
 *     commits vacíos)
 *   - Código 1 si el archivo no abre como Excel, le faltan columnas obligatorias,
 *     trae filas vacías en medio de los datos o sus filas caen más de 20 % frente
 *     al publicado (nunca reemplaza el archivo publicado con algo sospechoso;
 *     --aceptar-caida salta las dos últimas comprobaciones)
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

// Mismo detector por alias que ALIAS/detectarMapeo() usa en
// DashboardLentaRotacion.jsx — si cambian los alias ahí, cambiarlos acá
// también. El export en vivo de SIESA trae encabezados en snake_case
// (bodega, id_item, marca, referencia_producto), no los nombres bonitos que
// documenta el README, así que la comparación es por alias + substring
// (igual que hace el dashboard), no por igualdad literal.
const norm = s => String(s == null ? "" : s)
  .toLowerCase()
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .replace(/\s+/g, " ")
  .trim();

const ALIAS_OBLIGATORIAS = {
  Bodega: ["bodega", "bodegas", "almacen", "centro", "cod bodega", "deposito"],
  Ítem: ["item", "items", "codigo item", "cod item", "sku", "codigo", "material"],
  Marca: ["marca", "marcas", "nombre marca", "marca producto", "desc marca"],
  Referencia: ["referencia", "referencias", "ref", "modelo", "cod referencia"],
};

function encontrarColumna(columnas, alias) {
  for (const a of alias) {
    const hit = columnas.find(c => norm(c) === a);
    if (hit) return hit;
  }
  for (const a of alias) {
    const hit = columnas.find(c => norm(c).includes(a));
    if (hit) return hit;
  }
  return null;
}

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

  const faltantes = Object.entries(ALIAS_OBLIGATORIAS)
    .filter(([, alias]) => !encontrarColumna(columnas, alias))
    .map(([nombre]) => nombre);
  if (faltantes.length) {
    fallar(
      `faltan columnas obligatorias: ${faltantes.join(", ")} ` +
      `(encontradas: ${columnas.filter(Boolean).join(", ") || "ninguna"})`
    );
  }

  const filas = matrix.length - hIdx - 1;
  const hashSha = buf => crypto.createHash("sha256").update(buf).digest("hex");

  // Guarda de integridad: una reconstrucción incompleta del volcado de
  // SharePoint dejó 15.451 filas en blanco y solo 10.000 con datos (23-sep),
  // y pasó la validación de encabezados. Se rechaza antes de publicar.
  const aceptarCaida = process.argv.includes("--aceptar-caida");
  const conBlancas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true });
  const vacias = conBlancas.length - matrix.length;
  if (vacias > 0 && !aceptarCaida) {
    fallar(`${vacias} filas vacías dentro del rango de datos (${filas} con datos) — ` +
      `reconstrucción incompleta, no se publica (usar --aceptar-caida si es legítimo)`);
  }
  if (fs.existsSync(DESTINO) && !aceptarCaida) {
    const wbPub = XLSX.read(fs.readFileSync(DESTINO));
    const wsPub = wbPub.Sheets[wbPub.SheetNames[0]];
    const filasPub = XLSX.utils.sheet_to_json(wsPub, { header: 1, defval: null, blankrows: false }).length - 1;
    if (filasPub > 0 && filas < filasPub * 0.8) {
      fallar(`las filas con datos caen de ${filasPub} (publicado) a ${filas} (nuevo), más de 20 % — ` +
        `no se publica (usar --aceptar-caida si es legítimo)`);
    }
  }

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
  console.log(`  obligatorias presentes: ${Object.keys(ALIAS_OBLIGATORIAS).join(", ")}`);
}

main();
