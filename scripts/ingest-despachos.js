/* ════════════════════════════════════════════════════════════════════════════
 * ingest-despachos.js — alimenta el ledger `despachos_diarios` de Supabase
 * ════════════════════════════════════════════════════════════════════════════
 * Convierte el acumulado `salidas` de Inventario.xlsx en unidades despachadas
 * POR DÍA Y POR SKU, comparando el archivo contra su versión anterior.
 *
 * Ver supabase/security/despachos-diarios.sql para el porqué y la validación.
 *
 * Uso:
 *   node scripts/ingest-despachos.js --backfill   → recorre TODO el historial de
 *                                                   Git de Inventario.xlsx
 *   node scripts/ingest-despachos.js              → solo el último tramo
 *                                                   (HEAD vs archivo de trabajo)
 *
 * Salida: imprime un resumen auditable y escribe el SQL de carga en
 *         despachos-carga.sql (upsert idempotente: se puede correr dos veces).
 *         NO toca Supabase — el SQL se revisa y se ejecuta a mano.
 *
 * Requiere: node_modules/xlsx (ya está en el repo) y correr desde la raíz.
 * ════════════════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const XLSX = require("xlsx");

const ROOT = path.resolve(__dirname, "..");
const ARCHIVO = "Inventario.xlsx";
const SALIDA_SQL = path.join(ROOT, "despachos-carga.sql");

// ── Filtros de universo (idénticos a los de index.app.js) ────────────────────
// Se sigue exactamente el mismo criterio que usa el dashboard para construir
// invCasco; si aquí entrara otro universo, la rotación no cuadraría con la tabla.
const MARCAS = ["ICH"];
const marcaDe = (desc) => {
  const p = String(desc || "").trim().split(/\s+/);
  return p.length >= 3 ? p[2].toUpperCase() : "";
};
const esEXPO = (d) => (d || "").toUpperCase().includes("EXPO");
const toNum = (x) => {
  const n = parseFloat(String(x).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
};

/* Llave de lote físico. NO incluye `ubicacion` a propósito: el CEDI mueve pallets
 * altura↔piso constantemente y, si la ubicación formara parte de la llave, cada
 * reubicación se leería como "lote consumido". Medido: infla el total +222%. */
const lLote = (r) =>
  [r["Orden"], r["Referencia"], r["cajap"]].map((x) => String(x).trim()).join("|");

/** Lee un .xlsx de inventario y devuelve el estado por lote de los SKUs del universo. */
function leerSnapshot(buffer) {
  let wb;
  try {
    wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch (e) {
    return null; // blob corrupto o no-xlsx: se salta, no se inventa dato
  }
  const hoja = wb.SheetNames.find((n) => n.toUpperCase().includes("INVXUBI")) || wb.SheetNames[0];
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { range: 5, defval: "" });
  if (!filas.length) return null;
  // Exports viejos del WMS no traían entradas/salidas: se descartan explícitamente
  // en vez de asumir 0 (asumir 0 fabricaría despachos falsos al comparar).
  const cols = Object.keys(filas[0]);
  if (!cols.includes("salidas") || !cols.includes("Orden") || !cols.includes("cajap")) return null;

  const lotes = new Map();
  for (const r of filas) {
    if (String(r["Linea"] || "").trim() !== "CASCO") continue;
    const desc = String(r["Descripcion"] || "");
    if (!MARCAS.includes(marcaDe(desc)) || esEXPO(desc)) continue;
    const ref = String(r["Referencia"] || "").trim();
    if (!ref) continue;
    lotes.set(lLote(r), { ref, salidas: toNum(r["salidas"]), saldo: toNum(r["saldo"]) });
  }
  return lotes;
}

/**
 * Despachos entre dos snapshots consecutivos.
 * Devuelve {porSKU, dSobrevive, dAgotado, dNuevoIgnorado} para poder auditar de
 * dónde salió cada unidad — sin ese desglose es imposible detectar si un cambio
 * de criterio del WMS empezó a inflar el conteo.
 */
function despachosEntre(prev, cur) {
  const porSKU = {};
  let dSobrevive = 0, dAgotado = 0, dNuevoIgnorado = 0;
  const sumar = (ref, u) => { if (u > 0) porSKU[ref] = (porSKU[ref] || 0) + u; };

  for (const [k, lp] of prev) {
    const lc = cur.get(k);
    if (lc) {
      // Lote que sigue vivo: el avance de su acumulado es despacho real y exacto.
      const d = lc.salidas - lp.salidas;
      if (d > 0) { sumar(lp.ref, d); dSobrevive += d; }
    } else {
      // Lote que desapareció: se consumió por completo. Su saldo restante salió.
      // (Estimación: si el WMS cambia el `Orden` al reubicar, aquí entraría ruido.
      //  Por eso se audita aparte — si dAgotado se dispara, revisar la llave.)
      if (lp.saldo > 0) { sumar(lp.ref, lp.saldo); dAgotado += lp.saldo; }
    }
  }
  // Lote nuevo que YA aparece con salidas: no se sabe CUÁNDO ocurrieron esos
  // picks (pudieron ser de antes de la ventana), así que NO se cuentan. Contarlos
  // sería inventar despachos con fecha equivocada.
  for (const [k, lc] of cur) {
    if (!prev.has(k) && lc.salidas > 0) dNuevoIgnorado += lc.salidas;
  }
  return { porSKU, dSobrevive, dAgotado, dNuevoIgnorado };
}

// ── Recolección de snapshots ─────────────────────────────────────────────────
function snapshotsDeGit() {
  const log = execSync(
    `git log --follow --format='%H|%ad' --date=format:'%Y-%m-%d %H:%M' -- ${ARCHIVO}`,
    { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
  ).trim();
  if (!log) return [];
  const out = [];
  const vistos = new Set();
  for (const linea of log.split("\n")) {
    const [commit, fechaHora] = linea.replace(/'/g, "").split("|");
    let blob = "";
    try {
      blob = execSync(`git ls-tree ${commit} -- ${ARCHIVO}`, { cwd: ROOT, encoding: "utf8" })
        .trim().split(/\s+/)[2] || "";
    } catch (_) { continue; }
    if (!blob || vistos.has(blob)) continue;  // dedupe: commits que no cambiaron el archivo
    vistos.add(blob);
    out.push({ commit, blob, fecha: fechaHora.slice(0, 10), fechaHora });
  }
  return out.reverse(); // cronológico: del más viejo al más reciente
}

function main() {
  const backfill = process.argv.includes("--backfill");
  const serie = [];

  if (backfill) {
    console.log("Modo BACKFILL — recorriendo historial de Git...\n");
    for (const s of snapshotsDeGit()) {
      const buf = execSync(`git cat-file blob ${s.blob}`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
      const lotes = leerSnapshot(buf);
      if (!lotes) { console.log(`  · ${s.fecha} ${s.commit.slice(0, 7)} → sin columnas salidas/Orden, se salta`); continue; }
      serie.push({ fecha: s.fecha, lotes });
    }
  } else {
    console.log("Modo INCREMENTAL — HEAD vs archivo de trabajo\n");
    const bufHead = execSync(`git show HEAD:${ARCHIVO}`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
    const lotesHead = leerSnapshot(bufHead);
    const lotesHoy = leerSnapshot(fs.readFileSync(path.join(ROOT, ARCHIVO)));
    if (!lotesHead || !lotesHoy) {
      console.error("ERROR: alguno de los dos archivos no trae columnas salidas/Orden/cajap.");
      process.exit(1);
    }
    const hoy = new Date().toISOString().slice(0, 10);
    serie.push({ fecha: "HEAD", lotes: lotesHead }, { fecha: hoy, lotes: lotesHoy });
  }

  if (serie.length < 2) {
    console.error("ERROR: se necesitan al menos 2 snapshots comparables. No se generó SQL.");
    process.exit(1);
  }

  // Un snapshot por día (el último del día = estado de cierre)
  const porDia = new Map();
  for (const s of serie) porDia.set(s.fecha, s);
  const dias = [...porDia.values()];

  const filas = [];   // {fecha, ref, unidades}
  let tS = 0, tA = 0, tN = 0;
  for (let i = 1; i < dias.length; i++) {
    const { porSKU, dSobrevive, dAgotado, dNuevoIgnorado } = despachosEntre(dias[i - 1].lotes, dias[i].lotes);
    tS += dSobrevive; tA += dAgotado; tN += dNuevoIgnorado;
    const total = Object.values(porSKU).reduce((a, b) => a + b, 0);
    console.log(`  ${dias[i - 1].fecha} → ${dias[i].fecha}: ${Object.keys(porSKU).length} SKUs, ${Math.round(total)} u`);
    for (const [ref, u] of Object.entries(porSKU)) filas.push({ fecha: dias[i].fecha, ref, unidades: u });
  }

  const totalU = filas.reduce((t, f) => t + f.unidades, 0);
  console.log("\n=== DESGLOSE AUDITABLE ===");
  console.log(`  lotes vivos (Δsalidas, exacto) : ${Math.round(tS)} u`);
  console.log(`  lotes agotados (estimado)      : ${Math.round(tA)} u`);
  console.log(`  lotes nuevos con picks previos : ${Math.round(tN)} u  (IGNORADOS a propósito)`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  TOTAL a cargar                 : ${Math.round(totalU)} u en ${filas.length} filas`);
  if (tA > tS * 4) {
    console.log("\n  ⚠ 'lotes agotados' domina el total. Puede que el WMS esté cambiando");
    console.log("    el campo Orden al reubicar. Revisar la llave antes de publicar.");
  }

  // ── SQL de carga (upsert idempotente) ──────────────────────────────────────
  const esc = (s) => String(s).replace(/'/g, "''");
  const lineas = [
    "-- Generado por scripts/ingest-despachos.js — revisar antes de ejecutar.",
    `-- ${filas.length} filas · ${Math.round(totalU)} u · generado desde ${dias[0].fecha} hasta ${dias[dias.length - 1].fecha}`,
    "begin;",
  ];
  // En lotes de 500 para no pasarse del límite de tamaño de sentencia del editor SQL.
  for (let i = 0; i < filas.length; i += 500) {
    const chunk = filas.slice(i, i + 500);
    lineas.push("insert into public.despachos_diarios (fecha, ref, unidades, metodo) values");
    lineas.push(
      chunk.map((f) => `  ('${f.fecha}', '${esc(f.ref)}', ${f.unidades}, 'salidas_wms')`).join(",\n") +
      "\non conflict (fecha, ref) do update set unidades = excluded.unidades, actualizado_en = now();"
    );
  }
  lineas.push("commit;");
  fs.writeFileSync(SALIDA_SQL, lineas.join("\n") + "\n");
  console.log(`\nSQL escrito en: ${path.relative(ROOT, SALIDA_SQL)}`);
  console.log("Revisar y ejecutar en Supabase → SQL Editor. No se tocó la base.");
}

main();
