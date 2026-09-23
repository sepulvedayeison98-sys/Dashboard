import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Treemap, AreaChart, Area, LabelList } from 'recharts';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Search, X, Database, Clock, Settings2, ChevronRight, Lock, Filter, ArrowUpDown, ArrowUp, ArrowDown, Layers, Package, Warehouse, Tag, TrendingUp, TrendingDown, Minus, Palette, Download, Globe, Boxes, Shapes } from 'lucide-react';
import ExcelJS from 'exceljs';
import { construirLibro, construirHTMLExcel } from './exportExcel.js';

/* ============================================================================
   CAPA 0 — DESIGN SYSTEM
   Tokens heredados del Dashboard Base (CEDI Live). Fuente única de color:
   ningún hex vive fuera de este objeto. La profundidad se construye apilando
   fondos bg0→bg3 con borde, no con sombra difusa.
   ==========================================================================*/

const C = {
  bg0: '#040c17', bg1: '#070f1c', bg2: '#0b1628', bg3: '#0f1e35',
  b0: '#152236', b1: '#1c3050',
  t1: '#eef2ff', t2: '#9db3cd', t3: '#8095b2', t4: '#637691',
  accent: '#38bdf8', green: '#10b981', yellow: '#f59e0b',
  orange: '#f97316', red: '#ef4444', purple: '#a78bfa', teal: '#2dd4bf',
  // Variantes "dim": mismo tono al 9 %, para fondos de badge sobre superficie oscura
  accentDim: 'rgba(56,189,248,0.09)', greenDim: 'rgba(16,185,129,0.09)',
  yellowDim: 'rgba(245,158,11,0.09)', orangeDim: 'rgba(249,115,22,0.09)',
  redDim: 'rgba(239,68,68,0.09)',
};

const FUENTE_UI = "'Inter', system-ui, -apple-system, sans-serif";
const FUENTE_DATO = "'JetBrains Mono', ui-monospace, monospace";

function EstilosGlobales() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700;800&display=swap');
      @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      @keyframes pulseAlerta { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); } 50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } }
      @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
      .fadeUp { animation: fadeUp .4s ease-out both; }
      .pulseAlerta { animation: pulseAlerta 2s infinite; }
      .blink { animation: blink 1s infinite; }
      .font-mono { font-family: ${FUENTE_DATO} !important; }
      ::-webkit-scrollbar { width: 9px; height: 9px; }
      ::-webkit-scrollbar-track { background: ${C.bg0}; }
      ::-webkit-scrollbar-thumb { background: ${C.b1}; border-radius: 5px; }
      ::-webkit-scrollbar-thumb:hover { background: ${C.t4}; }
      input, select { background: ${C.bg3}; color: ${C.t1}; border-color: ${C.b1}; }
      input::placeholder { color: ${C.t4}; }
      option { background: ${C.bg2}; color: ${C.t1}; }
    `}</style>
  );
}

/* ============================================================================
   CAPA 1 — DOMINIO
   Los rangos reutilizan los slots semánticos del sistema base: verde = ok,
   amarillo = preventivo, naranja = crítico, rojo = ruptura. Se redefinen las
   etiquetas, no la paleta.
   ==========================================================================*/

/* Escala de severidad. Los tonos anteriores (ámbar/naranja/rojo) quedaban
   demasiado juntos: naranja↔rojo daba ΔE 10,4 y amarillo↔naranja 9,6, ambos
   por debajo del piso de 15 en el que dos colores se distinguen con visión
   normal. Estos separan el amarillo hacia un tono más claro y llevan el +90
   hacia carmesí, alejándolo del naranja: naranja↔rojo sube a 16,3 y
   amarillo↔naranja a 25,1, y el conjunto también pasa la prueba de daltonismo. */
const SEV = {
  //           color        fondo suave (badges)          tinta del texto ENCIMA del color
  verde:   { c: '#10b981', dim: 'rgba(16,185,129,0.13)', sobre: '#04140d', claro: '#6ee7b7' },   // 0–30
  amarillo:{ c: '#fde047', dim: 'rgba(253,224,71,0.13)', sobre: '#3f2d02', claro: '#fef08a' },   // 30–60
  naranja: { c: '#f97316', dim: 'rgba(249,115,22,0.15)', sobre: '#ffffff', claro: '#fdba74' },   // 60–90
  carmesi: { c: '#e11d48', dim: 'rgba(225,29,72,0.15)', sobre: '#ffffff', claro: '#fda4af' },    // +90
};

const RANGOS = [
  { key: '+90',   label: '+90 días',   short: '+90',   nivel: 3, color: SEV.carmesi.c,  tono: SEV.carmesi.dim,  sobre: SEV.carmesi.sobre,  desc: 'Crítico extremo' },
  { key: '60-90', label: '60–90 días', short: '60–90', nivel: 2, color: SEV.naranja.c,  tono: SEV.naranja.dim,  sobre: SEV.naranja.sobre,  desc: 'Crítico' },
  { key: '30-60', label: '30–60 días', short: '30–60', nivel: 1, color: SEV.amarillo.c, tono: SEV.amarillo.dim, sobre: SEV.amarillo.sobre, desc: 'Atención' },
  { key: '0-30',  label: '0–30 días',  short: '0–30',  nivel: 0, color: SEV.verde.c,    tono: SEV.verde.dim,    sobre: SEV.verde.sobre,    desc: 'Normal' },
];
const RANGO_BY_KEY = Object.fromEntries(RANGOS.map(r => [r.key, r]));
const ORDEN_ASC = ['0-30', '30-60', '60-90', '+90'];      // orden natural de envejecimiento
const CRITICOS = ['60-90', '+90'];

// Semáforo de severidad: umbral referencial para lectura visual inmediata,
// no una meta corporativa declarada. Reutiliza los mismos 4 colores de
// RANGOS para no introducir una paleta nueva.
// Comparte la escala SEV con los rangos: el semáforo del mapa y la barra de
// composición tienen que hablar el mismo idioma de color.
const UMBRALES_SEVERIDAD = [
  { max: 0.15, label: 'Saludable', color: SEV.verde.c,    claro: SEV.verde.claro },
  { max: 0.30, label: 'Atención',  color: SEV.amarillo.c, claro: SEV.amarillo.claro },
  { max: 0.45, label: 'Elevado',   color: SEV.naranja.c,  claro: SEV.naranja.claro },
  { max: Infinity, label: 'Crítico', color: SEV.carmesi.c, claro: SEV.carmesi.claro },
];
const nivelSeveridad = pct => UMBRALES_SEVERIDAD.find(u => pct <= u.max);

/* ----------------------------------------------------------------------------
   Canal comercial. La bodega es lo que define el canal: no viene como columna
   del Excel, así que el mapeo vive aquí y es la única fuente de verdad.
   Los códigos llegaron transcritos con las confusiones típicas de copiar de
   una tabla (O↔0, L↔1, I↔1, Z↔2); están corregidos contra los códigos reales
   del archivo — 01008→OL008, 01J11→OIJI1, OL101→OLL01, 2L010→ZL010, etc.
   Los tres de lectura dudosa (OIJI1, OIDN1, OIJN1) los confirmó el usuario:
   pertenecen a Nacional. No volver a inferirlos.
   Una bodega que no esté en ninguna lista cae en "Sin canal": se muestra
   aparte en vez de repartirla a ojo o dejarla fuera del total.
   -------------------------------------------------------------------------*/
const CANALES = [
  { key: 'nacional', label: 'Nacional', color: '#38bdf8', bodegas: [
    'AC001', 'ANV01', 'OIDN1', 'OIJI1', 'OIJN1',
    'OL000', 'OL001', 'OL009', 'OL013', 'OL016', 'OL022', 'OL025', 'OL034',
    'OL036', 'OL037', 'OL039', 'OL040', 'OLD01', 'OLD02', 'OLE01', 'OLE02',
    'OLJ01', 'OLL01',
    'ZCC01', 'ZF008', 'ZF012', 'ZF014', 'ZF021', 'ZF023', 'ZFD01', 'ZFD02',
    'ZFE01', 'ZFE02', 'ZFJ01', 'ZL010',
  ] },
  { key: 'expo', label: 'Expo', color: '#a78bfa', bodegas: ['OL008', 'OL024', 'ZET01'] },
];
const SIN_CANAL = { key: 'sin', label: 'Sin canal', color: '#8095b2' };
const CANAL_BY_KEY = Object.fromEntries([...CANALES, SIN_CANAL].map(c => [c.key, c]));

// Un solo Map bodega→canal: la búsqueda es O(1) por fila, no un indexOf por lista.
const CANAL_DE_BODEGA = new Map();
for (const c of CANALES) for (const b of c.bodegas) CANAL_DE_BODEGA.set(b, c.key);
const canalDe = bodega => CANAL_DE_BODEGA.get(String(bodega ?? '').trim().toUpperCase()) || 'sin';

/* ============================================================================
   CAPA 2 — FUENTE DE DATOS
   Contrato: load() -> RawTable { rows, columns, sheets, meta }
   ExcelDataSource es intercambiable por ApiDataSource sin tocar nada aguas abajo.
   ==========================================================================*/

// Cuando el HTML está publicado (GitHub Pages), esta ruta relativa apunta al
// Excel que la Rutina de SIESA mantiene al día junto al propio archivo. Si se
// abre el HTML como archivo local (doble clic) el fetch falla por CORS de
// file:// y App cae al flujo manual de siempre — no hace falta detectarlo.
const RUTA_DATO_AUTOMATICO = 'lenta-rotacion/data/inventario-siesa.xlsx';

// Publicación manual compartida (Supabase). Misma URL y publishable key que
// shared/config.js — se copian porque este HTML es autocontenido. La key es
// de solo lectura por RLS; publicar pasa por la Edge Function con la clave de
// admin (ver supabase/functions/publicar-lenta-rotacion).
const SUPA_URL = 'https://rfysmwpdzlxmadobdvzh.supabase.co';
const SUPA_KEY = 'sb_publishable_LHZWmeFFmnua2j3y8dqqdw_rx0u3vad';
const SUPA_H = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };
const URL_PUBLICACION = `${SUPA_URL}/rest/v1/lenta_rotacion_publicacion?id=eq.1&select=*`;
const URL_PUBLICAR = `${SUPA_URL}/functions/v1/publicar-lenta-rotacion`;
const urlArchivoPublicado = ruta => `${SUPA_URL}/storage/v1/object/public/lenta-rotacion/${ruta}`;

// Nunca lanza: si la tabla no existe todavía o Supabase no responde, el panel
// sigue con el dato de SIESA como siempre.
async function leerPublicacion() {
  try {
    const res = await fetch(URL_PUBLICACION, { cache: 'no-store', headers: SUPA_H });
    if (!res.ok) return null;
    const filas = await res.json();
    return Array.isArray(filas) && filas[0] ? filas[0] : null;
  } catch (_) { return null; }
}

const ExcelDataSource = {
  id: 'excel',
  etiqueta: 'Excel manual',
  async load(file) {
    const buf = await file.arrayBuffer();
    return this._parse(buf, { fuente: 'Excel manual', archivo: file.name, cargadoEn: new Date(), esAutomatico: false },
      new Date(file.lastModified));
  },
  async loadFromUrl(url, metaExtra = {}) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${url}`);
    const buf = await res.arrayBuffer();
    const lastModified = res.headers.get('last-modified');
    const cargadoEn = lastModified ? new Date(lastModified) : new Date();
    return this._parse(buf, {
      fuente: 'SIESA (automático)',
      archivo: url.split('/').pop(),
      cargadoEn,
      esAutomatico: true,
      ...metaExtra,
    }, cargadoEn);
  },
  // fechaDato = cuándo se guardó el Excel (propiedad interna del libro); si no
  // la trae, la fecha de respaldo. Es lo que decide qué versión ve todo el mundo.
  _parse(buf, metaExtra, fechaRespaldo) {
    const wb = XLSX.read(buf, { cellDates: false });
    const sheets = wb.SheetNames;
    const ws = wb.Sheets[sheets[0]];
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });

    // Encabezado = primera fila con 3 o más celdas de texto no vacías.
    let hIdx = matrix.findIndex(r => r.filter(c => typeof c === 'string' && c.trim()).length >= 3);
    if (hIdx < 0) hIdx = 0;

    const columns = matrix[hIdx].map((c, i) => (c == null || String(c).trim() === '' ? `Columna ${i + 1}` : String(c).trim()));
    const rows = matrix.slice(hIdx + 1)
      .filter(r => r.some(c => c !== null && c !== ''))
      .map(r => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? null])));

    // Filas totalmente vacías dentro del rango de la hoja: firma de un Excel
    // incompleto (así llegó el corte del 23-sep: 10.000 filas con datos y
    // 15.451 en blanco). Mismo criterio que scripts/sync-lenta-rotacion.js.
    const rango = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
    const filasVacias = rango ? Math.max(0, (rango.e.r - rango.s.r + 1) - matrix.length) : 0;

    const fechaLibro = wb.Props && wb.Props.ModifiedDate ? new Date(wb.Props.ModifiedDate) : null;
    const fechaDato = metaExtra.fechaDato ? new Date(metaExtra.fechaDato)
      : fechaLibro && !isNaN(fechaLibro) ? fechaLibro : fechaRespaldo;

    return {
      rows, columns, sheets, buf,
      meta: { ...metaExtra, fechaDato, filasVacias, hojaUsada: sheets[0], filaEncabezado: hIdx + 1 },
    };
  },
};

/* ============================================================================
   CAPA 2B — HISTORIAL
   Cada carga guarda una fotografía del total sin filtros, para poder mostrar
   tendencia entre una carga y la siguiente. Una carga por día: si el mismo
   día se vuelve a cargar el archivo, se reemplaza la fotografía de ese día
   en vez de duplicarla.
   ==========================================================================*/

const HIST_KEY = 'lenta_rotacion_historial_v1';
const HIST_MAX = 60;

function histLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (_) { return []; }
}

function histGuardar(historialPrevio, kpisGlobales) {
  const hoy = new Date().toISOString().slice(0, 10);
  const snap = {
    fecha: hoy,
    ts: Date.now(),
    total: kpisGlobales.total,
    critico: kpisGlobales.critico,
    pctCritico: kpisGlobales.pctCritico,
    lenta: kpisGlobales.lenta,
    pctLenta: kpisGlobales.pctLenta,
    porRango: kpisGlobales.porRango,
  };
  const sinHoy = historialPrevio.filter(h => h.fecha !== hoy);
  const nuevo = [...sinHoy, snap].sort((a, b) => a.ts - b.ts).slice(-HIST_MAX);
  try { localStorage.setItem(HIST_KEY, JSON.stringify(nuevo)); } catch (_) {}
  return nuevo;
}

/* ============================================================================
   CAPA 3 — MAPEADOR DE COLUMNAS
   Reconoce encabezados por alias y las columnas de rango por patrón numérico.
   ==========================================================================*/

// El guion bajo cuenta como separador de palabra, igual que el espacio \u2014 el
// export en vivo de SIESA trae encabezados en snake_case (id_item,
// existencia_0_30) y sin este reemplazo ni el alias ni el patr\u00f3n de rango
// los reconocen (\b no marca l\u00edmite entre dos caracteres de palabra).
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

/* B\u00fasqueda con operadores, para no depender de una sola palabra suelta:
     ich 505        \u2192 deben aparecer ambos (Y)
     -expo          \u2192 descarta lo que lo contenga
     "ich-505"      \u2192 frase exacta
     501|505        \u2192 cualquiera de los dos (O)
   Devuelve un predicado sobre el texto ya concatenado de la fila. */
function compilarBusqueda(entrada) {
  const tokens = String(entrada ?? '').match(/-?"[^"]*"|\S+/g) || [];
  const requeridos = [], excluidos = [], alternativas = [];
  for (const t of tokens) {
    const negado = t.startsWith('-');
    const cuerpo = norm((negado ? t.slice(1) : t).replace(/"/g, ''));
    if (!cuerpo) continue;
    if (negado) excluidos.push(cuerpo);
    else if (cuerpo.includes('|')) {
      const partes = cuerpo.split('|').map(p => p.trim()).filter(Boolean);
      if (partes.length) alternativas.push(partes);
    } else requeridos.push(cuerpo);
  }
  if (!requeridos.length && !excluidos.length && !alternativas.length) return null;
  return texto => {
    if (excluidos.some(e => texto.includes(e))) return false;
    if (!requeridos.every(r => texto.includes(r))) return false;
    return alternativas.every(grupo => grupo.some(p => texto.includes(p)));
  };
}

const ALIAS = {
  marca:       ['marca', 'marcas', 'nombre marca', 'marca producto', 'desc marca'],
  referencia:  ['referencia', 'referencias', 'ref', 'modelo', 'cod referencia'],
  item:        ['item', 'items', 'codigo item', 'cod item', 'sku', 'codigo', 'material'],
  bodega:      ['bodega', 'bodegas', 'almacen', 'centro', 'cod bodega', 'deposito'],
};

// Dimensiones opcionales: enriquecen filtros pero no bloquean la carga.
/* El buscador de columnas prueba coincidencia exacta antes que parcial, que es
   lo que evita que 'linea' se quede con "LINEA DE NEGOCIO" cuando el archivo
   trae ambas columnas. */
const ALIAS_OPC = {
  origen:         ['origen'],
  linea:          ['linea', 'lineas'],
  tipo_producto:  ['tipo de producto', 'tipo producto'],
  unidad_negocio: ['unidad de negocio', 'unidad negocio'],
  talla:          ['talla', 'tallas'],
  grafico:        ['graficos', 'grafico'],
};

// El conector (a / - / hasta / y) es opcional: "existencia_0_30" normaliza a
// "existencia 0 30" (números separados solo por espacio, sin palabra de
// enlace), y debe reconocerse igual que "0 a 30 días" o "0-30".
const PATRON_RANGO = [
  { key: '0-30',  re: /\b0\s*(?:a|-|hasta|y)?\s*30\b/ },
  { key: '30-60', re: /\b30\s*(?:a|-|hasta|y)?\s*60\b/ },
  { key: '60-90', re: /\b60\s*(?:a|-|hasta|y)?\s*90\b/ },
  { key: '+90',   re: /\bmas de\s*90\b|\b90\s*(?:\+|mas|o\s*mas|y\s*mas|en adelante)\b|\+\s*90\b/ },
];
const ES_MONETARIA = /costo|valor|precio|\$|importe|monto/;

function detectarMapeo(columns) {
  const dim = {};
  const usadas = new Set();
  const buscar = (alias) => {
    // Coincidencia exacta primero, luego parcial. Evita que "Costo prom. uni" gane un campo.
    for (const a of alias) {
      const hit = columns.find(c => !usadas.has(c) && !ES_MONETARIA.test(norm(c)) && norm(c) === a);
      if (hit) return hit;
    }
    for (const a of alias) {
      const hit = columns.find(c => !usadas.has(c) && !ES_MONETARIA.test(norm(c)) && norm(c).includes(a));
      if (hit) return hit;
    }
    return null;
  };
  for (const [campo, alias] of Object.entries(ALIAS)) {
    const hit = buscar(alias);
    if (hit) { dim[campo] = hit; usadas.add(hit); }
  }
  const opcionales = {};
  for (const [campo, alias] of Object.entries(ALIAS_OPC)) {
    const hit = buscar(alias);
    if (hit) { opcionales[campo] = hit; usadas.add(hit); }
  }
  const rangos = {};
  for (const { key, re } of PATRON_RANGO) {
    const hit = columns.find(c => { const n = norm(c); return !ES_MONETARIA.test(n) && re.test(n); });
    if (hit) rangos[key] = hit;
  }
  // "Disponible" es una cantidad aparte de "existencia" (existencia menos lo
  // comprometido) — SIESA trae ambas por rango (existencia_0_30,
  // disponible_0_30, ...). Se detecta por separado, filtrando a columnas que
  // digan "disponible", para no pisar la columna de existencia que ya usa
  // `rangos` como la cantidad principal.
  const rangosDisponible = {};
  for (const { key, re } of PATRON_RANGO) {
    const hit = columns.find(c => { const n = norm(c); return !ES_MONETARIA.test(n) && n.includes('disponible') && re.test(n); });
    if (hit) rangosDisponible[key] = hit;
  }
  return { dim, rangos, rangosDisponible, opcionales };
}

/* ============================================================================
   CAPA 4 — VALIDADOR
   Nunca corrige datos en silencio. Separa lo que bloquea de lo que solo advierte.
   ==========================================================================*/

const esFilaTotal = v => /^(gran\s*total|total\s*general|totales?)$/.test(norm(v));
const aNumero = v => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const limpio = String(v).replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(limpio);
  return Number.isFinite(n) ? n : NaN;
};

function validar(raw, mapeo) {
  const errores = [], avisos = [];
  for (const campo of Object.keys(ALIAS)) {
    if (!mapeo.dim[campo]) errores.push({ campo, msg: `No se identificó la columna de ${campo}.` });
  }
  if (Object.keys(mapeo.rangos).length === 0) {
    errores.push({ campo: 'rangos', msg: 'No se encontró ninguna columna de cantidad por rango de días.' });
  }
  if (errores.length) return { ok: false, errores, avisos, checksum: null };

  const cols = Object.values(mapeo.rangos);
  const filasTotal = raw.rows.filter(r => Object.values(r).some(esFilaTotal));
  const datos = raw.rows.filter(r => !Object.values(r).some(esFilaTotal));

  // Checksum declarado por el archivo (fila Gran total), si existe.
  let checksum = null;
  if (filasTotal.length) {
    checksum = { declarado: {}, calculado: {}, coincide: true, filas: filasTotal.length };
    for (const [key, col] of Object.entries(mapeo.rangos)) {
      const d = Math.round(aNumero(filasTotal[0][col]) || 0);
      const c = Math.round(datos.reduce((a, r) => a + (aNumero(r[col]) || 0), 0));
      checksum.declarado[key] = d; checksum.calculado[key] = c;
      if (d !== c) checksum.coincide = false;
    }
    if (!checksum.coincide) avisos.push({ campo: 'checksum', msg: 'La suma de las filas no coincide con la fila de totales del archivo.' });
  } else {
    avisos.push({ campo: 'checksum', msg: 'El archivo no trae fila de totales. No se pudo validar contra un total declarado.' });
  }

  let noNumericas = 0, negativas = 0, enCero = 0, sinDimension = 0;
  for (const r of datos) {
    let suma = 0, malo = false, neg = false;
    for (const c of cols) {
      const n = aNumero(r[c]);
      if (Number.isNaN(n)) { malo = true; continue; }
      if (n < 0) neg = true;
      suma += n;
    }
    if (malo) noNumericas++;
    if (neg) negativas++;
    if (suma === 0) enCero++;
    if (Object.keys(ALIAS).some(f => { const v = r[mapeo.dim[f]]; return v === null || String(v).trim() === ''; })) sinDimension++;
  }
  if (noNumericas) avisos.push({ campo: 'tipos', msg: `${noNumericas} filas con cantidades no numéricas. Se tratan como cero.` });
  if (negativas)   avisos.push({ campo: 'negativos', msg: `${negativas} filas con cantidades negativas. Se conservan sin alterar.` });
  if (enCero)      avisos.push({ campo: 'ceros', msg: `${enCero} filas sin unidades en ningún rango. Se excluyen del análisis.` });
  if (sinDimension) avisos.push({ campo: 'dimensiones', msg: `${sinDimension} filas con marca, referencia, ítem o bodega vacíos. Se agrupan como "Sin dato".` });

  return { ok: true, errores, avisos, checksum, filasDato: datos.length, filasTotal: filasTotal.length };
}

/* ============================================================================
   CAPA 5 — NORMALIZADOR
   Ancho -> largo (unpivot). Produce FactTable, el contrato estable del sistema.
   ==========================================================================*/

const limpiar = v => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s === '' || s.toLowerCase() === 'null' ? 'Sin dato' : s;
};

function normalizar(raw, mapeo) {
  const { dim, rangos, rangosDisponible, opcionales } = mapeo;
  const hechos = [];
  for (const r of raw.rows) {
    if (Object.values(r).some(esFilaTotal)) continue;
    const marca = limpiar(r[dim.marca]);
    const referencia = limpiar(r[dim.referencia]);
    const bodega = limpiar(r[dim.bodega]);
    const base = {
      marca, referencia,
      ref_key: `${marca}‖${referencia}`,
      item: limpiar(r[dim.item]),
      bodega,
      canal: canalDe(bodega),      // derivado de la bodega, no viene en el archivo
    };
    for (const [campo, col] of Object.entries(opcionales)) base[campo] = limpiar(r[col]);
    for (const [key, col] of Object.entries(rangos)) {
      const n = aNumero(r[col]);
      const u = Number.isNaN(n) ? 0 : Math.round(n);
      if (u === 0) continue;                       // regla 4: se descartan los ceros
      // "Disponible" viaja junto a la existencia del mismo rango, cuando el
      // archivo trae esa columna — null si no, para no fingir un dato que no vino.
      const colDisp = rangosDisponible?.[key];
      const disponible = colDisp ? Math.round(aNumero(r[colDisp]) || 0) : null;
      hechos.push({ ...base, rango_dias: key, nivel_criticidad: RANGO_BY_KEY[key].nivel, unidades: u, disponible });
    }
  }
  return hechos;
}

/* ============================================================================
   CAPA 6 — SELECTORES
   Toda métrica se recalcula sobre el subconjunto filtrado. Los conteos de
   ítems/referencias/bodegas son siempre distintos, jamás sumas entre rangos.
   ==========================================================================*/

const distintos = (rows, campo) => new Set(rows.map(r => r[campo])).size;

function calcularKpis(rows) {
  const total = rows.reduce((a, r) => a + r.unidades, 0);
  const porRango = {};
  for (const k of ORDEN_ASC) porRango[k] = 0;
  for (const r of rows) porRango[r.rango_dias] = (porRango[r.rango_dias] || 0) + r.unidades;
  const critico = CRITICOS.reduce((a, k) => a + (porRango[k] || 0), 0);
  const lenta = total - (porRango['0-30'] || 0);
  return {
    total, porRango, critico, lenta,
    pctLenta: total ? lenta / total : 0,
    pctCritico: total ? critico / total : 0,
    referencias: distintos(rows, 'ref_key'),
    items: distintos(rows, 'item'),
    bodegas: distintos(rows, 'bodega'),
  };
}

function porDimension(rows, campo) {
  const mapa = new Map();
  for (const r of rows) {
    let e = mapa.get(r[campo]);
    if (!e) { e = { clave: r[campo], total: 0, rangos: {}, items: new Set(), refs: new Set(), bodegas: new Set() }; mapa.set(r[campo], e); }
    e.total += r.unidades;
    e.rangos[r.rango_dias] = (e.rangos[r.rango_dias] || 0) + r.unidades;
    e.items.add(r.item); e.refs.add(r.ref_key); e.bodegas.add(r.bodega);
  }
  return [...mapa.values()].map(e => {
    const critico = CRITICOS.reduce((a, k) => a + (e.rangos[k] || 0), 0);
    return { ...e, items: e.items.size, refs: e.refs.size, bodegas: e.bodegas.size, critico, pctCritico: e.total ? critico / e.total : 0 };
  });
}

function resumenRangos(rows) {
  return ORDEN_ASC.map(k => {
    const sub = rows.filter(r => r.rango_dias === k);
    return {
      key: k, ...RANGO_BY_KEY[k],
      unidades: sub.reduce((a, r) => a + r.unidades, 0),
      referencias: distintos(sub, 'ref_key'),
      items: distintos(sub, 'item'),
      bodegas: distintos(sub, 'bodega'),
    };
  });
}

/* ============================================================================
   CAPA 7 — INTERFAZ
   ==========================================================================*/

const nf = new Intl.NumberFormat('es-CO');
const pf = (v, d = 1) => `${(v * 100).toFixed(d).replace('.', ',')} %`;
const fmtFecha = d => d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/* Barra de composición: lectura instantánea de la mezcla de envejecimiento.
   Se repite en KPIs, rankings y tablas — es el elemento de lectura común. */
function BarraComposicion({ rangos, total, alto = 6 }) {
  if (!total) return null;
  return (
    <div className="flex w-full overflow-hidden rounded-sm" style={{ height: alto }}>
      {ORDEN_ASC.map(k => {
        const v = rangos[k] || 0;
        if (!v) return null;
        return <div key={k} style={{ width: `${(v / total) * 100}%`, backgroundColor: RANGO_BY_KEY[k].color }} title={`${RANGO_BY_KEY[k].label}: ${nf.format(v)}`} />;
      })}
    </div>
  );
}

/* Escala de elevación: tres niveles, no más. La profundidad marca jerarquía,
   no decora — una tarjeta sube solo cuando debe leerse antes que sus vecinas. */
const SOMBRA = { plana: 'none', media: '0 2px 8px rgba(0,0,0,0.35)', alta: '0 14px 44px rgba(0,0,0,0.6)' };

/* Indicador de tendencia: compara contra la fotografía de la carga anterior
   (Capa 2B). "Peor"/"mejor" se define por lectura de negocio, no por signo
   aritmético — más inventario crítico es peor aunque el delta sea positivo. */
function DeltaBadge({ delta, invertido = true, unidad = 'pp' }) {
  if (delta == null || Number.isNaN(delta)) return null;
  const plano = Math.abs(delta) < 0.05;
  const peor = invertido ? delta > 0 : delta < 0;
  const color = plano ? C.t3 : peor ? C.red : C.green;
  const Icono = plano ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums" style={{ color }}>
      <Icono className="h-3 w-3" />
      {plano ? 'Sin cambio' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${unidad}`}
      <span className="font-normal" style={{ color: C.t3 }}>vs. carga anterior</span>
    </span>
  );
}

function TarjetaKpi({ titulo, valor, sub, color, destacado, borde, contexto, rango, delta }) {
  return (
    <div className="rounded-xl border p-4 transition-shadow hover:shadow-md"
      style={{ backgroundColor: C.bg2, borderColor: C.b0, borderTopWidth: 2,
               borderTopColor: color || C.accent, borderRadius: 11 }}>
      <div className="flex items-center gap-1.5">
        {rango && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
        <div className="truncate text-[10px] font-semibold uppercase tracking-[0.09em]" style={{ color: C.t2 }}>{titulo}</div>
      </div>
      <div className="mt-2 text-2xl font-extrabold leading-none tabular-nums" style={{ color: color || C.t1, fontFamily: FUENTE_DATO }}>{valor}</div>
      {contexto != null && (
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: C.bg3 }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, contexto * 100)}%`, backgroundColor: color || C.accent }} />
        </div>
      )}
      {delta !== undefined && <div className="mt-2"><DeltaBadge delta={delta} /></div>}
      {sub && <div className="mt-2 text-[11px] leading-snug tabular-nums" style={{ color: C.t2 }}>{sub}</div>}
    </div>
  );
}

/* Pareto: cuántos elementos concentran un umbral del inventario crítico.
   Convierte la tabla en una frase accionable sin inventar nada. */
function pareto(rows, campo, umbral = 0.8) {
  const m = new Map();
  let total = 0;
  for (const r of rows) {
    if (!CRITICOS.includes(r.rango_dias)) continue;
    m.set(r[campo], (m.get(r[campo]) || 0) + r.unidades);
    total += r.unidades;
  }
  if (!total) return null;
  const orden = [...m.values()].sort((a, b) => b - a);
  let acum = 0, n = 0;
  for (const v of orden) { acum += v; n++; if (acum / total >= umbral) break; }
  return { n, de: orden.length, total, cobertura: acum / total };
}

function TooltipRango({ active, payload, base }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border px-3 py-2 text-xs shadow-lg" style={{ borderColor: C.b0, backgroundColor: C.bg2 }}>
      <div className="mb-1.5 flex items-center gap-2 font-semibold" style={{ color: C.t1 }}>
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
        {d.label} <span className="font-normal" style={{ color: C.t2 }}>· {d.desc}</span>
      </div>
      <div className="space-y-0.5 tabular-nums" style={{ color: C.t2 }}>
        <div>Unidades: <b>{nf.format(d.unidades)}</b></div>
        <div>Participación: <b>{pf(base ? d.unidades / base : 0)}</b> <span style={{ color: C.t3 }}>de {nf.format(base)}</span></div>
        <div>Referencias: <b>{nf.format(d.referencias)}</b></div>
        <div>Ítems: <b>{nf.format(d.items)}</b></div>
        <div>Bodegas: <b>{nf.format(d.bodegas)}</b></div>
      </div>
    </div>
  );
}

/* Tooltip de "Comparación por rango de días": lidera con la métrica que el
   toggle tiene activa (values lead, labels follow) en vez de mostrar
   siempre Unidades — si estás viendo el toggle "Ítems", el número grande
   es ítems. Las otras 3 métricas quedan como contexto secundario. */
function TooltipDias({ active, payload, metrica, metricaLabel, baseUnidades }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const TODAS = [
    { k: 'unidades', l: 'Unidades', v: d.unidades },
    { k: 'referencias', l: 'Referencias', v: d.referencias },
    { k: 'items', l: 'Ítems', v: d.items },
    { k: 'bodegas', l: 'Bodegas', v: d.bodegas },
  ];
  const activa = TODAS.find(m => m.k === metrica);
  const otras = TODAS.filter(m => m.k !== metrica);
  return (
    <div className="rounded-md border px-3 py-2.5 text-xs shadow-lg" style={{ borderColor: C.b0, backgroundColor: C.bg2 }}>
      <div className="mb-1.5 flex items-center gap-2 font-semibold" style={{ color: C.t1 }}>
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
        {d.label} <span className="font-normal" style={{ color: C.t2 }}>· {d.desc}</span>
      </div>
      <div className="text-lg font-extrabold tabular-nums" style={{ color: d.color, fontFamily: FUENTE_DATO }}>
        {nf.format(activa.v)} <span className="text-[10px] font-medium" style={{ color: C.t3 }}>{metricaLabel.toLowerCase()}</span>
      </div>
      {metrica === 'unidades' && (
        <div className="mt-1 tabular-nums" style={{ color: C.t2 }}>
          {pf(baseUnidades ? d.unidades / baseUnidades : 0)} <span style={{ color: C.t3 }}>del total</span>
        </div>
      )}
      <div className="mt-1.5 space-y-0.5 border-t pt-1.5 tabular-nums" style={{ borderColor: C.bg3, color: C.t3 }}>
        {otras.map(m => <div key={m.k}>{m.l}: <b style={{ color: C.t2 }}>{nf.format(m.v)}</b></div>)}
      </div>
    </div>
  );
}

/* --------------------------- Carga de archivo --------------------------- */

function ZonaCarga({ onArchivo, cargando, error }) {
  const [sobre, setSobre] = useState(false);
  const input = useRef(null);
  const drop = useCallback(e => {
    e.preventDefault(); setSobre(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onArchivo(f);
  }, [onArchivo]);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <div className="mb-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: C.t2 }}>Control de inventario</div>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight" style={{ color: C.t1 }}>Lenta rotación</h1>
        <p className="mt-2 text-sm" style={{ color: C.t2 }}>Carga el archivo de inventario para ver dónde está concentrado el problema.</p>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={drop}
        onClick={() => input.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed px-8 py-14 text-center transition-colors"
        style={{ borderColor: sobre ? C.accent : C.b1, backgroundColor: sobre ? C.bg3 : C.bg2 }}
      >
        <Upload className="mx-auto mb-4 h-9 w-9" style={{ color: sobre ? C.accent : C.t3 }} strokeWidth={1.5} />
        <div className="text-base font-medium" style={{ color: C.t1 }}>
          {cargando ? 'Procesando archivo…' : 'Arrastra tu archivo de Excel aquí'}
        </div>
        <div className="mt-1 text-sm" style={{ color: C.t2 }}>
          {cargando ? 'Validando y normalizando' : 'o haz clic para seleccionarlo · .xlsx, .xlsm, .xls'}
        </div>
        <input ref={input} type="file" accept=".xlsx,.xlsm,.xls" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onArchivo(f); e.target.value = ''; }} />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border px-4 py-3" style={{ borderColor: C.b1, backgroundColor: C.redDim }}>
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.red }} />
            <div>
              <div className="text-sm font-semibold" style={{ color: C.red }}>No se pudo procesar el archivo</div>
              <div className="mt-0.5 text-sm" style={{ color: C.red }}>{error}</div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-xs leading-relaxed" style={{ color: C.t3 }}>
        El archivo debe incluir columnas de marca, referencia, ítem y bodega, más las cantidades por rango de días.
        Si los nombres no coinciden, podrás asignarlos manualmente en el paso siguiente.
      </div>
    </div>
  );
}

/* --------------------- Configuración manual de columnas --------------------- */

function ConfigurarColumnas({ raw, mapeo, onConfirmar, onCancelar }) {
  const [dim, setDim] = useState(mapeo.dim);
  const [rangos, setRangos] = useState(mapeo.rangos);
  const faltantes = Object.keys(ALIAS).filter(c => !dim[c]);
  const listo = faltantes.length === 0 && Object.keys(rangos).length > 0;

  const Selector = ({ etiqueta, valor, onChange, obligatorio }) => (
    <div className="flex items-center gap-3 py-2">
      <div className="w-40 shrink-0 text-sm" style={{ color: C.t2 }}>
        {etiqueta}{obligatorio && <span style={{ color: C.red }}> *</span>}
      </div>
      <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: C.t4 }} />
      <select value={valor || ''} onChange={e => onChange(e.target.value || null)}
        className="flex-1 rounded-md border px-2.5 py-1.5 text-sm"
        style={{ borderColor: valor ? C.b0 : C.b1, color: C.t1 }}>
        <option value="">— Sin asignar —</option>
        {raw.columns.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h2 className="text-2xl font-semibold tracking-tight" style={{ color: C.t1 }}>Asigna las columnas</h2>
      <p className="mt-1.5 text-sm" style={{ color: C.t2 }}>
        No se reconocieron todas las columnas de <b>{raw.meta.archivo}</b>. Indica qué columna corresponde a cada campo.
      </p>

      <div className="mt-6 rounded-xl border p-5" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider" style={{ color: C.t2 }}>Dimensiones</div>
        {Object.keys(ALIAS).map(c => (
          <Selector key={c} etiqueta={c[0].toUpperCase() + c.slice(1)} valor={dim[c]} obligatorio
            onChange={v => setDim(p => ({ ...p, [c]: v }))} />
        ))}
        <div className="mb-2 mt-5 text-[11px] font-medium uppercase tracking-wider" style={{ color: C.t2 }}>Cantidades por rango de días</div>
        {ORDEN_ASC.map(k => (
          <Selector key={k} etiqueta={RANGO_BY_KEY[k].label} valor={rangos[k]}
            onChange={v => setRangos(p => { const n = { ...p }; if (v) n[k] = v; else delete n[k]; return n; })} />
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={() => onConfirmar({ dim, rangos, opcionales: mapeo.opcionales })} disabled={!listo}
          className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: C.accent }}>
          Procesar datos
        </button>
        <button onClick={onCancelar} className="rounded-md border px-4 py-2 text-sm font-medium"
          style={{ borderColor: C.b0, color: C.t2 }}>
          Cargar otro archivo
        </button>
        {!listo && <span className="text-xs" style={{ color: C.t2 }}>Faltan campos obligatorios</span>}
      </div>
    </div>
  );
}

/* ------------------------------- Filtros ------------------------------- */

/* Filtro tipo Excel: dos modos (dejar solo lo marcado / excluir lo marcado),
   selección masiva sobre lo que la búsqueda deja a la vista, y las unidades de
   cada opción a la derecha para poder decidir sin salir del panel.
   El modo "excluir" es lo que permite "ver todo menos SOLID" marcando uno solo
   en vez de marcar los otros 769. */
function FiltroMulti({ etiqueta, opciones, seleccion, onChange, modo = 'incluir', onModo, conteos }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const btnRef = useRef(null);
  // La lista se ajusta al espacio que queda bajo el botón: con 770 opciones y
  // una pantalla baja, una altura fija se sale de la ventana y deja el pie
  // (Limpiar, contador) fuera de alcance.
  const [altoLista, setAltoLista] = useState(256);
  useEffect(() => {
    if (!abierto) return;
    const medir = () => {
      const b = btnRef.current?.getBoundingClientRect();
      if (!b) return;
      const CHROME = 150;   // modo + búsqueda + barra de acciones + pie
      const MARGEN = 24;
      setAltoLista(Math.max(120, Math.round(window.innerHeight - b.bottom - CHROME - MARGEN)));
    };
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [abierto]);
  const excluir = modo === 'excluir';
  const sel = useMemo(() => new Set(seleccion), [seleccion]);

  const vis = useMemo(() => {
    const nq = norm(q);
    return nq ? opciones.filter(o => norm(o).includes(nq)) : opciones;
  }, [opciones, q]);

  const TOPE = 300;                       // techo de render, no de selección
  const visCorte = vis.slice(0, TOPE);
  const visSet = useMemo(() => new Set(vis), [vis]);
  const visSeleccionados = useMemo(() => vis.reduce((a, o) => a + (sel.has(o) ? 1 : 0), 0), [vis, sel]);
  const todosVisMarcados = vis.length > 0 && visSeleccionados === vis.length;

  const toggle = o => onChange(sel.has(o) ? seleccion.filter(x => x !== o) : [...seleccion, o]);
  const marcarVisibles = () => onChange([...new Set([...seleccion, ...vis])]);
  const desmarcarVisibles = () => onChange(seleccion.filter(x => !visSet.has(x)));
  const invertir = () => onChange(opciones.filter(o => !sel.has(o)));
  const soloEste = o => { onChange([o]); if (excluir) onModo?.('incluir'); };

  const Mini = ({ children, onClick, title }) => (
    <button onClick={onClick} title={title}
      className="rounded px-1.5 py-1 text-[10px] font-semibold transition-colors hover:brightness-125"
      style={{ color: C.t2, backgroundColor: C.bg3 }}>{children}</button>
  );

  return (
    <div className="relative">
      <button ref={btnRef} onClick={() => setAbierto(a => !a)}
        className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium"
        style={{ borderColor: seleccion.length ? (excluir ? C.red : C.accent) : C.b0, color: C.t1 }}>
        {etiqueta}
        {seleccion.length > 0 && (
          <span className="rounded-full px-1.5 text-[10px] font-semibold"
            style={{ backgroundColor: excluir ? C.red : C.accent, color: excluir ? C.t1 : '#fff' }}>
            {excluir ? '≠' : ''}{seleccion.length}
          </span>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 flex w-80 flex-col rounded-md border shadow-lg"
            style={{ borderColor: C.b0, backgroundColor: C.bg2, maxHeight: `calc(100vh - ${(btnRef.current?.getBoundingClientRect().bottom ?? 120) + 24}px)` }}>

            {/* Modo: incluir vs excluir */}
            <div className="flex gap-1 border-b p-2" style={{ borderColor: C.bg3 }}>
              {[['incluir', 'Solo lo marcado'], ['excluir', 'Todo excepto lo marcado']].map(([m, l]) => (
                <button key={m} onClick={() => onModo?.(m)}
                  className="flex-1 rounded px-2 py-1 text-[10px] font-semibold transition-colors"
                  style={{
                    backgroundColor: modo === m ? (m === 'excluir' ? C.red : C.accent) : 'transparent',
                    color: modo === m ? (m === 'excluir' ? C.t1 : C.bg0) : C.t2,
                    border: `1px solid ${modo === m ? 'transparent' : C.b0}`,
                  }}>{l}</button>
              ))}
            </div>

            <div className="border-b p-2" style={{ borderColor: C.bg3 }}>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Buscar en ${nf.format(opciones.length)} opciones…`} autoFocus
                className="w-full rounded border px-2 py-1 text-xs" style={{ borderColor: C.b0 }} />
            </div>

            {/* Selección masiva: siempre actúa sobre lo que la búsqueda deja visible */}
            <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: C.bg3 }}>
              <Mini onClick={marcarVisibles} title="Marcar todo lo visible">
                {q ? `Marcar ${nf.format(vis.length)}` : 'Todos'}
              </Mini>
              <Mini onClick={desmarcarVisibles} title="Desmarcar lo visible">Ninguno</Mini>
              <Mini onClick={invertir} title="Invertir la selección completa">Invertir</Mini>
              <span className="ml-auto text-[10px] tabular-nums" style={{ color: C.t3 }}>
                {nf.format(seleccion.length)} de {nf.format(opciones.length)}
              </span>
            </div>

            <div className="overflow-y-auto p-1" style={{ maxHeight: altoLista }}>
              {vis.length === 0 && <div className="px-2 py-4 text-center text-xs" style={{ color: C.t3 }}>Sin coincidencias</div>}
              {visCorte.map(o => {
                const marcado = sel.has(o);
                return (
                  <div key={o} className="group flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:brightness-125">
                    <input type="checkbox" checked={marcado} onChange={() => toggle(o)} id={`f-${etiqueta}-${o}`} />
                    <label htmlFor={`f-${etiqueta}-${o}`} className="min-w-0 flex-1 cursor-pointer truncate"
                      style={{ color: marcado && excluir ? C.red : C.t1, textDecoration: marcado && excluir ? 'line-through' : 'none' }}
                      title={o}>{o}</label>
                    {conteos?.[o] != null && (
                      <span className="shrink-0 tabular-nums text-[10px]" style={{ color: C.t3 }}>{nf.format(conteos[o])}</span>
                    )}
                    <button onClick={() => soloEste(o)} title="Dejar solo este"
                      className="shrink-0 text-[9px] font-semibold opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: C.accent }}>SOLO</button>
                  </div>
                );
              })}
              {vis.length > TOPE && (
                <div className="px-2 py-2 text-center text-[10px]" style={{ color: C.t3 }}>
                  Mostrando {nf.format(TOPE)} de {nf.format(vis.length)} · afina la búsqueda o usa “Marcar {nf.format(vis.length)}”
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t px-2 py-1.5" style={{ borderColor: C.bg3 }}>
              <span className="text-[10px]" style={{ color: excluir && seleccion.length ? C.red : C.t3 }}>
                {seleccion.length === 0
                  ? 'Sin filtro: se muestran todas'
                  : excluir
                    ? `Ocultando ${nf.format(seleccion.length)}`
                    : `Mostrando solo ${nf.format(seleccion.length)}`}
              </span>
              {seleccion.length > 0 && (
                <button onClick={() => onChange([])} className="ml-auto rounded px-2 py-1 text-[10px] font-semibold hover:brightness-125" style={{ color: C.red }}>
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------ Secciones ------------------------------ */

/* Dona de composición por antigüedad. Extraída para poder mostrarse tanto en
   "Resumen ejecutivo" como, tal cual, dentro de la sección Gráficos. */
function DonaAntiguedad({ rows }) {
  const [soloLenta, setSoloLenta] = useState(true);
  const resumen = useMemo(() => resumenRangos(rows), [rows]);
  const datosDona = soloLenta ? resumen.filter(r => r.key !== '0-30') : resumen;
  const baseDona = datosDona.reduce((a, r) => a + r.unidades, 0);
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold" style={{ color: C.t1 }}>Distribución por antigüedad</div>
          <div className="mt-0.5 text-[11px]" style={{ color: C.t2 }}>
            {soloLenta ? 'Solo unidades sobre 30 días' : 'Inventario completo'}
          </div>
        </div>
        <button onClick={() => setSoloLenta(s => !s)}
          className="shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-semibold transition-colors"
          style={{ borderColor: soloLenta ? C.accent : C.b0, backgroundColor: soloLenta ? C.accent : 'transparent', color: soloLenta ? C.bg0 : C.t2 }}>
          {soloLenta ? 'Ver todo' : 'Solo lenta rotación'}
        </button>
      </div>

      <div className="relative mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={datosDona} dataKey="unidades" nameKey="label" innerRadius="66%" outerRadius="92%" paddingAngle={2.5} strokeWidth={0}>
              {datosDona.map(d => <Cell key={d.key} fill={d.color} />)}
            </Pie>
            <RTooltip content={<TooltipRango base={baseDona} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[22px] font-semibold leading-none tabular-nums" style={{ color: C.t1, letterSpacing: '-0.03em' }}>{nf.format(baseDona)}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider" style={{ color: C.t3 }}>unidades</div>
        </div>
      </div>

      <div className="mt-1 space-y-1.5">
        {datosDona.map(d => (
          <div key={d.key} className="flex items-center gap-2 text-[11px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="flex-1" style={{ color: C.t2 }}>{d.label}</span>
            <span className="tabular-nums font-semibold" style={{ color: C.t1 }}>{nf.format(d.unidades)}</span>
            <span className="w-12 text-right tabular-nums" style={{ color: C.t3 }}>{pf(baseDona ? d.unidades / baseDona : 0, 1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeccionResumen({ rows, kpis, historial = [] }) {
  const anteriorGlobal = historial.length > 1 ? historial[historial.length - 2] : null;
  const deltaLenta = anteriorGlobal ? (kpis.pctLenta - anteriorGlobal.pctLenta) * 100 : null;

  const marcas = useMemo(() => porDimension(rows, 'marca').sort((a, b) => b.critico - a.critico), [rows]);
  const bodegas = useMemo(() => porDimension(rows, 'bodega').sort((a, b) => b.critico - a.critico), [rows]);
  const pBodega = useMemo(() => pareto(rows, 'bodega'), [rows]);
  const pMarca = useMemo(() => pareto(rows, 'marca'), [rows]);
  const ctx = React.useContext(DrillCtx);

  const Ranking = ({ titulo, pregunta, datos, campo }) => {
    const top = datos.slice(0, 6);
    const max = Math.max(1, ...top.map(d => d.critico));
    return (
      <div className="rounded-xl border p-5" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[13px] font-semibold" style={{ color: C.t1 }}>{titulo}</div>
          <div className="text-[10px] tabular-nums" style={{ color: C.t3 }}>de {nf.format(datos.length)}</div>
        </div>
        <div className="mt-0.5 text-[11px]" style={{ color: C.t2 }}>{pregunta}</div>
        <div className="mt-4 space-y-3">
          {top.length === 0 && <div className="py-6 text-center text-xs" style={{ color: C.t3 }}>Sin datos para los filtros aplicados</div>}
          {top.map((d, i) => (
            <button key={d.clave} onClick={() => ctx.abrir({ via: campo, valores: { [campo]: d.clave } })}
              className="group block w-full text-left">
              <div className="flex items-baseline gap-2">
                <span className="w-4 shrink-0 font-mono text-[10px] tabular-nums" style={{ color: C.t4 }}>{i + 1}</span>
                <span className={`min-w-0 flex-1 truncate text-xs font-medium group-hover:underline ${campo === 'bodega' ? 'font-mono' : ''}`} style={{ color: C.t1 }}>{d.clave}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(d.critico)}</span>
                <span className="w-11 shrink-0 text-right text-[10px] tabular-nums" style={{ color: C.t3 }}>{pf(d.pctCritico, 0)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 pl-6">
                <div className="h-[5px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: C.bg3 }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(d.critico / max) * 100}%`, backgroundColor: C.red }} />
                </div>
                <span className="w-16 shrink-0"><BarraComposicion rangos={d.rangos} total={d.total} alto={5} /></span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const critico60 = kpis.porRango['60-90'] || 0;
  const critico90 = kpis.porRango['+90'] || 0;

  return (
    <div className="space-y-4">
      {/* Banda ejecutiva: el único bloque oscuro del dashboard. Su contraste
          es lo que fija la jerarquía — lo primero que se lee, siempre. */}
      <div className="fadeUp overflow-hidden rounded-xl border" style={{ backgroundColor: C.bg1, borderColor: C.b1, borderTopWidth: 2, borderTopColor: C.red, boxShadow: SOMBRA.media }}>
        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.t4 }}>Inventario sobre 60 días</div>
            <div className="mt-2 flex items-baseline gap-2.5">
              <span className="text-[56px] font-semibold leading-none tabular-nums" style={{ color: C.red, letterSpacing: '-0.04em', fontFamily: FUENTE_DATO }}>
                {pf(kpis.pctCritico, 1).replace(' %', '')}
              </span>
              <span className="text-2xl font-medium" style={{ color: C.red, opacity: .55 }}>%</span>
            </div>
            <div className="mt-2 text-sm tabular-nums" style={{ color: C.t2 }}>
              <b style={{ color: C.t1 }}>{nf.format(kpis.critico)}</b> de {nf.format(kpis.total)} unidades
            </div>
            <div className="mt-4 flex gap-5">
              <div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: C.t4 }}>60–90</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums" style={{ color: C.orange }}>{nf.format(critico60)}</div>
              </div>
              <div className="w-px" style={{ backgroundColor: C.b1 }} />
              <div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: C.t4 }}>+90</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums" style={{ color: C.red }}>{nf.format(critico90)}</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.t4 }}>Composición del inventario</div>
            <div className="mt-3 flex w-full overflow-hidden rounded-md" style={{ height: 44 }}>
              {ORDEN_ASC.map(k => {
                const v = kpis.porRango[k] || 0;
                if (!v) return null;
                const pct = v / kpis.total;
                return (
                  <div key={k} className="relative flex items-center justify-center transition-all duration-500"
                    style={{ width: `${pct * 100}%`, backgroundColor: RANGO_BY_KEY[k].color }} title={`${RANGO_BY_KEY[k].label}: ${nf.format(v)}`}>
                    {pct > 0.055 && (
                      <span className="text-[11px] font-semibold tabular-nums" style={{ color: RANGO_BY_KEY[k].sobre }}>{pf(pct, 0)}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
              {RANGOS.slice().reverse().map(r => (
                <div key={r.key} className="flex items-baseline gap-1.5">
                  <span className="h-2 w-2 translate-y-[-1px] rounded-sm" style={{ backgroundColor: r.color }} />
                  <span className="text-[11px]" style={{ color: C.t2 }}>{r.label}</span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(kpis.porRango[r.key] || 0)}</span>
                </div>
              ))}
            </div>

            {/* Diagnóstico calculado en vivo: traduce la concentración a una frase. */}
            {(pBodega || pMarca) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {pMarca && (
                  <div className="rounded-lg border px-3 py-2" style={{ backgroundColor: C.bg3, borderColor: C.b0 }}>
                    <span className="text-lg font-semibold tabular-nums" style={{ color: C.t1 }}>{pMarca.n}</span>
                    <span className="ml-1.5 text-[11px]" style={{ color: C.t2 }}>
                      {pMarca.n === 1 ? 'marca concentra' : `marcas de ${pMarca.de} concentran`} el {pf(pMarca.cobertura, 0)} del inventario crítico
                    </span>
                  </div>
                )}
                {pBodega && (
                  <div className="rounded-lg border px-3 py-2" style={{ backgroundColor: C.bg3, borderColor: C.b0 }}>
                    <span className="text-lg font-semibold tabular-nums" style={{ color: C.t1 }}>{pBodega.n}</span>
                    <span className="ml-1.5 text-[11px]" style={{ color: C.t2 }}>
                      {pBodega.n === 1 ? 'bodega concentra' : `bodegas de ${pBodega.de} concentran`} el {pf(pBodega.cobertura, 0)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Segundo nivel: contexto del inventario, sin competir con la banda. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaKpi titulo="Inventario total" valor={nf.format(kpis.total)} sub={`${nf.format(kpis.items)} ítems · ${nf.format(kpis.referencias)} referencias`} />
        <TarjetaKpi titulo="Lenta rotación" valor={pf(kpis.pctLenta)} color="#D89430" destacado
          contexto={kpis.pctLenta} delta={deltaLenta} sub={`${nf.format(kpis.lenta)} unidades sobre 30 días`} />
        <TarjetaKpi titulo="Crítico extremo" valor={nf.format(critico90)} color="#7A1420" destacado borde="#E8CDD1"
          contexto={kpis.total ? critico90 / kpis.total : 0} sub={`${pf(kpis.total ? critico90 / kpis.total : 0)} del total · +90 días`} />
        <TarjetaKpi titulo="Bodegas" valor={nf.format(kpis.bodegas)}
          sub={pBodega ? `${pBodega.de} con inventario crítico` : 'sin inventario crítico'} />
      </div>

      {/* Tercer nivel: diagnóstico por dimensión. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2"><DonaAntiguedad rows={rows} /></div>

        <div className="grid grid-cols-1 gap-4 lg:col-span-3 lg:grid-cols-2">
          <Ranking titulo="Marcas más críticas" pregunta="¿Quién concentra el problema?" datos={marcas} campo="marca" />
          <Ranking titulo="Bodegas más críticas" pregunta="¿Dónde está físicamente?" datos={bodegas} campo="bodega" />
        </div>
      </div>
    </div>
  );
}

/* Extraído para poder mostrarse tanto en "Días de inventario" (con su tabla)
   como, tal cual, dentro de la sección Gráficos. */
function BarrasRangoDias({ rows, kpis }) {
  const [metrica, setMetrica] = useState('unidades');
  const [hoverIdx, setHoverIdx] = useState(null);
  const resumen = useMemo(() => resumenRangos(rows), [rows]);
  const datos = [...resumen].reverse();   // 0-30 → +90, orden natural de lectura
  const metricas = [
    { key: 'unidades', label: 'Unidades' },
    { key: 'referencias', label: 'Referencias' },
    { key: 'items', label: 'Ítems' },
    { key: 'bodegas', label: 'Bodegas' },
  ];
  const sumaConteos = datos.reduce((a, d) => a + d[metrica], 0);
  const noAditiva = metrica !== 'unidades';

  return (
      <div className="rounded-xl border p-5" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold" style={{ color: C.t1 }}>Comparación por rango de días</div>
            <div className="mt-0.5 text-xs" style={{ color: C.t2 }}>¿El problema es de volumen o de dispersión del catálogo?</div>
          </div>
          <div className="flex gap-1 rounded-md border p-0.5" style={{ borderColor: C.b0 }}>
            {metricas.map(m => (
              <button key={m.key} onClick={() => setMetrica(m.key)}
                className="rounded px-2.5 py-1 text-xs font-medium transition-colors"
                style={{ backgroundColor: metrica === m.key ? C.accent : 'transparent', color: metrica === m.key ? C.bg0 : C.t2 }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} margin={{ top: 22, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke={C.bg3} />
              <XAxis dataKey="short" tick={{ fontSize: 12, fill: C.t2 }} axisLine={{ stroke: C.b0 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.t3 }} axisLine={false} tickLine={false} tickFormatter={v => nf.format(v)} width={56} allowDecimals={false} />
              <RTooltip cursor={{ fill: C.bg0 }}
                content={<TooltipDias metrica={metrica} metricaLabel={metricas.find(m => m.key === metrica).label} baseUnidades={kpis.total} />} />
              <Bar dataKey={metrica} radius={[4, 4, 0, 0]} maxBarSize={24}
                onMouseEnter={(_, i) => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
                {datos.map((d, i) => (
                  <Cell key={d.key} fill={d.color} fillOpacity={hoverIdx === null || hoverIdx === i ? 1 : 0.5} />
                ))}
                <LabelList dataKey={metrica} position="top" offset={8} formatter={v => nf.format(v)}
                  style={{ fill: C.t1, fontSize: 12, fontWeight: 800, fontFamily: FUENTE_DATO }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {noAditiva && (
          <div className="mt-3 flex items-start gap-2 rounded-md px-3 py-2" style={{ backgroundColor: C.yellowDim }}>
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: C.yellow }} />
            <div className="text-[11px] leading-relaxed" style={{ color: C.yellow }}>
              Estos conteos no se suman entre rangos. Un mismo elemento puede aparecer en varios rangos a la vez, ya sea
              porque está en bodegas distintas o porque dentro de una misma bodega tiene existencias de distinta antigüedad.
              La suma de las barras da <b>{nf.format(sumaConteos)}</b>, pero el total real de {metrica} es <b>{nf.format(kpis[metrica === 'items' ? 'items' : metrica === 'referencias' ? 'referencias' : 'bodegas'])}</b>.
            </div>
          </div>
        )}
      </div>
  );
}

function SeccionDias({ rows, kpis }) {
  const resumen = useMemo(() => resumenRangos(rows), [rows]);

  return (
    <div className="space-y-5">
      <BarrasRangoDias rows={rows} kpis={kpis} />

      <div className="overflow-hidden rounded-xl border" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: C.bg0 }}>
              {['Rango', 'Estado', 'Unidades', '% del total', 'Referencias', 'Ítems', 'Bodegas'].map((h, i) => (
                <th key={h} className={`px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider ${i < 2 ? 'text-left' : 'text-right'}`} style={{ color: C.t2 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RANGOS.map(r => {
              const d = resumen.find(x => x.key === r.key);
              return (
                <tr key={r.key} className="border-t" style={{ borderColor: C.bg3 }}>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2 font-medium" style={{ color: C.t1 }}>
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: r.color }} />{r.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: r.tono, color: r.color }}>{r.desc}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(d.unidades)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: C.t2 }}>{pf(kpis.total ? d.unidades / kpis.total : 0)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: C.t2 }}>{nf.format(d.referencias)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: C.t2 }}>{nf.format(d.items)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: C.t2 }}>{nf.format(d.bodegas)}</td>
                </tr>
              );
            })}
            <tr className="border-t-2" style={{ borderColor: C.b1, backgroundColor: C.bg0 }}>
              <td className="px-4 py-2.5 font-semibold" style={{ color: C.t1 }}>Total</td>
              <td />
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(kpis.total)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: C.t2 }}>100,0 %</td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(kpis.referencias)}</td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(kpis.items)}</td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(kpis.bodegas)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PanelCarga({ meta, validacion, hechos, raw }) {
  const cs = validacion.checksum;
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
      <div className="text-sm font-semibold" style={{ color: C.t1 }}>Detalle de la carga</div>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs lg:grid-cols-4">
        {[
          ['Archivo', meta.archivo], ['Hoja', meta.hojaUsada],
          ['Registros del archivo', nf.format(validacion.filasDato)], ['Columnas', nf.format(raw.columns.length)],
          ['Hojas detectadas', raw.sheets.join(', ')], ['Fila de encabezado', meta.filaEncabezado],
          ['Filas normalizadas', nf.format(hechos.length)], ['Fecha de carga', fmtFecha(meta.cargadoEn)],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: C.t3 }}>{k}</div>
            <div className="mt-0.5 truncate font-medium tabular-nums" style={{ color: C.t1 }} title={String(v)}>{v}</div>
          </div>
        ))}
      </div>

      {cs && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            {cs.coincide
              ? <CheckCircle2 className="h-4 w-4" style={{ color: C.green }} />
              : <XCircle className="h-4 w-4" style={{ color: C.red }} />}
            <span className="text-xs font-semibold" style={{ color: cs.coincide ? C.green : C.red }}>
              {cs.coincide ? 'Validado contra la fila de totales del archivo' : 'La suma no coincide con la fila de totales'}
            </span>
          </div>
          <div className="overflow-hidden rounded-md border" style={{ borderColor: C.bg3 }}>
            <table className="w-full text-xs">
              <thead><tr style={{ backgroundColor: C.bg0 }}>
                {['Rango', 'Total en el archivo', 'Suma calculada', 'Diferencia'].map((h, i) => (
                  <th key={h} className={`px-3 py-2 font-medium ${i ? 'text-right' : 'text-left'}`} style={{ color: C.t2 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {ORDEN_ASC.map(k => {
                  const d = cs.declarado[k] ?? 0, c = cs.calculado[k] ?? 0;
                  return (
                    <tr key={k} className="border-t" style={{ borderColor: C.bg3 }}>
                      <td className="px-3 py-1.5" style={{ color: C.t1 }}>{RANGO_BY_KEY[k].label}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: C.t2 }}>{nf.format(d)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: C.t2 }}>{nf.format(c)}</td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums" style={{ color: d === c ? C.green : C.red }}>{nf.format(c - d)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {validacion.avisos.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: C.t2 }}>Observaciones</div>
          {validacion.avisos.map((a, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md px-3 py-2" style={{ backgroundColor: C.yellowDim }}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: C.yellow }} />
              <span className="text-[11px]" style={{ color: C.yellow }}>{a.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Contexto de navegación: permite que cualquier tabla o ranking abra el
   explorador o aplique un filtro global sin encadenar props por toda la vista. */
const DrillCtx = React.createContext({ abrir: () => {}, filtrar: () => {} });

/* ------------------- Ranking y tablas por dimensión ------------------- */

/* Métrica con la que abren los rankings y la matriz. '+90' pone al frente lo
   más viejo, que es donde primero hay que actuar; las demás siguen a un clic. */
const METRICA_INICIAL = '+90';

const METRICAS_DIM = [
  { key: '+90', label: '+90' },
  { key: 'critico', label: 'Crítico ≥60' },
  { key: '60-90', label: '60–90' },
  { key: '30-60', label: '30–60' },
  { key: 'total', label: 'Total' },
  { key: 'pctCritico', label: '% crítico' },
];

// El subtítulo de cada sección tiene que decir con qué vara se está midiendo.
// Antes decía siempre "sobre 60 días" aunque el orden activo fuera +90, y esa
// contradicción hacía parecer que el selector no aplicaba.
const GLOSA_METRICA = {
  '+90':        'unidades con más de 90 días',
  'critico':    'unidades sobre 60 días',
  '60-90':      'unidades entre 60 y 90 días',
  '30-60':      'unidades entre 30 y 60 días',
  'total':      'unidades totales',
  'pctCritico': '% de inventario sobre 60 días',
};

const valorMetrica = (d, m) =>
  m === 'total' ? d.total : m === 'critico' ? d.critico : m === 'pctCritico' ? d.pctCritico : (d.rangos[m] || 0);

const colorMetrica = m => (m === 'total' ? C.t2 : m === 'pctCritico' || m === 'critico' ? C.red : RANGO_BY_KEY[m]?.color || C.t2);

function SelectorMetrica({ valor, onChange, opciones = METRICAS_DIM }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md border p-0.5" style={{ borderColor: C.b0 }}>
      {opciones.map(m => (
        <button key={m.key} onClick={() => onChange(m.key)}
          className="rounded px-2 py-1 text-[11px] font-medium transition-colors"
          style={{ backgroundColor: valor === m.key ? C.accent : 'transparent', color: valor === m.key ? C.bg0 : C.t2 }}>
          {m.label}
        </button>
      ))}
    </div>
  );
}

function RankingBarras({ datos, metrica, onSeleccion, onFiltrar, limite = 15 }) {
  const orden = useMemo(
    () => [...datos].sort((a, b) => valorMetrica(b, metrica) - valorMetrica(a, metrica)).slice(0, limite),
    [datos, metrica, limite]
  );
  const max = Math.max(1e-9, ...orden.map(d => valorMetrica(d, metrica)));
  const esPct = metrica === 'pctCritico';

  if (!orden.length) return <div className="py-10 text-center text-xs" style={{ color: C.t3 }}>Sin datos para los filtros aplicados</div>;

  return (
    <div className="space-y-2.5">
      {orden.map((d, i) => {
        const v = valorMetrica(d, metrica);
        return (
          <div key={d.clave} className="group">
            <div className="flex items-baseline gap-2">
              <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums" style={{ color: C.t4 }}>{String(i + 1).padStart(2, '0')}</span>
              <button onClick={() => onSeleccion?.(d)} className="min-w-0 flex-1 truncate text-left text-xs font-medium hover:underline" style={{ color: C.t1 }}>
                {d.clave}
              </button>
              <button onClick={() => onFiltrar?.(d)} title="Filtrar el dashboard por este elemento"
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                <Filter className="h-3 w-3" style={{ color: C.t2 }} />
              </button>
              <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color: C.t1 }}>
                {esPct ? pf(v, 1) : nf.format(v)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 pl-7">
              <div className="h-1.5 flex-1 overflow-hidden rounded-sm" style={{ backgroundColor: C.bg3 }}>
                <div className="h-full rounded-sm transition-all" style={{ width: `${(v / max) * 100}%`, backgroundColor: colorMetrica(metrica) }} />
              </div>
              <span className="w-24 shrink-0"><BarraComposicion rangos={d.rangos} total={d.total} alto={4} /></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const COLS_DIM = [
  { key: 'clave', label: 'Nombre', tipo: 'txt' },
  { key: 'total', label: 'Total', tipo: 'num' },
  { key: '30-60', label: '30–60', tipo: 'rango' },
  { key: '60-90', label: '60–90', tipo: 'rango' },
  { key: '+90', label: '+90', tipo: 'rango' },
  { key: 'critico', label: 'Crítico', tipo: 'num' },
  { key: 'pctCritico', label: '% crítico', tipo: 'pct' },
  { key: 'items', label: 'Ítems', tipo: 'num' },
  { key: 'bodegas', label: 'Bodegas', tipo: 'num' },
];

function TablaDimension({ datos, columnas = COLS_DIM, etiquetaNombre = 'Nombre', onSeleccion, onFiltrar, topN, extraColKey }) {
  const [orden, setOrden] = useState({ key: 'critico', dir: 'desc' });
  const valor = (d, c) => (c.tipo === 'rango' ? (d.rangos[c.key] || 0) : d[c.key]);

  const filas = useMemo(() => {
    const col = columnas.find(c => c.key === orden.key) || columnas[1];
    const arr = [...datos].sort((a, b) => {
      const va = valor(a, col), vb = valor(b, col);
      const cmp = typeof va === 'string' ? va.localeCompare(vb, 'es') : va - vb;
      return orden.dir === 'asc' ? cmp : -cmp;
    });
    return topN ? arr.slice(0, topN) : arr;
  }, [datos, orden, topN, columnas]);

  const clic = k => setOrden(o => (o.key === k ? { key: k, dir: o.dir === 'desc' ? 'asc' : 'desc' } : { key: k, dir: 'desc' }));

  if (!datos.length) return <div className="py-12 text-center text-xs" style={{ color: C.t3 }}>Sin datos para los filtros aplicados</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ backgroundColor: C.bg0 }}>
            {columnas.map((c, i) => (
              <th key={c.key} onClick={() => clic(c.key)}
                className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 text-[10px] font-medium uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}
                style={{ color: orden.key === c.key ? C.accent : C.t2 }}>
                <span className={`inline-flex items-center gap-1 ${i === 0 ? '' : 'flex-row-reverse'}`}>
                  {i === 0 ? etiquetaNombre : c.label}
                  {orden.key === c.key
                    ? (orden.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)
                    : <ArrowUpDown className="h-3 w-3" style={{ color: C.b1 }} />}
                </span>
              </th>
            ))}
            <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: C.t2, width: 90 }}>Mezcla</th>
            <th style={{ width: 28 }} />
          </tr>
        </thead>
        <tbody>
          {filas.map(d => (
            <tr key={d.clave} className="border-t transition-colors hover:brightness-125" style={{ borderColor: C.bg3 }}>
              {columnas.map((c, i) => {
                const v = valor(d, c);
                if (i === 0) return (
                  <td key={c.key} className="max-w-[220px] px-3 py-2">
                    <button onClick={() => onSeleccion?.(d)} className="truncate text-left font-medium hover:underline" style={{ color: C.t1 }}>{v}</button>
                    {extraColKey && d[extraColKey] && <div className="truncate text-[10px]" style={{ color: C.t3 }}>{d[extraColKey]}</div>}
                  </td>
                );
                return (
                  <td key={c.key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums"
                    style={{ color: c.tipo === 'rango' ? RANGO_BY_KEY[c.key].color : c.key === 'critico' ? C.red : C.t2,
                             fontWeight: c.key === 'critico' || c.key === 'total' ? 600 : 400 }}>
                    {c.tipo === 'pct' ? pf(v, 1) : nf.format(v)}
                  </td>
                );
              })}
              <td className="px-3 py-2"><BarraComposicion rangos={d.rangos} total={d.total} alto={5} /></td>
              <td className="px-1 py-2">
                <button onClick={() => onFiltrar?.(d)} title="Filtrar el dashboard por este elemento">
                  <Filter className="h-3 w-3" style={{ color: C.t4 }} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ControlTop({ valor, onChange, total }) {
  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5" style={{ borderColor: C.b0 }}>
      {[10, 20, 50, null].map(n => (
        <button key={String(n)} onClick={() => onChange(n)}
          className="rounded px-2 py-1 text-[11px] font-medium transition-colors"
          style={{ backgroundColor: valor === n ? C.accent : 'transparent', color: valor === n ? C.bg0 : C.t2 }}>
          {n ? `Top ${n}` : `Todas (${nf.format(total)})`}
        </button>
      ))}
    </div>
  );
}

/* -------------------------- Drill-down lateral --------------------------
   El explorador no tiene una jerarquía única: la ruta depende de por dónde
   entró el usuario. Entrar por una bodega y pedir "qué hay dentro" es tan
   válido como bajar desde una marca, así que la secuencia es un dato, no
   una cadena de condicionales. Agregar un camino nuevo es agregar una fila. */

/* La ruta sigue la cadena de decisión operativa: quién (marca) → qué producto
   (referencia) → qué diseño (gráfico) → dónde está físicamente y cuánto hay
   (bodega) → el ítem exacto, que es el último detalle. La bodega va antes del
   ítem a propósito: es el nivel sobre el que se actúa (mover, liquidar). */
const JERARQUIAS = {
  marca:      ['marca', 'referencia', 'grafico', 'bodega', 'item'],
  referencia: ['marca', 'referencia', 'grafico', 'bodega', 'item'],
  grafico:    ['grafico', 'referencia', 'bodega', 'item'],
  bodega:     ['bodega', 'marca', 'referencia', 'grafico', 'item'],
  // Las dimensiones de clasificación (origen, línea, tipo) son el nivel más
  // alto: desde ellas se baja a marca y de ahí a la cadena normal.
  origen:        ['origen', 'linea', 'marca', 'referencia', 'bodega'],
  linea:         ['linea', 'tipo_producto', 'marca', 'referencia', 'bodega'],
  tipo_producto: ['tipo_producto', 'marca', 'referencia', 'grafico', 'bodega'],
};

const CAMPO_META = {
  marca:      { plural: 'Marcas',      singular: 'Marca',      icono: Tag,      mono: false },
  referencia: { plural: 'Referencias', singular: 'Referencia', icono: Layers,   mono: false },
  item:       { plural: 'Ítems',       singular: 'Ítem',       icono: Package,  mono: true },
  bodega:     { plural: 'Bodegas',     singular: 'Bodega',     icono: Warehouse, mono: true },
  grafico:    { plural: 'Gráficos',    singular: 'Gráfico',    icono: Palette,  mono: false },
  origen:     { plural: 'Orígenes',    singular: 'Origen',     icono: Globe,    mono: false },
  linea:      { plural: 'Líneas',      singular: 'Línea',      icono: Boxes,    mono: false },
  tipo_producto: { plural: 'Tipos de producto', singular: 'Tipo de producto', icono: Shapes, mono: false },
};

/* Dimensiones que solo existen si el archivo cargado trae su columna. Cada una
   se convierte, si está presente, en un filtro del encabezado y en una sección
   de análisis. Definirlas en un solo lugar evita tener la misma condición
   repetida en el estado, los filtros, las secciones y la exportación. */
const DIMS_OPCIONALES = [
  { campo: 'origen',        etiqueta: 'Origen',           seccion: 'Origen',
    pregunta: '¿El inventario lento viene de importado o nacional?' },
  { campo: 'linea',         etiqueta: 'Línea',            seccion: 'Línea',
    pregunta: '¿Qué línea concentra el inventario lento?' },
  { campo: 'tipo_producto', etiqueta: 'Tipo de producto', seccion: 'Tipo de producto',
    pregunta: '¿Qué tipo de producto rota más lento?' },
  { campo: 'grafico',       etiqueta: 'Gráfico',          seccion: 'Gráficos',
    pregunta: '¿Qué diseños gráficos concentran el inventario lento?' },
];
const CAMPOS_OPCIONALES = DIMS_OPCIONALES.map(d => d.campo);

/* Orden de los filtros en el encabezado: va de lo más general (de dónde viene,
   qué línea) a lo más específico (qué diseño), y la bodega —el "dónde está"—
   cierra la fila. Los campos opcionales que el archivo no traiga se omiten. */
const ORDEN_FILTROS = [
  ['origen', 'Origen'],
  ['linea', 'Línea'],
  ['marca', 'Marca'],
  ['tipo_producto', 'Tipo de producto'],
  ['referencia', 'Referencia'],
  ['grafico', 'Gráfico'],
  ['bodega', 'Bodega'],
];

function PanelDetalle({ hechos, ruta, setRuta, onCerrar, onFiltrar }) {
  const via = ruta.via || 'marca';
  const valores = ruta.valores || {};
  // Las dimensiones opcionales solo existen si el archivo trae su columna:
  // las que falten se descuelgan de la ruta en vez de mostrar un nivel vacío.
  const disponibles = useMemo(() => {
    const s = new Set();
    for (const c of CAMPOS_OPCIONALES) if (hechos.some(h => h[c] != null)) s.add(c);
    return s;
  }, [hechos]);
  const jerarquia = useMemo(() => {
    const base = JERARQUIAS[via] || JERARQUIAS.marca;
    return base.filter(c => !CAMPOS_OPCIONALES.includes(c) || disponibles.has(c));
  }, [via, disponibles]);

  const alcance = useMemo(
    () => hechos.filter(h => jerarquia.every(c => valores[c] == null || h[c] === valores[c])),
    [hechos, jerarquia, valores]
  );
  const kpis = useMemo(() => calcularKpis(alcance), [alcance]);

  // Nivel actual = primer campo de la ruta todavía sin valor. Si no queda
  // ninguno, estamos en la hoja y solo cabe mostrar el desglose por antigüedad.
  const nivel = jerarquia.find(c => valores[c] == null) || null;
  const esUltimo = nivel ? jerarquia.indexOf(nivel) === jerarquia.length - 1 : true;

  const hijos = useMemo(
    () => (nivel ? porDimension(alcance, nivel).sort((a, b) => b.critico - a.critico || b.total - a.total) : []),
    [alcance, nivel]
  );

  const migas = jerarquia
    .filter(c => valores[c] != null)
    .map(c => ({
      campo: c, label: valores[c], meta: CAMPO_META[c],
      al: { via, valores: Object.fromEntries(jerarquia.slice(0, jerarquia.indexOf(c) + 1).filter(x => valores[x] != null).map(x => [x, valores[x]])) },
    }));

  const meta = nivel ? CAMPO_META[nivel] : null;
  const IconoNivel = meta?.icono || Package;

  const bajar = clave => setRuta({ via, valores: { ...valores, [nivel]: clave } });

  return (
    <>
      <div className="fixed inset-0 z-30" style={{ backgroundColor: 'rgba(20,24,31,0.28)' }} onClick={onCerrar} />
      <aside className="fixed right-0 top-0 z-40 flex h-full w-full max-w-xl flex-col shadow-2xl" style={{ backgroundColor: C.bg1 }}>
        <div className="flex items-start justify-between gap-3 border-b px-5 py-3.5" style={{ borderColor: C.b0 }}>
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: C.t3 }}>
              Explorador · entrada por {CAMPO_META[via].singular.toLowerCase()}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
              {migas.map((m, i) => (
                <React.Fragment key={m.campo}>
                  {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" style={{ color: C.t4 }} />}
                  <button onClick={() => setRuta(m.al)}
                    className={`max-w-[170px] truncate rounded px-1.5 py-0.5 font-medium hover:brightness-125 ${m.meta.mono ? 'font-mono' : ''}`}
                    style={{ color: i === migas.length - 1 ? C.accent : C.t2 }}
                    title={`${m.meta.singular}: ${m.label}`}>
                    {m.label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
          <button onClick={onCerrar} className="shrink-0 rounded p-1 hover:brightness-125"><X className="h-4 w-4" style={{ color: C.t2 }} /></button>
        </div>

        <div className="border-b px-5 py-3" style={{ borderColor: C.bg3, backgroundColor: C.bg0 }}>
          <div className="grid grid-cols-4 gap-3">
            {[['Unidades', nf.format(kpis.total), C.t1],
              ['Crítico ≥60', nf.format(kpis.critico), C.red],
              ['% crítico', pf(kpis.pctCritico, 1), C.red],
              [meta ? meta.plural : 'Registros', nf.format(meta ? hijos.length : alcance.length), C.t1]].map(([k, v, c]) => (
              <div key={k}>
                <div className="truncate text-[10px] uppercase tracking-wider" style={{ color: C.t3 }}>{k}</div>
                <div className="mt-0.5 text-base font-semibold tabular-nums" style={{ color: c }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-2.5"><BarraComposicion rangos={kpis.porRango} total={kpis.total} alto={6} /></div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!nivel ? (
            <>
              <div className="mb-3 text-xs font-semibold" style={{ color: C.t1 }}>Desglose por antigüedad</div>
              <div className="space-y-2">
                {ORDEN_ASC.filter(k => kpis.porRango[k]).map(k => (
                  <div key={k} className="flex items-center gap-3 rounded-md border p-3" style={{ borderColor: C.bg3 }}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: RANGO_BY_KEY[k].color }} />
                    <span className="flex-1 text-xs font-medium" style={{ color: C.t1 }}>{RANGO_BY_KEY[k].label}</span>
                    <span className="text-xs tabular-nums" style={{ color: C.t2 }}>{pf(kpis.porRango[k] / kpis.total, 1)}</span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: RANGO_BY_KEY[k].color }}>{nf.format(kpis.porRango[k])}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-md px-3 py-2 text-[11px] leading-relaxed" style={{ backgroundColor: C.bg0, color: C.t2 }}>
                Una misma combinación puede tener existencias de varias antigüedades a la vez si entró en fechas distintas.
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <IconoNivel className="h-3.5 w-3.5" style={{ color: C.t2 }} />
                <span className="text-xs font-semibold" style={{ color: C.t1 }}>{meta.plural}</span>
                <span className="text-xs tabular-nums" style={{ color: C.t3 }}>({nf.format(hijos.length)})</span>
                <span className="ml-auto text-[10px]" style={{ color: C.t3 }}>
                  {esUltimo ? 'Último nivel' : 'Clic para profundizar'}
                </span>
              </div>

              {hijos.length === 0 && (
                <div className="py-12 text-center text-xs" style={{ color: C.t3 }}>Sin registros en este nivel</div>
              )}

              <div className="space-y-1">
                {hijos.map(h => (
                  <div key={h.clave} className="rounded-md border p-2.5 transition-colors hover:brightness-125" style={{ borderColor: C.bg3 }}>
                    <div className="flex items-baseline gap-2">
                      {esUltimo ? (
                        <span className={`min-w-0 flex-1 truncate text-xs font-medium ${meta.mono ? 'font-mono' : ''}`} style={{ color: C.t1 }}>{h.clave}</span>
                      ) : (
                        <button onClick={() => bajar(h.clave)}
                          className={`min-w-0 flex-1 truncate text-left text-xs font-medium hover:underline ${meta.mono ? 'font-mono' : ''}`}
                          style={{ color: C.t1 }}>
                          {h.clave}
                        </button>
                      )}
                      <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(h.total)}</span>
                      {h.critico > 0 && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums" style={{ backgroundColor: C.orangeDim, color: C.red }}>
                          {nf.format(h.critico)} crítico
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <div className="min-w-[80px] flex-1"><BarraComposicion rangos={h.rangos} total={h.total} alto={5} /></div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        {ORDEN_ASC.filter(k => h.rangos[k]).map(k => (
                          <span key={k} className="text-[10px] tabular-nums" style={{ color: RANGO_BY_KEY[k].color }}>
                            {RANGO_BY_KEY[k].short}: <b>{nf.format(h.rangos[k])}</b>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-1 text-[10px] tabular-nums" style={{ color: C.t3 }}>
                      {[
                        nivel !== 'item' ? `${nf.format(h.items)} ítems` : null,
                        nivel !== 'bodega' ? `${nf.format(h.bodegas)} bodegas` : null,
                        nivel !== 'referencia' && nivel !== 'item' ? `${nf.format(h.refs)} referencias` : null,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 border-t px-5 py-3" style={{ borderColor: C.b0 }}>
          <button onClick={() => { onFiltrar(valores); onCerrar(); }}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: C.accent }}>
            Filtrar el dashboard por esta selección
          </button>
          <span className="text-[11px]" style={{ color: C.t3 }}>{nf.format(alcance.length)} registros</span>
        </div>
      </aside>
    </>
  );
}

/* ------------------------ Secciones 03 · 04 · 05 ------------------------ */

function AvisoPctCritico({ visible }) {
  if (!visible) return null;
  return (
    <div className="mt-3 flex items-start gap-2 rounded-md px-3 py-2" style={{ backgroundColor: C.yellowDim }}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: C.yellow }} />
      <div className="text-[11px] leading-relaxed" style={{ color: C.yellow }}>
        El porcentaje mide gravedad, no tamaño. Un elemento con 40 unidades y 100 % crítico encabezará este orden
        por encima de otro con 16.000 unidades críticas. Usa el umbral para descartar los casos pequeños.
      </div>
    </div>
  );
}

function SeccionDimension({ rows, campo, titulo, pregunta, etiqueta, mono }) {
  const [metrica, setMetrica] = useState(METRICA_INICIAL);
  const [umbral, setUmbral] = useState(0);
  const [top, setTop] = useState(20);
  const base = useMemo(() => porDimension(rows, campo), [rows, campo]);
  const datos = useMemo(() => (metrica === 'pctCritico' && umbral > 0 ? base.filter(d => d.total >= umbral) : base), [base, metrica, umbral]);
  const ctx = React.useContext(DrillCtx);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-5" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold" style={{ color: C.t1 }}>{titulo}</div>
            <div className="mt-0.5 text-xs" style={{ color: C.t2 }}>
              {pregunta} <span style={{ color: C.t3 }}>· orden: {GLOSA_METRICA[metrica]}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {metrica === 'pctCritico' && (
              <label className="flex items-center gap-1.5 text-[11px]" style={{ color: C.t2 }}>
                Mínimo
                <input type="number" min={0} step={50} value={umbral} onChange={e => setUmbral(Math.max(0, Number(e.target.value) || 0))}
                  className="w-20 rounded border px-1.5 py-1 text-right text-[11px] tabular-nums" style={{ borderColor: C.b0 }} />
                unidades
              </label>
            )}
            <SelectorMetrica valor={metrica} onChange={setMetrica} />
          </div>
        </div>
        <div className="mt-5">
          <RankingBarras datos={datos} metrica={metrica} limite={15}
            onSeleccion={d => ctx.abrir({ via: campo, valores: { [campo]: d.clave } })}
            onFiltrar={d => ctx.filtrar({ [campo]: [d.clave] })} />
        </div>
        <AvisoPctCritico visible={metrica === 'pctCritico'} />
      </div>

      <div className="overflow-hidden rounded-xl border" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: C.bg3 }}>
          <div className="text-sm font-semibold" style={{ color: C.t1 }}>Detalle por {etiqueta.toLowerCase()}</div>
          <ControlTop valor={top} onChange={setTop} total={base.length} />
        </div>
        <TablaDimension datos={datos} topN={top} etiquetaNombre={etiqueta}
          onSeleccion={d => ctx.abrir({ via: campo, valores: { [campo]: d.clave } })}
          onFiltrar={d => ctx.filtrar({ [campo]: [d.clave] })} />
      </div>
    </div>
  );
}

const COLS_REF = [
  { key: 'clave', label: 'Referencia', tipo: 'txt' },
  { key: 'total', label: 'Total', tipo: 'num' },
  { key: '30-60', label: '30–60', tipo: 'rango' },
  { key: '60-90', label: '60–90', tipo: 'rango' },
  { key: '+90', label: '+90', tipo: 'rango' },
  { key: 'critico', label: 'Crítico', tipo: 'num' },
  { key: 'pctCritico', label: '% crítico', tipo: 'pct' },
  { key: 'items', label: 'Ítems', tipo: 'num' },
  { key: 'bodegas', label: 'Bodegas', tipo: 'num' },
];

function SeccionReferencias({ rows }) {
  const [top, setTop] = useState(20);
  const ctx = React.useContext(DrillCtx);
  // Agrupa por ref_key (marca + referencia): dos marcas pueden compartir el mismo código.
  const datos = useMemo(() => {
    const arr = porDimension(rows, 'ref_key');
    return arr.map(d => {
      const [marca, referencia] = d.clave.split('‖');
      return { ...d, clave: referencia, marca, _refKey: d.clave };
    });
  }, [rows]);
  const compartidas = useMemo(() => {
    const m = new Map();
    for (const d of datos) m.set(d.clave, (m.get(d.clave) || 0) + 1);
    return [...m.values()].filter(v => v > 1).length;
  }, [datos]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5" style={{ borderColor: C.bg3 }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: C.t1 }}>Referencias críticas</div>
            <div className="mt-0.5 text-xs" style={{ color: C.t2 }}>¿Qué referencias son las principales responsables?</div>
          </div>
          <ControlTop valor={top} onChange={setTop} total={datos.length} />
        </div>
        <TablaDimension datos={datos} columnas={COLS_REF} topN={top} etiquetaNombre="Referencia" extraColKey="marca"
          onSeleccion={d => ctx.abrir({ via: 'marca', valores: { marca: d.marca, referencia: d.clave } })}
          onFiltrar={d => ctx.filtrar({ marca: [d.marca], referencia: [d.clave] })} />
      </div>
      {compartidas > 0 && (
        <div className="flex items-start gap-2 rounded-lg border px-4 py-2.5" style={{ borderColor: C.b0, backgroundColor: C.bg2 }}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: C.yellow }} />
          <div className="text-[11px] leading-relaxed" style={{ color: C.t2 }}>
            {compartidas} código{compartidas > 1 ? 's' : ''} de referencia aparece{compartidas > 1 ? 'n' : ''} en más de una marca.
            Cada combinación se cuenta por separado; la marca se muestra bajo el código.
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- Sección 06 · Cruces ------------------------- */

/* Escala perceptual: la raíz cuadrada evita que un solo valor extremo deje
   el resto de la matriz en un blanco indistinguible. */
const tintaHeat = (t) => {
  if (t <= 0) return C.t1;
  const k = Math.sqrt(Math.min(1, t));
  const [r, g, b] = [122, 20, 32];
  return `rgb(${Math.round(255 - (255 - r) * k)},${Math.round(255 - (255 - g) * k)},${Math.round(255 - (255 - b) * k)})`;
};

const METRICAS_HEAT = [
  { key: '+90', label: '+90', filtra: r => r.rango_dias === '+90' },
  { key: 'critico', label: 'Crítico ≥60', filtra: r => CRITICOS.includes(r.rango_dias) },
  { key: '60-90', label: '60–90', filtra: r => r.rango_dias === '60-90' },
  { key: 'total', label: 'Total', filtra: () => true },
];

function Heatmap({ rows }) {
  const [todas, setTodas] = useState(false);
  const [metrica, setMetrica] = useState(METRICA_INICIAL);
  const [normalizar, setNormalizar] = useState(false);
  const [foco, setFoco] = useState(null);      // { f, c } para el cross-hair
  const [hover, setHover] = useState(null);
  const ctx = React.useContext(DrillCtx);

  const M = METRICAS_HEAT.find(m => m.key === metrica);

  const d = useMemo(() => {
    const val = r => (M.filtra(r) ? r.unidades : 0);
    const universo = rows.reduce((a, r) => a + val(r), 0);

    const acumular = campo => {
      const m = new Map();
      for (const r of rows) m.set(r[campo], (m.get(r[campo]) || 0) + val(r));
      return [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    };
    const rankBod = acumular('bodega'), rankMar = acumular('marca');
    const filas = (todas ? rankBod : rankBod.slice(0, 12)).map(([k]) => k);
    const cols = (todas ? rankMar : rankMar.slice(0, 12)).map(([k]) => k);
    const setF = new Set(filas), setC = new Set(cols);

    const celdas = new Map();
    const totF = new Map(), totC = new Map();
    let cubierto = 0;
    for (const r of rows) {
      const v = val(r);
      if (!v || !setF.has(r.bodega) || !setC.has(r.marca)) continue;
      const k = `${r.bodega}‖${r.marca}`;
      let e = celdas.get(k);
      if (!e) { e = { bodega: r.bodega, marca: r.marca, valor: 0, total: 0, rangos: {} }; celdas.set(k, e); }
      e.valor += v;
      totF.set(r.bodega, (totF.get(r.bodega) || 0) + v);
      totC.set(r.marca, (totC.get(r.marca) || 0) + v);
      cubierto += v;
    }
    // El inventario completo de cada celda, para dar contexto en el tooltip.
    for (const r of rows) {
      const k = `${r.bodega}‖${r.marca}`;
      const e = celdas.get(k);
      if (!e) continue;
      e.total += r.unidades;
      e.rangos[r.rango_dias] = (e.rangos[r.rango_dias] || 0) + r.unidades;
    }
    const maxCelda = Math.max(1, ...[...celdas.values()].map(c => c.valor));
    return { filas, cols, celdas, totF, totC, maxCelda, universo, cubierto,
             maxF: Math.max(1, ...totF.values()), maxC: Math.max(1, ...totC.values()) };
  }, [rows, todas, M]);

  if (!d.filas.length) return (
    <div className="rounded-xl border py-16 text-center" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
      <div className="text-sm font-medium" style={{ color: C.t1 }}>No hay inventario en esta métrica</div>
      <div className="mt-1 text-xs" style={{ color: C.t2 }}>Cambia la métrica o ajusta los filtros.</div>
    </div>
  );

  const intensidad = (e, bodega) => {
    if (!e || !e.valor) return 0;
    return normalizar ? e.valor / (d.totF.get(bodega) || 1) : e.valor / d.maxCelda;
  };

  const grid = { display: 'grid', gridTemplateColumns: `112px repeat(${d.cols.length}, minmax(46px, 1fr)) 76px` };

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold" style={{ color: C.t1 }}>Concentración por bodega y marca</div>
          <div className="mt-0.5 text-[11px]" style={{ color: C.t2 }}>
            {normalizar
              ? '¿Qué marca domina el problema dentro de cada bodega?'
              : '¿Qué cruce de bodega y marca acumula más unidades?'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectorMetrica valor={metrica} onChange={setMetrica} opciones={METRICAS_HEAT} />
          <button onClick={() => setNormalizar(n => !n)}
            className="rounded-md border px-2.5 py-1 text-[10px] font-semibold transition-colors"
            style={{ borderColor: normalizar ? C.accent : C.b0, backgroundColor: normalizar ? C.accent : 'transparent', color: normalizar ? C.bg0 : C.t2 }}>
            % por bodega
          </button>
          <button onClick={() => setTodas(t => !t)}
            className="rounded-md border px-2.5 py-1 text-[10px] font-semibold transition-colors"
            style={{ borderColor: todas ? C.accent : C.b0, backgroundColor: todas ? C.accent : 'transparent', color: todas ? C.bg0 : C.t2 }}>
            {todas ? 'Principales' : 'Matriz completa'}
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: C.t3 }}>
        <span>{nf.format(d.filas.length)} bodegas × {nf.format(d.cols.length)} marcas</span>
        <span>Cubre <b style={{ color: C.t2 }}>{pf(d.universo ? d.cubierto / d.universo : 0, 1)}</b> de {nf.format(d.universo)} unidades</span>
        <span>Midiendo <b style={{ color: C.t2 }}>{GLOSA_METRICA[metrica]}</b></span>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="min-w-[680px]">
          {/* Encabezado de marcas */}
          <div style={grid}>
            <div />
            {d.cols.map(c => (
              <div key={c} className="px-0.5 pb-1.5 text-center">
                <div className="truncate text-[10px] font-semibold transition-colors" title={c}
                  style={{ color: foco?.c === c ? C.accent : C.t2 }}>{c}</div>
              </div>
            ))}
            <div className="pb-1.5 pl-2 text-[9px] font-semibold uppercase tracking-wider" style={{ color: C.t3 }}>Total</div>
          </div>

          {/* Cuerpo */}
          {d.filas.map(f => {
            const tf = d.totF.get(f) || 0;
            const activa = foco?.f === f;
            return (
              <div key={f} style={grid} className="group">
                <div className="flex items-center justify-end gap-1.5 pr-2 transition-colors">
                  <span className="truncate font-mono text-[10px] font-medium" title={f}
                    style={{ color: activa ? C.accent : C.t2 }}>{f}</span>
                </div>
                {d.cols.map(c => {
                  const e = d.celdas.get(`${f}‖${c}`);
                  const v = e?.valor || 0;
                  const t = intensidad(e, f);
                  const atenuar = foco && !activa && foco.c !== c;
                  return (
                    <button key={c}
                      onMouseEnter={ev => { setFoco({ f, c }); if (v) setHover({ e, tf, x: ev.clientX, y: ev.clientY }); }}
                      onMouseMove={ev => v && setHover(h => (h ? { ...h, x: ev.clientX, y: ev.clientY } : h))}
                      onMouseLeave={() => { setFoco(null); setHover(null); }}
                      onClick={() => v && ctx.filtrar({ bodega: [f], marca: [c] })}
                      disabled={!v}
                      className="m-[1.5px] flex h-[34px] items-center justify-center rounded text-[10px] font-semibold tabular-nums transition-all disabled:cursor-default"
                      style={{
                        backgroundColor: v ? tintaHeat(t) : C.bg1,
                        border: `1px solid ${v ? 'transparent' : C.bg3}`,
                        color: t > 0.42 ? C.t1 : C.t2,
                        opacity: atenuar ? 0.32 : 1,
                        outline: foco?.f === f && foco?.c === c ? '2px solid #0F1319' : 'none',
                        outlineOffset: '-1px',
                      }}>
                      {v ? (normalizar ? `${Math.round(t * 100)}` : v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v) : ''}
                    </button>
                  );
                })}
                {/* Total marginal de la bodega */}
                <div className="flex items-center gap-1.5 pl-2">
                  <div className="h-[5px] w-full overflow-hidden rounded-full" style={{ backgroundColor: C.bg3 }}>
                    <div className="h-full rounded-full" style={{ width: `${(tf / d.maxF) * 100}%`, backgroundColor: activa ? C.accent : C.orange }} />
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold tabular-nums" style={{ color: activa ? C.accent : C.t2 }}>
                    {tf >= 1000 ? `${(tf / 1000).toFixed(1)}k` : tf}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Totales marginales por marca */}
          <div style={{ ...grid, borderTop: '1px solid #EFF1F4', marginTop: 6, paddingTop: 8 }}>
            <div className="pr-2 text-right text-[9px] font-semibold uppercase tracking-wider" style={{ color: C.t3 }}>Total</div>
            {d.cols.map(c => {
              const tc = d.totC.get(c) || 0;
              return (
                <div key={c} className="px-[1.5px]">
                  <div className="h-[5px] w-full overflow-hidden rounded-full" style={{ backgroundColor: C.bg3 }}>
                    <div className="h-full rounded-full" style={{ width: `${(tc / d.maxC) * 100}%`, backgroundColor: foco?.c === c ? C.accent : C.orange }} />
                  </div>
                  <div className="mt-1 text-center text-[9px] font-semibold tabular-nums" style={{ color: foco?.c === c ? C.accent : C.t2 }}>
                    {tc >= 1000 ? `${(tc / 1000).toFixed(1)}k` : tc}
                  </div>
                </div>
              );
            })}
            <div className="pl-2 text-[10px] font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(d.cubierto)}</div>
          </div>
        </div>
      </div>

      {/* Leyenda con valores reales de la escala */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[10px]" style={{ color: C.t3 }}>{normalizar ? '0 %' : '0'}</span>
        <div className="flex overflow-hidden rounded">
          {[0.1, 0.3, 0.5, 0.75, 1].map(t => (
            <div key={t} className="h-2.5 w-9" style={{ backgroundColor: tintaHeat(t) }} />
          ))}
        </div>
        <span className="text-[10px]" style={{ color: C.t3 }}>
          {normalizar ? '100 % de la bodega' : `${nf.format(d.maxCelda)} unidades`}
        </span>
        <span className="ml-auto text-[10px]" style={{ color: C.t4 }}>Clic en una celda para filtrar el dashboard</span>
      </div>

      {hover && (
        <div className="pointer-events-none fixed z-50 rounded-lg border px-3 py-2.5 text-xs"
          style={{ borderColor: C.b0, backgroundColor: C.bg2, boxShadow: SOMBRA.alta, minWidth: 200,
                   left: Math.min(hover.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 240),
                   top: Math.min(hover.y + 14, (typeof window !== 'undefined' ? window.innerHeight : 800) - 200) }}>
          <div className="font-semibold" style={{ color: C.t1 }}>
            <span className="font-mono">{hover.e.bodega}</span> · {hover.e.marca}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold tabular-nums" style={{ color: C.red }}>{nf.format(hover.e.valor)}</span>
            <span className="text-[10px]" style={{ color: C.t2 }}>unidades · {M.label}</span>
          </div>
          <div className="mt-2 space-y-0.5 tabular-nums" style={{ color: C.t2 }}>
            <div className="text-[11px]">Inventario de la celda: <b>{nf.format(hover.e.total)}</b></div>
            {ORDEN_ASC.filter(k => hover.e.rangos[k]).map(k => (
              <div key={k} className="flex items-center gap-1.5 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: RANGO_BY_KEY[k].color }} />
                <span className="flex-1">{RANGO_BY_KEY[k].label}</span>
                <b>{nf.format(hover.e.rangos[k])}</b>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t pt-1.5 text-[11px] tabular-nums" style={{ borderColor: C.bg3, color: C.t2 }}>
            {pf(hover.tf ? hover.e.valor / hover.tf : 0, 1)} del total de la bodega
          </div>
        </div>
      )}
    </div>
  );
}

const COLS_CRUCE = [
  { key: 'clave', label: 'Referencia', tipo: 'txt' },
  { key: 'total', label: 'Total', tipo: 'num' },
  { key: '30-60', label: '30–60', tipo: 'rango' },
  { key: '60-90', label: '60–90', tipo: 'rango' },
  { key: '+90', label: '+90', tipo: 'rango' },
  { key: 'critico', label: 'Crítico', tipo: 'num' },
  { key: 'pctCritico', label: '% crítico', tipo: 'pct' },
  { key: 'items', label: 'Ítems', tipo: 'num' },
];

function SeccionMulti({ rows }) {
  const [top, setTop] = useState(20);
  const ctx = React.useContext(DrillCtx);
  const cruce = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const k = `${r.ref_key}‖${r.bodega}`;
      let e = m.get(k);
      if (!e) e = { clave: r.referencia, marca: r.marca, bodega: r.bodega, total: 0, rangos: {}, _items: new Set() }, m.set(k, e);
      e.total += r.unidades;
      e.rangos[r.rango_dias] = (e.rangos[r.rango_dias] || 0) + r.unidades;
      e._items.add(r.item);
    }
    return [...m.values()].map(e => {
      const critico = CRITICOS.reduce((a, k) => a + (e.rangos[k] || 0), 0);
      return { ...e, items: e._items.size, bodegas: 1, critico, pctCritico: e.total ? critico / e.total : 0 };
    });
  }, [rows]);

  return (
    <div className="space-y-4">
      <Heatmap rows={rows} />
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5" style={{ borderColor: C.bg3 }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: C.t1 }}>Referencia por bodega</div>
            <div className="mt-0.5 text-xs" style={{ color: C.t2 }}>¿Qué referencias están concentradas en qué bodegas?</div>
          </div>
          <ControlTop valor={top} onChange={setTop} total={cruce.length} />
        </div>
        <TablaDimension datos={cruce} columnas={COLS_CRUCE} topN={top} etiquetaNombre="Referencia" extraColKey="bodega"
          onSeleccion={d => ctx.abrir({ via: 'marca', valores: { marca: d.marca, referencia: d.clave } })}
          onFiltrar={d => ctx.filtrar({ marca: [d.marca], referencia: [d.clave], bodega: [d.bodega] })} />
      </div>
    </div>
  );
}

/* --------------------- Sección 07 · Priorización --------------------- */

const POR_PAGINA = 50;

function SeccionPrioridad({ rows, kpis, bodegaUnica }) {
  const [pagina, setPagina] = useState(0);
  const [orden, setOrden] = useState({ key: 'prioridad', dir: 'desc' });
  const ctx = React.useContext(DrillCtx);

  // Solo se ofrece si el archivo trae la columna — no se inventa un cero.
  const tieneDisponible = useMemo(() => rows.some(r => r.disponible != null), [rows]);

  // Vista tipo SIESA: un ítem por fila con la existencia total (sumada entre
  // rangos de días, que es como SIESA la reporta), solo cuando el filtro deja
  // una única bodega — si hay varias mezcladas no tiene sentido "un total".
  const detalleBodega = useMemo(() => {
    if (!bodegaUnica) return null;
    const porItem = new Map();
    for (const r of rows) {
      if (!porItem.has(r.item)) {
        porItem.set(r.item, { item: r.item, marca: r.marca, referencia: r.referencia, existencia: 0, disponible: 0, faltaDisponible: false });
      }
      const acc = porItem.get(r.item);
      acc.existencia += r.unidades;
      if (r.disponible == null) acc.faltaDisponible = true;
      else acc.disponible += r.disponible;
    }
    const items = [...porItem.values()].sort((a, b) => b.existencia - a.existencia);
    const totales = items.reduce((a, it) => ({
      existencia: a.existencia + it.existencia,
      disponible: a.disponible + (it.faltaDisponible ? 0 : it.disponible),
    }), { existencia: 0, disponible: 0 });
    return { items, totales, tieneDisponible: items.some(it => !it.faltaDisponible) };
  }, [rows, bodegaUnica]);

  const ordenadas = useMemo(() => {
    const arr = [...rows];
    const cmp = {
      prioridad: (a, b) => (b.nivel_criticidad - a.nivel_criticidad) || (b.unidades - a.unidades),
      unidades: (a, b) => b.unidades - a.unidades,
      disponible: (a, b) => (b.disponible ?? 0) - (a.disponible ?? 0),
      marca: (a, b) => a.marca.localeCompare(b.marca, 'es'),
      referencia: (a, b) => a.referencia.localeCompare(b.referencia, 'es'),
      item: (a, b) => String(a.item).localeCompare(String(b.item), 'es', { numeric: true }),
      bodega: (a, b) => a.bodega.localeCompare(b.bodega, 'es'),
    }[orden.key];
    arr.sort(orden.dir === 'desc' ? cmp : (a, b) => -cmp(a, b));
    return arr;
  }, [rows, orden]);

  const paginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas - 1);
  const vista = ordenadas.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA);
  const clic = k => { setOrden(o => (o.key === k ? { key: k, dir: o.dir === 'desc' ? 'asc' : 'desc' } : { key: k, dir: 'desc' })); setPagina(0); };

  const cols = [
    { key: 'prioridad', label: 'Prioridad', al: 'left' },
    { key: 'marca', label: 'Marca', al: 'left' },
    { key: 'referencia', label: 'Referencia', al: 'left' },
    { key: 'item', label: 'Ítem', al: 'left' },
    { key: 'bodega', label: 'Bodega', al: 'left' },
    { key: 'unidades', label: 'Unidades', al: 'right' },
    ...(tieneDisponible ? [{ key: 'disponible', label: 'Disponible', al: 'right' }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {RANGOS.map(r => (
          <div key={r.key} className="rounded-xl border p-3.5" style={{ borderColor: C.b0, borderLeftWidth: 3, borderLeftColor: r.color }}>
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: r.color }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />{r.desc}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(kpis.porRango[r.key] || 0)}</div>
            <div className="text-[11px]" style={{ color: C.t2 }}>{r.label} · {nf.format(rows.filter(x => x.rango_dias === r.key).length)} registros</div>
          </div>
        ))}
      </div>

      {detalleBodega && (
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5" style={{ borderColor: C.bg3 }}>
            <div>
              <div className="text-sm font-semibold" style={{ color: C.t1 }}>Detalle por ítem — Bodega {bodegaUnica}</div>
              <div className="mt-0.5 text-xs" style={{ color: C.t2 }}>
                Existencia total por ítem (todos los rangos de días sumados), como lo reporta SIESA.
              </div>
            </div>
            <div className="text-[11px] tabular-nums" style={{ color: C.t2 }}>{nf.format(detalleBodega.items.length)} ítems</div>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ backgroundColor: C.bg0 }}>
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider" style={{ color: C.t2 }}>Bodega</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider" style={{ color: C.t2 }}>Ítem</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider" style={{ color: C.t2 }}>Existencia</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider" style={{ color: C.t2 }}>Comprometida</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider" style={{ color: C.t2 }}>Cant. disponible</th>
                </tr>
                <tr style={{ backgroundColor: C.accentDim }}>
                  <td className="px-3 py-2 font-semibold" style={{ color: C.accent }} colSpan={2}>Total</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: C.accent }}>{nf.format(detalleBodega.totales.existencia)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: C.accent }}>
                    {detalleBodega.tieneDisponible ? nf.format(detalleBodega.totales.existencia - detalleBodega.totales.disponible) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: C.accent }}>
                    {detalleBodega.tieneDisponible ? nf.format(detalleBodega.totales.disponible) : '—'}
                  </td>
                </tr>
              </thead>
              <tbody>
                {detalleBodega.items.map(it => (
                  <tr key={it.item} className="border-t hover:brightness-125" style={{ borderColor: C.bg3 }}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono" style={{ color: C.t2 }}>{bodegaUnica}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono" style={{ color: C.t1 }}>{it.item}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(it.existencia)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums" style={{ color: it.faltaDisponible ? C.t4 : C.t2 }}>
                      {it.faltaDisponible ? '—' : nf.format(it.existencia - it.disponible)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums" style={{ color: it.faltaDisponible ? C.t4 : C.t2 }}>
                      {it.faltaDisponible ? '—' : nf.format(it.disponible)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5" style={{ borderColor: C.bg3 }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: C.t1 }}>Qué revisar primero</div>
            <div className="mt-0.5 text-xs" style={{ color: C.t2 }}>
              Ordenado por antigüedad y, dentro de cada nivel, por cantidad de unidades.
            </div>
          </div>
          <div className="text-[11px] tabular-nums" style={{ color: C.t2 }}>{nf.format(ordenadas.length)} registros</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: C.bg0 }}>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider" style={{ color: C.t2, width: 44 }}>#</th>
                {cols.map(c => (
                  <th key={c.key} onClick={() => clic(c.key)}
                    className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-${c.al}`}
                    style={{ color: orden.key === c.key ? C.accent : C.t2 }}>
                    <span className={`inline-flex items-center gap-1 ${c.al === 'right' ? 'flex-row-reverse' : ''}`}>
                      {c.label}
                      {orden.key === c.key
                        ? (orden.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)
                        : <ArrowUpDown className="h-3 w-3" style={{ color: C.b1 }} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vista.map((r, i) => {
                const rg = RANGO_BY_KEY[r.rango_dias];
                return (
                  <tr key={`${r.bodega}-${r.item}-${r.rango_dias}`} className="border-t hover:brightness-125" style={{ borderColor: C.bg3 }}>
                    <td className="px-3 py-2 font-mono text-[10px] tabular-nums" style={{ color: C.t4 }}>{pag * POR_PAGINA + i + 1}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: rg.tono, color: rg.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: rg.color }} />
                        {rg.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <button onClick={() => ctx.abrir({ via: 'marca', valores: { marca: r.marca } })} className="font-medium hover:underline" style={{ color: C.t1 }}>{r.marca}</button>
                    </td>
                    <td className="max-w-[180px] px-3 py-2">
                      <button onClick={() => ctx.abrir({ via: 'marca', valores: { marca: r.marca, referencia: r.referencia } })}
                        className="block max-w-full truncate text-left hover:underline" style={{ color: C.t2 }}>{r.referencia}</button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono" style={{ color: C.t2 }}>{r.item}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono" style={{ color: C.t2 }}>{r.bodega}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(r.unidades)}</td>
                    {tieneDisponible && (
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums" style={{ color: r.disponible == null ? C.t4 : C.t2 }}>
                        {r.disponible == null ? '—' : nf.format(r.disponible)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-2.5" style={{ borderColor: C.bg3 }}>
          <span className="text-[11px] tabular-nums" style={{ color: C.t2 }}>
            {nf.format(pag * POR_PAGINA + 1)}–{nf.format(Math.min((pag + 1) * POR_PAGINA, ordenadas.length))} de {nf.format(ordenadas.length)}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPagina(0)} disabled={pag === 0}
              className="rounded border px-2 py-1 text-[11px] disabled:opacity-30" style={{ borderColor: C.b0, color: C.t2 }}>Primera</button>
            <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pag === 0}
              className="rounded border px-2 py-1 text-[11px] disabled:opacity-30" style={{ borderColor: C.b0, color: C.t2 }}>Anterior</button>
            <span className="px-2 text-[11px] tabular-nums" style={{ color: C.t1 }}>{pag + 1} / {nf.format(paginas)}</span>
            <button onClick={() => setPagina(p => Math.min(paginas - 1, p + 1))} disabled={pag >= paginas - 1}
              className="rounded border px-2 py-1 text-[11px] disabled:opacity-30" style={{ borderColor: C.b0, color: C.t2 }}>Siguiente</button>
            <button onClick={() => setPagina(paginas - 1)} disabled={pag >= paginas - 1}
              className="rounded border px-2 py-1 text-[11px] disabled:opacity-30" style={{ borderColor: C.b0, color: C.t2 }}>Última</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Vista Junta — piezas ------------------------- */

/* Contenido de cada bloque del treemap: tamaño ya lo resuelve Recharts,
   aquí solo se pinta color por severidad y se recorta el texto que cabe.
   Sin leyenda numérica en el bloque — la lectura es "grande y rojo = malo". */
function ContenidoTreemap({ x, y, width, height, name, pctCritico, total, onClick }) {
  // Recharts invoca `content` también para su nodo raíz sintético, que no
  // trae los campos de datos que le pasamos a cada bloque real — sin esta
  // guarda ese nodo se pinta como "NaN" (visible si algún día los bloques
  // reales no cubren el 100% del contenedor).
  if (width < 2 || height < 2 || total == null) return null;
  const nivel = nivelSeveridad(pctCritico || 0);
  const cabeNombre = width > 58 && height > 34;
  const cabeValor = width > 58 && height > 50;
  const maxChars = Math.max(3, Math.floor(width / 7));
  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <rect x={x} y={y} width={width} height={height} rx={3}
        // El relleno se queda por debajo de 0,35: pasada esa opacidad el amarillo
        // aclara tanto el bloque que el nombre en tinta clara deja de leerse
        // (contraste 2,1:1). A 0,35 el peor caso queda en 6,5:1.
        fill={nivel.color} fillOpacity={0.12 + Math.min(0.23, (pctCritico || 0) * 0.5)}
        stroke={C.bg1} strokeWidth={2} />
      {cabeNombre && (
        <text x={x + 8} y={y + 17} fontSize={11} fontWeight={700} fill={C.t1} fontFamily={FUENTE_UI}>
          {name.length > maxChars ? `${name.slice(0, maxChars)}…` : name}
        </text>
      )}
      {cabeValor && (
        <text x={x + 8} y={y + 34} fontSize={13} fontWeight={800} fill={nivel.claro} fontFamily={FUENTE_DATO}>
          {nf.format(total)}
        </text>
      )}
    </g>
  );
}

/* Tendencia entre cargas. Con menos de dos fotografías no hay tendencia que
   mostrar — se dice explícitamente en vez de simular una línea con un solo
   punto. */
/* El llamador (SeccionJunta) ya garantiza historial.length >= 2 antes de
   montar este componente. */
function TendenciaHistorial({ historial }) {
  const datos = historial.map(h => ({ ...h, pctPuntos: +(h.pctCritico * 100).toFixed(1) }));
  const delta = datos[datos.length - 1].pctPuntos - datos[0].pctPuntos;
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[13px] font-semibold" style={{ color: C.t1 }}>Tendencia del inventario crítico (≥60 días)</div>
          <div className="mt-0.5 text-[11px]" style={{ color: C.t2 }}>Una fotografía por carga · {datos.length} cargas registradas</div>
        </div>
        <DeltaBadge delta={delta} unidad="pp desde la primera carga" />
      </div>
      <div className="mt-4 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradCritico" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.red} stopOpacity={0.35} />
                <stop offset="100%" stopColor={C.red} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={C.bg3} />
            <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: C.t3 }} axisLine={{ stroke: C.b0 }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.t3 }} axisLine={false} tickLine={false} width={38} tickFormatter={v => `${v}%`} />
            <RTooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-md border px-3 py-2 text-xs shadow-lg" style={{ borderColor: C.b0, backgroundColor: C.bg2 }}>
                  <div className="font-semibold" style={{ color: C.t1 }}>{d.fecha}</div>
                  <div className="mt-1 tabular-nums" style={{ color: C.red }}>{d.pctPuntos}% crítico</div>
                  <div className="tabular-nums" style={{ color: C.t2 }}>{nf.format(d.critico)} de {nf.format(d.total)} unidades</div>
                </div>
              );
            }} />
            <Area type="monotone" dataKey="pctPuntos" stroke={C.red} strokeWidth={2} fill="url(#gradCritico)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* Traduce un cálculo de Pareto en una frase legible sin explicación previa. */
function FraseConcentracion({ p, sujetoUno, sujetoVarios }) {
  if (!p) return null;
  return (
    <div className="flex items-baseline gap-2.5 rounded-lg border px-4 py-3" style={{ borderColor: C.b0, backgroundColor: C.bg3 }}>
      <span className="text-2xl font-extrabold tabular-nums" style={{ color: C.t1, fontFamily: FUENTE_DATO }}>{p.n}</span>
      <span className="text-[12px] leading-snug" style={{ color: C.t2 }}>
        {p.n === 1 ? sujetoUno : `${sujetoVarios} de ${p.de}`} concentra{p.n === 1 ? '' : 'n'} el <b style={{ color: C.t1 }}>{pf(p.cobertura, 0)}</b> del inventario crítico
      </span>
    </div>
  );
}

/* Treemap de concentración (bodega/marca, con tope de 12 + "Otras"). Extraído
   para poder mostrarse tanto en Vista Junta como dentro de Gráficos. */
function MapaConcentracion({ rows }) {
  const ctx = React.useContext(DrillCtx);
  const [vistaMapa, setVistaMapa] = useState('bodega');
  const bodegas = useMemo(() => porDimension(rows, 'bodega').sort((a, b) => b.critico - a.critico), [rows]);
  const marcas = useMemo(() => porDimension(rows, 'marca').sort((a, b) => b.critico - a.critico), [rows]);

  // Se limita a las N más críticas (ya vienen ordenadas por critico desc) y
  // el resto se agrupa en un solo bloque: sin tope, los elementos de poco
  // volumen se convierten en astillas de un par de píxeles sin etiqueta.
  const TOPE_MAPA = 12;
  const datosMapa = useMemo(() => {
    const base = (vistaMapa === 'bodega' ? bodegas : marcas).filter(d => d.total > 0);
    const principales = base.slice(0, TOPE_MAPA).map(d => ({ name: d.clave, size: d.total, total: d.total, pctCritico: d.pctCritico }));
    const resto = base.slice(TOPE_MAPA);
    if (!resto.length) return principales;
    const totalResto = resto.reduce((a, d) => a + d.total, 0);
    const criticoResto = resto.reduce((a, d) => a + d.critico, 0);
    return [...principales, {
      name: `Otras (${resto.length})`, size: totalResto, total: totalResto,
      pctCritico: totalResto ? criticoResto / totalResto : 0,
    }];
  }, [vistaMapa, bodegas, marcas]);

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold" style={{ color: C.t1 }}>¿Dónde está concentrado el problema?</div>
          <div className="mt-0.5 text-[11px]" style={{ color: C.t2 }}>
            Cada bloque es {vistaMapa === 'bodega' ? 'una bodega' : 'una marca'} · más grande = más volumen · más rojo = más crítico
          </div>
        </div>
        <div className="flex gap-1 rounded-md border p-0.5" style={{ borderColor: C.b0 }}>
          {[['bodega', 'Por bodega'], ['marca', 'Por marca']].map(([v, l]) => (
            <button key={v} onClick={() => setVistaMapa(v)}
              className="rounded px-2.5 py-1 text-[11px] font-medium transition-colors"
              style={{ backgroundColor: vistaMapa === v ? C.accent : 'transparent', color: vistaMapa === v ? C.bg0 : C.t2 }}>{l}</button>
          ))}
        </div>
      </div>
      <div className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={datosMapa} dataKey="size" stroke={C.bg1} isAnimationActive={false}
            content={props => (
              <ContenidoTreemap {...props} onClick={props.name.startsWith('Otras (') ? undefined : () => ctx.abrir({ via: vistaMapa, valores: { [vistaMapa]: props.name } })} />
            )} />
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {UMBRALES_SEVERIDAD.map(u => (
          <div key={u.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: u.color }} />
            <span className="text-[10px]" style={{ color: C.t3 }}>{u.label}</span>
          </div>
        ))}
        <span className="ml-auto text-[10px]" style={{ color: C.t4 }}>Clic en un bloque para explorar</span>
      </div>
    </div>
  );
}

/* ------------------------------ Vista Junta ------------------------------
   Pantalla única pensada para proyectarse: el orden de los bloques es el
   guion de una presentación de 90 segundos — qué tan grave, si mejora o
   empeora, dónde está, quién lo causa, qué revisar primero. Responde a los
   filtros del encabezado igual que el resto de secciones: lo que muestra
   siempre coincide con la franja de resultados que tiene encima. */
function SeccionJunta({ rows, historial }) {
  const ctx = React.useContext(DrillCtx);
  const kpis = useMemo(() => calcularKpis(rows), [rows]);
  const marcas = useMemo(() => porDimension(rows, 'marca').sort((a, b) => b.critico - a.critico), [rows]);
  const bodegas = useMemo(() => porDimension(rows, 'bodega').sort((a, b) => b.critico - a.critico), [rows]);
  const pMarca = useMemo(() => pareto(rows, 'marca'), [rows]);
  const pBodega = useMemo(() => pareto(rows, 'bodega'), [rows]);

  const anterior = historial.length > 1 ? historial[historial.length - 2] : null;
  const deltaPct = anterior ? (kpis.pctCritico - anterior.pctCritico) * 100 : null;
  const nivel = nivelSeveridad(kpis.pctCritico);

  // Los 5 cruces de marca+bodega con más inventario crítico: la agenda
  // concreta de "qué revisar primero", sin bajar hasta el SKU individual.
  const combos = useMemo(() => {
    const m = new Map();
    for (const h of rows) {
      if (!CRITICOS.includes(h.rango_dias)) continue;
      const k = `${h.marca}‖${h.bodega}`;
      m.set(k, (m.get(k) || 0) + h.unidades);
    }
    return [...m.entries()]
      .map(([k, v]) => { const [marca, bodega] = k.split('‖'); return { marca, bodega, critico: v }; })
      .sort((a, b) => b.critico - a.critico).slice(0, 5);
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Bloque 1 — Titular: la única cifra que alguien debe recordar al salir de la sala */}
      <div className="fadeUp overflow-hidden rounded-xl border" style={{ backgroundColor: C.bg1, borderColor: C.b1, borderTopWidth: 3, borderTopColor: nivel.color, boxShadow: SOMBRA.alta }}>
        <div className="grid grid-cols-1 gap-6 p-7 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: nivel.color }} />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: nivel.color }}>{nivel.label}</span>
            </div>
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.t4 }}>Inventario sobre 60 días</div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-[72px] font-semibold leading-none tabular-nums" style={{ color: nivel.color, letterSpacing: '-0.04em', fontFamily: FUENTE_DATO }}>
                {pf(kpis.pctCritico, 1).replace(' %', '')}
              </span>
              <span className="text-3xl font-medium" style={{ color: nivel.color, opacity: .55 }}>%</span>
            </div>
            <div className="mt-1 text-sm tabular-nums" style={{ color: C.t2 }}>
              <b style={{ color: C.t1 }}>{nf.format(kpis.critico)}</b> de {nf.format(kpis.total)} unidades totales
            </div>
            {deltaPct != null && <div className="mt-3"><DeltaBadge delta={deltaPct} /></div>}
          </div>
          <div className="lg:col-span-7">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.t4 }}>Composición por antigüedad</div>
            <div className="mt-3 flex w-full overflow-hidden rounded-md" style={{ height: 40 }}>
              {ORDEN_ASC.map(k => {
                const v = kpis.porRango[k] || 0;
                if (!v) return null;
                const pct = v / kpis.total;
                return (
                  <div key={k} className="relative flex items-center justify-center" style={{ width: `${pct * 100}%`, backgroundColor: RANGO_BY_KEY[k].color }} title={`${RANGO_BY_KEY[k].label}: ${nf.format(v)}`}>
                    {pct > 0.06 && <span className="text-[12px] font-semibold tabular-nums" style={{ color: RANGO_BY_KEY[k].sobre }}>{pf(pct, 0)}</span>}
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
              {RANGOS.slice().reverse().map(r => (
                <div key={r.key} className="flex items-baseline gap-1.5">
                  <span className="h-2 w-2 translate-y-[-1px] rounded-sm" style={{ backgroundColor: r.color }} />
                  <span className="text-[11px]" style={{ color: C.t2 }}>{r.label}</span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(kpis.porRango[r.key] || 0)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg border px-3 py-2" style={{ borderColor: C.b0, backgroundColor: C.bg3 }}>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: C.t3 }}>Ítems</div>
                <div className="text-lg font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(kpis.items)}</div>
              </div>
              <div className="rounded-lg border px-3 py-2" style={{ borderColor: C.b0, backgroundColor: C.bg3 }}>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: C.t3 }}>Referencias</div>
                <div className="text-lg font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(kpis.referencias)}</div>
              </div>
              <div className="rounded-lg border px-3 py-2" style={{ borderColor: C.b0, backgroundColor: C.bg3 }}>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: C.t3 }}>Bodegas</div>
                <div className="text-lg font-semibold tabular-nums" style={{ color: C.t1 }}>{nf.format(kpis.bodegas)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bloque 2 — ¿Mejora o empeora? Solo aparece con historial suficiente
          (2+ cargas); mientras tanto no ocupa espacio con un estado vacío. */}
      {historial.length >= 2 && <TendenciaHistorial historial={historial} />}

      {/* Bloque 3 — ¿Dónde está concentrado? */}
      <MapaConcentracion rows={rows} />

      {/* Bloque 4 — ¿Quién concentra el problema? */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-5" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
          <div className="text-[13px] font-semibold" style={{ color: C.t1 }}>Marcas más críticas</div>
          <div className="mt-3"><FraseConcentracion p={pMarca} sujetoUno="1 marca" sujetoVarios="marcas" /></div>
          <div className="mt-3 space-y-2">
            {marcas.slice(0, 3).map((d, i) => (
              <button key={d.clave} onClick={() => ctx.abrir({ via: 'marca', valores: { marca: d.clave } })}
                className="group flex w-full items-center gap-2 text-left text-xs">
                <span className="w-4 font-mono text-[10px]" style={{ color: C.t4 }}>{i + 1}</span>
                <span className="flex-1 truncate font-medium group-hover:underline" style={{ color: C.t1 }}>{d.clave}</span>
                <span className="font-semibold tabular-nums" style={{ color: C.red }}>{nf.format(d.critico)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border p-5" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
          <div className="text-[13px] font-semibold" style={{ color: C.t1 }}>Bodegas más críticas</div>
          <div className="mt-3"><FraseConcentracion p={pBodega} sujetoUno="1 bodega" sujetoVarios="bodegas" /></div>
          <div className="mt-3 space-y-2">
            {bodegas.slice(0, 3).map((d, i) => (
              <button key={d.clave} onClick={() => ctx.abrir({ via: 'bodega', valores: { bodega: d.clave } })}
                className="group flex w-full items-center gap-2 text-left text-xs">
                <span className="w-4 font-mono text-[10px]" style={{ color: C.t4 }}>{i + 1}</span>
                <span className="flex-1 truncate font-mono font-medium group-hover:underline" style={{ color: C.t1 }}>{d.clave}</span>
                <span className="font-semibold tabular-nums" style={{ color: C.red }}>{nf.format(d.critico)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bloque 5 — Qué revisar primero */}
      <div className="rounded-xl border p-5" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
        <div className="text-[13px] font-semibold" style={{ color: C.t1 }}>Qué revisar primero</div>
        <div className="mt-0.5 text-[11px]" style={{ color: C.t2 }}>Los 5 cruces de marca y bodega con más inventario crítico (≥60 días)</div>
        <div className="mt-4 space-y-2">
          {combos.map((c, i) => (
            <button key={`${c.marca}-${c.bodega}`}
              onClick={() => ctx.abrir({ via: 'marca', valores: { marca: c.marca, bodega: c.bodega } })}
              className="group flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors hover:brightness-125" style={{ borderColor: C.b0, backgroundColor: C.bg3 }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ backgroundColor: C.redDim, color: C.red }}>{i + 1}</span>
              <div className="min-w-0 flex-1 group-hover:underline">
                <span className="font-medium" style={{ color: C.t1 }}>{c.marca}</span>
                <span style={{ color: C.t3 }}> · </span>
                <span className="font-mono" style={{ color: C.t2 }}>{c.bodega}</span>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: C.red }}>{nf.format(c.critico)} u.</span>
            </button>
          ))}
          {combos.length === 0 && <div className="py-6 text-center text-xs" style={{ color: C.t3 }}>Sin inventario crítico registrado</div>}
        </div>
      </div>
    </div>
  );
}

/* Ranking de una dimensión (marca o bodega) con selector de métrica —
   envuelve el RankingBarras ya existente para poder mostrarlo suelto,
   sin la tabla de detalle que trae SeccionDimension. */
function RankingChart({ rows, campo, titulo }) {
  const [metrica, setMetrica] = useState(METRICA_INICIAL);
  const datos = useMemo(() => porDimension(rows, campo), [rows, campo]);
  const ctx = React.useContext(DrillCtx);
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-semibold" style={{ color: C.t1 }}>{titulo}</div>
        <SelectorMetrica valor={metrica} onChange={setMetrica} />
      </div>
      <div className="mt-4">
        <RankingBarras datos={datos} metrica={metrica} limite={10}
          onSeleccion={d => ctx.abrir({ via: campo, valores: { [campo]: d.clave } })}
          onFiltrar={d => ctx.filtrar({ [campo]: [d.clave] })} />
      </div>
    </div>
  );
}

/* ------------------------------- Gráficos -------------------------------
   Todas las visualizaciones del dashboard reunidas en un solo lugar, en el
   orden en que cuentan la historia: composición → comparación por rango →
   dónde está concentrado → cruce → rankings → evolución entre cargas.
   A diferencia de Vista Junta, aquí SÍ respeta los filtros activos — es la
   misma información que ves repartida en las demás pestañas, solo que junta. */
function SeccionGraficos({ rows, kpis, historial }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DonaAntiguedad rows={rows} />
        <BarrasRangoDias rows={rows} kpis={kpis} />
      </div>

      <MapaConcentracion rows={rows} />

      <Heatmap rows={rows} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankingChart rows={rows} campo="marca" titulo="Ranking de marcas" />
        <RankingChart rows={rows} campo="bodega" titulo="Ranking de bodegas" />
      </div>

      {historial.length >= 2 && <TendenciaHistorial historial={historial} />}
    </div>
  );
}

/* -------------------------------- App -------------------------------- */


/* Las secciones con `requiere` solo aparecen si el archivo trae esa columna;
   la numeración se recalcula al vuelo para que no queden huecos. */
const SECCIONES_BASE = [
  { id: 'junta', label: 'Vista Junta', grupo: 'junta' },
  { id: 'resumen', label: 'Resumen ejecutivo', grupo: 'detalle' },
  { id: 'dias', label: 'Días de inventario', grupo: 'detalle' },
  { id: 'origen', label: 'Origen', grupo: 'detalle', requiere: 'origen' },
  { id: 'linea', label: 'Línea', grupo: 'detalle', requiere: 'linea' },
  { id: 'tipo', label: 'Tipo de producto', grupo: 'detalle', requiere: 'tipo_producto' },
  { id: 'marcas', label: 'Marcas', grupo: 'detalle' },
  { id: 'graficos', label: 'Gráficos', grupo: 'detalle', requiere: 'grafico' },
  { id: 'referencias', label: 'Referencias', grupo: 'detalle' },
  { id: 'bodegas', label: 'Bodegas', grupo: 'detalle' },
  { id: 'multi', label: 'Análisis multidimensional', grupo: 'detalle' },
  { id: 'prioridad', label: 'Priorización', grupo: 'detalle' },
  { id: 'visual', label: 'Visualizaciones', grupo: 'detalle' },
];

/* Campo de datos que alimenta cada sección de dimensión. */
const SECCION_CAMPO = { origen: 'origen', linea: 'linea', tipo: 'tipo_producto', graficos: 'grafico' };

/* Selector de canal. Es un control segmentado, no dos interruptores sueltos:
   los canales son excluyentes y "Todos" tiene que seguir siendo alcanzable de
   un clic, porque es el único estado que muestra el inventario completo.
   "Sin canal" solo aparece si hay bodegas fuera de las dos listas — y aparece,
   en vez de esconderse, para que esas unidades nunca se pierdan del total. */
function SelectorCanal({ valor, onChange, porCanal }) {
  const opciones = [
    { key: 'todos', label: 'Todos', color: C.accent },
    ...CANALES,
    ...(porCanal.unidades.sin > 0 ? [SIN_CANAL] : []),
  ];
  return (
    <div className="flex items-center gap-1 rounded-lg border p-1" style={{ borderColor: C.b1, backgroundColor: C.bg0 }}>
      {opciones.map(o => {
        const on = valor === o.key;
        const u = porCanal.unidades[o.key] || 0;
        const bods = o.key === 'todos' ? null : porCanal.bodegas[o.key];
        return (
          <button key={o.key} onClick={() => onChange(o.key)}
            title={
              o.key === 'todos' ? 'Todo el inventario, sin separar por canal'
              : o.key === 'sin' ? `Bodegas que no están en la lista de ningún canal — cualquier bodega nueva cae aquí hasta que se le asigne uno.\n\n${bods.length} bodegas: ${bods.join(', ')}`
              : `${bods.length} bodegas · ${bods.join(', ')}`
            }
            className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{ backgroundColor: on ? o.color : 'transparent', color: on ? C.bg0 : C.t2 }}>
            {o.label}
            <span className="ml-1.5 text-[10px] font-medium tabular-nums" style={{ opacity: on ? 0.75 : 0.6 }}>
              {nf.format(u)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const [estado, setEstado] = useState('vacio');   // vacio | cargando | configurar | listo
  const [raw, setRaw] = useState(null);
  const [mapeo, setMapeo] = useState(null);
  const [validacion, setValidacion] = useState(null);
  const [hechos, setHechos] = useState([]);
  const [historial, setHistorial] = useState(() => histLoad());
  const [error, setError] = useState(null);
  const [seccion, setSeccion] = useState('junta');
  const [verCarga, setVerCarga] = useState(false);
  // Campos filtrables: los fijos más las dimensiones opcionales del archivo.
  const CAMPOS_FILTRO = ['marca', 'referencia', 'bodega', ...CAMPOS_OPCIONALES];
  const FILTROS_INI = { ...Object.fromEntries(CAMPOS_FILTRO.map(c => [c, []])), rango: [] };
  // Modo por dimensión: 'incluir' deja solo lo marcado, 'excluir' lo oculta.
  const MODOS_INI = Object.fromEntries(CAMPOS_FILTRO.map(c => [c, 'incluir']));
  const [filtros, setFiltros] = useState(FILTROS_INI);
  const [modos, setModos] = useState(MODOS_INI);
  const [busqueda, setBusqueda] = useState('');
  const [canal, setCanal] = useState('todos');     // todos | nacional | expo | sin
  const [drill, setDrill] = useState(null);

  const ctxDrill = useMemo(() => ({
    abrir: ruta => setDrill(ruta),
    filtrar: parcial => { setFiltros(f => ({ ...f, ...parcial })); setDrill(null); },
  }), []);

  const procesar = useCallback((rawData, mapeoFinal) => {
    const val = validar(rawData, mapeoFinal);
    if (!val.ok) { setError(val.errores.map(e => e.msg).join(' ')); setEstado('vacio'); return; }
    setValidacion(val);
    const hechosNuevos = normalizar(rawData, mapeoFinal);
    setHechos(hechosNuevos);
    setMapeo(mapeoFinal);
    setHistorial(h => histGuardar(h, calcularKpis(hechosNuevos)));
    setEstado('listo');
    setSeccion('junta');
    setFiltros(FILTROS_INI);
    setModos(MODOS_INI);
    setBusqueda('');
    setCanal('todos');
    setDrill(null);
  }, []);

  const onArchivo = useCallback(async file => {
    setEstado('cargando'); setError(null);
    try {
      const rawData = await ExcelDataSource.load(file);
      if (!rawData.rows.length) throw new Error('El archivo no contiene filas de datos.');
      setRaw(rawData);
      const m = detectarMapeo(rawData.columns);
      const completo = Object.keys(ALIAS).every(c => m.dim[c]) && Object.keys(m.rangos).length > 0;
      if (completo) procesar(rawData, m);
      else { setMapeo(m); setEstado('configurar'); }
    } catch (e) {
      setError(e.message || 'Formato no reconocido.');
      setEstado('vacio');
    }
  }, [procesar]);

  // Lo que ven todos al abrir: el Excel de SIESA que la Rutina publica junto
  // al HTML, salvo que alguien haya publicado uno a mano DESPUÉS de que se
  // guardó ese Excel de SIESA — gana lo más reciente. `avisarSiFalla` solo se
  // usa en el refresco manual: en el intento silencioso al abrir la página, un
  // 404 o un fetch bloqueado (HTML abierto como archivo local) simplemente
  // deja la pantalla de carga manual de siempre.
  const compartido = useRef(null);   // { filas, fechaDato } de lo que ven todos
  const cargarAutomatico = useCallback(async ({ avisarSiFalla = false } = {}) => {
    try {
      const [siesa, pub] = await Promise.all([
        ExcelDataSource.loadFromUrl(RUTA_DATO_AUTOMATICO).catch(e => e),
        leerPublicacion(),
      ]);
      let rawData = siesa instanceof Error ? null : siesa;
      if (pub && (!rawData || new Date(pub.publicado_en) > rawData.meta.fechaDato)) {
        try {
          rawData = await ExcelDataSource.loadFromUrl(urlArchivoPublicado(pub.ruta), {
            fuente: 'Publicado a mano', archivo: pub.archivo, publicadoPor: pub.publicado_por,
            fechaDato: pub.fecha_dato, cargadoEn: new Date(pub.publicado_en),
          });
        } catch (_) { /* Storage caído: se queda con SIESA si lo hay */ }
      }
      if (!rawData) throw (siesa instanceof Error ? siesa : new Error('No hay dato publicado.'));
      if (!rawData.rows.length) throw new Error('El archivo automático no contiene filas de datos.');
      compartido.current = { filas: rawData.rows.length, fechaDato: rawData.meta.fechaDato };
      setRaw(rawData);
      const m = detectarMapeo(rawData.columns);
      const completo = Object.keys(ALIAS).every(c => m.dim[c]) && Object.keys(m.rangos).length > 0;
      if (completo) procesar(rawData, m);
      else { setMapeo(m); setEstado('configurar'); }
    } catch (e) {
      if (avisarSiFalla) setError(e.message || 'No se pudo actualizar desde SIESA.');
    }
  }, [procesar]);

  // Publica para todos el Excel cargado a mano. La clave de admin y el nombre
  // se piden una vez y quedan en este navegador; la clave nunca va en el HTML.
  const [publicando, setPublicando] = useState(null);   // null | 'enviando' | 'ok' | mensaje de error
  // Cada archivo nuevo empieza sin mensaje de publicación pendiente.
  useEffect(() => { setPublicando(null); }, [raw]);  // eslint-disable-line react-hooks/exhaustive-deps
  const publicar = useCallback(async () => {
    const m = raw && raw.meta;
    if (!m || m.esAutomatico) return;
    if (m.filasVacias > 0) {
      setPublicando(`El archivo trae ${nf.format(m.filasVacias)} filas vacías en medio de los datos: parece incompleto, no se publica.`);
      return;
    }
    const ref = compartido.current;
    if (ref && raw.rows.length < ref.filas * 0.8 && !window.confirm(
      `Este archivo tiene ${nf.format(raw.rows.length)} filas y el que ven todos tiene ${nf.format(ref.filas)} (más de 20 % menos). ¿Publicar de todas formas?`)) return;
    if (ref && m.fechaDato < ref.fechaDato && !window.confirm(
      `Este Excel es del ${fmtFecha(m.fechaDato)}, más viejo que el que ven todos (${fmtFecha(ref.fechaDato)}). ¿Publicar de todas formas?`)) return;

    const leer = k => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
    const guardar = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (_) {} };
    const clave = leer('lenta_rotacion_clave_admin') || (window.prompt('Clave de admin para publicar:') || '').trim();
    if (!clave) return;
    const nombre = leer('lenta_rotacion_publicador') || (window.prompt('¿Tu nombre? (se muestra a quien vea el panel)') || '').trim();
    if (!nombre) return;

    setPublicando('enviando');
    try {
      const res = await fetch(URL_PUBLICAR, {
        method: 'POST',
        headers: {
          ...SUPA_H,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'x-admin-secret': clave,
          'x-archivo': encodeURIComponent(m.archivo),
          'x-publicado-por': encodeURIComponent(nombre),
          'x-fecha-dato': m.fechaDato.toISOString(),
          'x-filas': String(raw.rows.length),
        },
        body: raw.buf,
      });
      if (res.status === 403) { guardar('lenta_rotacion_clave_admin', ''); throw new Error('Clave de admin incorrecta.'); }
      if (!res.ok) throw new Error(res.status === 404
        ? 'El servicio de publicación todavía no está instalado en Supabase.'
        : `No se pudo publicar (HTTP ${res.status}).`);
      guardar('lenta_rotacion_clave_admin', clave);
      guardar('lenta_rotacion_publicador', nombre);
      setPublicando('ok');
      await cargarAutomatico({ avisarSiFalla: true });
    } catch (e) {
      setPublicando(e instanceof TypeError
        ? 'No se pudo contactar el servicio de publicación (¿ya está instalado en Supabase?).'
        : e.message);
    }
  }, [raw, cargarAutomatico]);

  useEffect(() => { cargarAutomatico(); /* solo al montar */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cada dimensión opcional solo se ofrece (filtro + sección) si el archivo
  // cargado realmente trae su columna.
  const dimsPresentes = useMemo(() => {
    const s = new Set();
    for (const c of CAMPOS_OPCIONALES) if (hechos.some(h => h[c] != null)) s.add(c);
    return s;
  }, [hechos]);

  // El canal acota el universo antes que cualquier otro filtro: las listas de
  // bodegas, marcas y referencias solo ofrecen lo que existe dentro del canal.
  const enCanal = useMemo(
    () => (canal === 'todos' ? hechos : hechos.filter(h => h.canal === canal)),
    [hechos, canal]
  );

  // Unidades por canal, para rotular los botones y para saber si "Sin canal"
  // tiene algo dentro (si no, ese botón no se muestra).
  const porCanal = useMemo(() => {
    const acc = { todos: 0, nacional: 0, expo: 0, sin: 0 };
    const bod = { nacional: new Set(), expo: new Set(), sin: new Set() };
    for (const h of hechos) { acc[h.canal] += h.unidades; acc.todos += h.unidades; bod[h.canal].add(h.bodega); }
    return { unidades: acc, bodegas: Object.fromEntries(Object.entries(bod).map(([k, v]) => [k, [...v].sort()])) };
  }, [hechos]);

  const opciones = useMemo(() => {
    const s = Object.fromEntries(CAMPOS_FILTRO.map(c => [c, new Set()]));
    for (const h of enCanal) for (const c of CAMPOS_FILTRO) if (h[c] != null) s[c].add(h[c]);
    return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, [...v].sort()]));
  }, [enCanal]);

  // Unidades por opción, para mostrarlas dentro del panel de cada filtro.
  const conteos = useMemo(() => {
    const acc = Object.fromEntries(CAMPOS_FILTRO.map(c => [c, {}]));
    for (const h of enCanal) {
      for (const c of CAMPOS_FILTRO) {
        const v = h[c];
        if (v != null) acc[c][v] = (acc[c][v] || 0) + h.unidades;
      }
    }
    return acc;
  }, [enCanal]);

  const filtrados = useMemo(() => {
    const coincide = compilarBusqueda(busqueda);
    // Un Set por dimensión evita recorrer el array de selección por cada fila.
    const activos = CAMPOS_FILTRO
      .filter(c => filtros[c]?.length)
      .map(c => ({ campo: c, set: new Set(filtros[c]), excluir: modos[c] === 'excluir' }));
    return enCanal.filter(h => {
      for (const { campo, set, excluir } of activos) {
        const dentro = set.has(h[campo]);
        if (excluir ? dentro : !dentro) return false;
      }
      if (filtros.rango.length && !filtros.rango.includes(h.rango_dias)) return false;
      if (coincide) {
        const texto = norm([h.marca, h.referencia, h.item, h.bodega, ...CAMPOS_OPCIONALES.map(c => h[c] ?? '')].join(' '));
        if (!coincide(texto)) return false;
      }
      return true;
    });
  }, [enCanal, filtros, modos, busqueda]);

  const kpis = useMemo(() => calcularKpis(filtrados), [filtrados]);
  const hayFiltros = Object.values(filtros).some(v => v.length) || busqueda || canal !== 'todos';
  // Una sección con `requiere` solo se lista si el archivo trae esa columna.
  const seccionesVisibles = useMemo(
    () => SECCIONES_BASE
      .filter(s => !s.requiere || dimsPresentes.has(s.requiere))
      .map((s, i) => ({ ...s, activa: true, num: String(i).padStart(2, '0') })),
    [dimsPresentes]
  );
  const limpiar_ = () => {
    setFiltros(FILTROS_INI);
    setModos(MODOS_INI);
    setBusqueda('');
    setCanal('todos');
  };

  /* ---- Exportación a Excel ---- */
  const [exportando, setExportando] = useState(null);   // null | 'generando' | 'ok' | 'cancelado' | mensaje de error

  // Los filtros se escriben en la portada del libro: sin esto el archivo no es
  // auditable una vez fuera del dashboard.
  const filtrosTexto = useMemo(() => {
    const lista = [];
    if (canal !== 'todos') lista.push(['Canal', CANAL_BY_KEY[canal].label]);
    if (busqueda) lista.push(['Búsqueda', busqueda]);
    for (const [campo, etiqueta] of ORDEN_FILTROS) {
      const sel = filtros[campo];
      if (!sel.length) continue;
      const verbo = modos[campo] === 'excluir' ? 'Excluye' : 'Solo';
      const muestra = sel.slice(0, 25).join(', ');
      lista.push([etiqueta, `${verbo} ${sel.length}: ${muestra}${sel.length > 25 ? `, … (+${sel.length - 25})` : ''}`]);
    }
    if (filtros.rango.length) {
      lista.push(['Rango de días', filtros.rango.map(k => RANGO_BY_KEY[k].label).join(', ')]);
    }
    if (!lista.length) lista.push(['—', 'Sin filtros: el archivo contiene el inventario completo']);
    lista.push(['Registros exportados', `${nf.format(filtrados.length)} de ${nf.format(hechos.length)}`]);
    return lista;
  }, [filtros, modos, busqueda, canal, filtrados.length, hechos.length]);

  const exportar = useCallback(async () => {
    if (exportando === 'generando' || !filtrados.length) return;
    setExportando('generando');
    try {
      const dimsExtra = DIMS_OPCIONALES.filter(d => dimsPresentes.has(d.campo)).map(d => ({ campo: d.campo, etiqueta: d.etiqueta }));
      const wb = construirLibro(ExcelJS, {
        rows: filtrados,
        kpis,
        dimsExtra,
        filtrosTexto,
        meta: { archivo: raw?.meta?.archivo || 'inventario', generado: fmtFecha(new Date()) },
      });
      const buffer = await wb.xlsx.writeBuffer();
      const sello = new Date().toISOString().slice(0, 10);
      const datos = { rows: filtrados, kpis, dimsExtra, filtrosTexto, meta: { archivo: raw?.meta?.archivo || 'inventario', generado: fmtFecha(new Date()) } };

      // Dos vías. Dentro del visor de artifacts la página no puede descargar
      // por su cuenta y debe pedírselo al anfitrión, que además no admite
      // .xlsx; ahí se entrega el mismo libro en .html, que Excel abre como
      // libro de varias hojas. En un sitio propio se descarga el .xlsx normal.
      const dl = await window.claude?.use?.('downloads').catch(() => null);

      if (dl) {
        // Cascada de entrega, de mejor a peor. El anfitrión del visor decide
        // qué extensiones admite; el libro .xlsx real es siempre el primer
        // intento y solo se degrada si lo rechaza.
        const rechazoExt = e => e?.code === 'rejected_extension' || e?.code === 'extension_not_enabled';
        const intentos = [
          { nombre: `lenta-rotacion-${sello}.xlsx`, datos: () => buffer.slice(0), estado: 'ok' },
          { nombre: `lenta-rotacion-${sello}.xls`, datos: () => construirHTMLExcel(datos), estado: 'xls' },
          { nombre: `lenta-rotacion-${sello}.xls.html`, datos: () => construirHTMLExcel(datos), estado: 'html' },
        ];

        let entregado = false;
        for (const intento of intentos) {
          try {
            await dl.save({ filename: intento.nombre, data: intento.datos() });
            setExportando(intento.estado);
            entregado = true;
            break;
          } catch (err) {
            if (err?.code === 'declined') { setExportando('cancelado'); return; }
            if (rechazoExt(err)) continue;   // extensión vetada: prueba la siguiente
            setExportando(`No se pudo guardar (${err?.code || 'desconocido'})`);
            return;
          }
        }
        if (!entregado) { setExportando('El visor no admite ninguna extensión de hoja de cálculo'); return; }
      } else {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `lenta-rotacion-${sello}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        setExportando('ok');
      }
      setTimeout(() => setExportando(null), 6000);
    } catch (err) {
      setExportando(err?.message || 'No se pudo generar el archivo');
    }
  }, [exportando, filtrados, kpis, dimsPresentes, filtrosTexto, raw]);

  if (estado === 'vacio' || estado === 'cargando')
    return <div className="min-h-screen" style={{ backgroundColor: C.bg0, fontFamily: FUENTE_UI }}><EstilosGlobales /><ZonaCarga onArchivo={onArchivo} cargando={estado === 'cargando'} error={error} /></div>;

  if (estado === 'configurar')
    return (
      <div className="min-h-screen" style={{ backgroundColor: C.bg0, fontFamily: FUENTE_UI }}>
        <EstilosGlobales />
        <ConfigurarColumnas raw={raw} mapeo={mapeo} onConfirmar={m => procesar(raw, m)} onCancelar={() => { setEstado('vacio'); setError(null); }} />
      </div>
    );

  return (
    <DrillCtx.Provider value={ctxDrill}>
    <div className="min-h-screen" style={{ backgroundColor: C.bg0, fontFamily: FUENTE_UI }}>
      <EstilosGlobales />
      {/* Encabezado */}
      <header className="border-b" style={{ borderColor: C.b0, backgroundColor: C.bg1 }}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: C.accent }}>
              <Layers className="h-3.5 w-3.5" style={{ color: C.t1 }} />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold leading-tight tracking-tight" style={{ color: C.t1 }}>Lenta rotación de inventario</h1>
              <div className="text-[10px] uppercase tracking-[0.12em]" style={{ color: C.t3 }}>Control operativo de existencias</div>
            </div>
          </div>
          <SelectorCanal valor={canal} onChange={setCanal} porCanal={porCanal} />
          <div className="flex items-center gap-4 text-[11px]" style={{ color: C.t2 }}>
            <span className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5" />Fuente: {raw.meta.fuente}{raw.meta.publicadoPor ? ` por ${raw.meta.publicadoPor}` : ''}</span>
            <span className="flex items-center gap-1.5" title={`Cargado en este panel: ${fmtFecha(raw.meta.cargadoEn)}`}>
              <Clock className="h-3.5 w-3.5" />Dato del: {fmtFecha(raw.meta.fechaDato || raw.meta.cargadoEn)}
            </span>
            <button onClick={() => setVerCarga(v => !v)} className="flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium"
              style={{ borderColor: C.b0, color: C.t2 }}>
              <FileSpreadsheet className="h-3.5 w-3.5" />{raw.meta.archivo}
            </button>
            {raw.meta.esAutomatico && (
              <button onClick={() => cargarAutomatico({ avisarSiFalla: true })}
                title="Vuelve a pedir el Excel que la Rutina publicó, sin recargar la página"
                className="flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium"
                style={{ borderColor: C.b0, color: C.t2 }}>
                <Clock className="h-3.5 w-3.5" />Actualizar
              </button>
            )}
            {!raw.meta.esAutomatico && (
              <button onClick={publicar} disabled={publicando === 'enviando'}
                title="Deja este Excel como el que ven todos al abrir el panel (pide la clave de admin)"
                className="flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium disabled:opacity-40"
                style={{ borderColor: C.accent, color: C.t1 }}>
                <Upload className="h-3.5 w-3.5" />{publicando === 'enviando' ? 'Publicando…' : 'Publicar para todos'}
              </button>
            )}
            {publicando && !['enviando', 'ok'].includes(publicando) && (
              <span className="max-w-[280px] text-[10px] leading-tight" style={{ color: C.red }}>{publicando}</span>
            )}

            <button onClick={exportar} disabled={exportando === 'generando' || !filtrados.length}
              title="Descarga un Excel con los filtros aplicados, ya organizado en hojas por marca, gráfico, referencia y bodega"
              className="flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium transition-colors disabled:opacity-40"
              style={{
                borderColor: ['ok', 'xls', 'html'].includes(exportando) ? C.green : C.b0,
                color: ['ok', 'xls', 'html'].includes(exportando) ? C.green : C.t1,
                backgroundColor: ['ok', 'xls', 'html'].includes(exportando) ? C.greenDim : 'transparent',
              }}>
              <Download className="h-3.5 w-3.5" />
              {exportando === 'generando' ? 'Generando…'
                : ['ok', 'xls', 'html'].includes(exportando) ? 'Descargado'
                : exportando === 'cancelado' ? 'Cancelado'
                : 'Excel'}
            </button>
            {exportando === 'xls' && (
              <span className="max-w-[320px] text-[10px] leading-tight" style={{ color: C.t2 }}>
                Guardado como <b style={{ color: C.t1 }}>.xls</b> — ábrelo con Excel: trae las mismas hojas
              </span>
            )}
            {exportando === 'html' && (
              <span className="max-w-[340px] text-[10px] leading-tight" style={{ color: C.t2 }}>
                El visor no admite <b style={{ color: C.t1 }}>.xlsx</b>; se guardó como <b style={{ color: C.t1 }}>.xls.html</b> con
                las mismas hojas. Para el libro nativo, abre este panel desde el HTML descargado.
              </span>
            )}
            {exportando && !['generando', 'ok', 'xls', 'html', 'cancelado'].includes(exportando) && (
              <span className="max-w-[240px] truncate text-[10px]" style={{ color: C.red }} title={exportando}>
                {exportando}
              </span>
            )}
            <button onClick={() => { setEstado('vacio'); setHechos([]); setError(null); }}
              className="rounded-md px-2.5 py-1 font-medium text-white" style={{ backgroundColor: C.accent }}>
              Cargar otro archivo
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 border-t px-6 py-2" style={{ borderColor: C.bg3 }}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: C.t3 }} />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar…  ich -expo  ·  &quot;ich-505&quot;  ·  501|505"
              title={'Operadores:\n  dos palabras → deben aparecer las dos\n  -palabra → excluye lo que la contenga\n  "frase exacta" → busca la frase completa\n  a|b → cualquiera de las dos'}
              className="w-80 rounded-md border py-1.5 pl-7 pr-2 text-xs" style={{ borderColor: busqueda ? C.accent : C.b0, color: C.t1 }} />
            {busqueda && (
              <button onClick={() => setBusqueda('')} title="Limpiar búsqueda"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 hover:brightness-125">
                <X className="h-3 w-3" style={{ color: C.t3 }} />
              </button>
            )}
          </div>
          {[
            ...ORDEN_FILTROS,
          ].filter(([campo]) => !CAMPOS_OPCIONALES.includes(campo) || dimsPresentes.has(campo))
           .map(([campo, etiqueta]) => (
            <FiltroMulti key={campo} etiqueta={etiqueta}
              opciones={opciones[campo]} seleccion={filtros[campo]} conteos={conteos[campo]}
              modo={modos[campo]}
              onModo={m => setModos(o => ({ ...o, [campo]: m }))}
              onChange={v => setFiltros(f => ({ ...f, [campo]: v }))} />
          ))}
          <div className="flex gap-1">
            {RANGOS.map(r => {
              const on = filtros.rango.includes(r.key);
              return (
                <button key={r.key}
                  onClick={() => setFiltros(f => ({ ...f, rango: on ? f.rango.filter(x => x !== r.key) : [...f.rango, r.key] }))}
                  className="rounded-md border px-2 py-1 text-[11px] font-medium transition-colors"
                  style={{ borderColor: on ? r.color : C.b0, backgroundColor: on ? r.tono : C.t1, color: on ? r.color : C.t2 }}>
                  {r.short}
                </button>
              );
            })}
          </div>
          {hayFiltros && (
            <button onClick={limpiar_} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium" style={{ color: C.red }}>
              <X className="h-3 w-3" />Limpiar filtros
            </button>
          )}
          <div className="ml-auto text-[11px] tabular-nums" style={{ color: C.t2 }}>
            {nf.format(filtrados.length)} de {nf.format(hechos.length)} registros
          </div>
        </div>

        {/* Resultado esencial: pegado a los filtros, siempre visible sin
            importar la pestaña activa — se recalcula con cada filtro. */}
        <div className="flex flex-wrap items-center gap-4 border-t px-6 py-2.5" style={{ borderColor: C.bg3, backgroundColor: C.bg0 }}>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.t3 }}>Resultado con estos filtros</span>
          <div className="min-w-[140px] max-w-xs flex-1">
            <BarraComposicion rangos={kpis.porRango} total={kpis.total} alto={7} />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs tabular-nums">
            <span style={{ color: C.t2 }}>Total <b style={{ color: C.t1 }}>{nf.format(kpis.total)}</b></span>
            <span style={{ color: C.t2 }}>Crítico ≥60 <b style={{ color: C.red }}>{nf.format(kpis.critico)}</b></span>
            <span style={{ color: C.t2 }}>% crítico <b style={{ color: C.red }}>{pf(kpis.pctCritico, 1)}</b></span>
            <span style={{ color: C.t2 }}>Lenta rotación <b style={{ color: '#D89430' }}>{pf(kpis.pctLenta, 1)}</b></span>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Navegación */}
        <nav className="w-52 shrink-0 border-r" style={{ borderColor: C.b0, backgroundColor: C.bg1, minHeight: 'calc(100vh - 92px)' }}>
          <div className="p-2">
            {seccionesVisibles.map((s, i) => {
              const on = seccion === s.id;
              const divisor = i > 0 && s.grupo === 'detalle' && seccionesVisibles[i - 1].grupo !== 'detalle';
              return (
                <React.Fragment key={s.id}>
                  {divisor && (
                    <div className="mb-1 mt-3 px-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.t4 }}>
                      Análisis detallado
                    </div>
                  )}
                  <button disabled={!s.activa} onClick={() => s.activa && setSeccion(s.id)}
                    className="mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-xs transition-all disabled:cursor-not-allowed"
                    style={{ backgroundColor: on ? C.accent : 'transparent', color: on ? C.bg0 : s.activa ? C.t2 : C.t4,
                             boxShadow: on ? SOMBRA.media : 'none' }}>
                    <span className="font-mono text-[10px] tabular-nums" style={{ color: on ? C.t3 : C.t4 }}>{s.num}</span>
                    <span className="flex-1 font-medium">{s.label}</span>
                    {!s.activa && <Lock className="h-3 w-3" />}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

        </nav>

        {/* Contenido */}
        <main className="min-w-0 flex-1 p-5">
          <div className="mb-4 flex items-baseline gap-2.5">
            <span className="font-mono text-xs tabular-nums" style={{ color: C.t4 }}>
              {seccionesVisibles.find(x => x.id === seccion)?.num}
            </span>
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: C.t1, letterSpacing: '-0.02em' }}>
              {seccionesVisibles.find(x => x.id === seccion)?.label}
            </h2>
          </div>
          {verCarga && <div className="mb-5"><PanelCarga meta={raw.meta} validacion={validacion} hechos={hechos} raw={raw} /></div>}

          {filtrados.length === 0 ? (
            <div className="rounded-xl border px-6 py-16 text-center" style={{ borderColor: C.b0, boxShadow: SOMBRA.plana }}>
              <Settings2 className="mx-auto mb-3 h-8 w-8" style={{ color: C.t4 }} strokeWidth={1.5} />
              <div className="text-sm font-medium" style={{ color: C.t1 }}>Ningún registro coincide con los filtros</div>
              <div className="mt-1 text-xs" style={{ color: C.t2 }}>Ajusta o quita algún filtro para ver resultados.</div>
              <button onClick={limpiar_} className="mt-4 rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: C.accent }}>
                Limpiar filtros
              </button>
            </div>
          ) : seccion === 'junta' ? (
            <SeccionJunta rows={filtrados} historial={historial} />
          ) : seccion === 'resumen' ? (
            <SeccionResumen rows={filtrados} kpis={kpis} historial={historial} />
          ) : seccion === 'dias' ? (
            <SeccionDias rows={filtrados} kpis={kpis} />
          ) : seccion === 'marcas' ? (
            <SeccionDimension rows={filtrados} campo="marca" etiqueta="Marca"
              titulo="Ranking de marcas" pregunta="¿Qué marcas concentran el inventario lento?" />
          ) : seccion === 'referencias' ? (
            <SeccionReferencias rows={filtrados} />
          ) : seccion === 'bodegas' ? (
            <SeccionDimension rows={filtrados} campo="bodega" etiqueta="Bodega"
              titulo="Ranking de bodegas" pregunta="¿Dónde está físicamente concentrado el problema?" />
          ) : seccion === 'multi' ? (
            <SeccionMulti rows={filtrados} />
          ) : seccion === 'prioridad' ? (
            <SeccionPrioridad rows={filtrados} kpis={kpis} bodegaUnica={filtros.bodega.length === 1 ? filtros.bodega[0] : null} />
          ) : SECCION_CAMPO[seccion] ? (
            (() => {
              const campo = SECCION_CAMPO[seccion];
              const d = DIMS_OPCIONALES.find(x => x.campo === campo);
              return <SeccionDimension rows={filtrados} campo={campo} etiqueta={d.etiqueta}
                titulo={`Ranking de ${d.seccion.toLowerCase()}`} pregunta={d.pregunta} />;
            })()
          ) : seccion === 'visual' ? (
            <SeccionGraficos rows={filtrados} kpis={kpis} historial={historial} />
          ) : null}
        </main>
      </div>

      {drill && (
        <PanelDetalle hechos={filtrados} ruta={drill} setRuta={setDrill} onCerrar={() => setDrill(null)}
          onFiltrar={v => setFiltros(f => ({
            ...f,
            ...(v.marca ? { marca: [v.marca] } : {}),
            ...(v.referencia ? { referencia: [v.referencia] } : {}),
            ...(v.bodega ? { bodega: [v.bodega] } : {}),
            ...(v.grafico ? { grafico: [v.grafico] } : {}),
          }))} />
      )}
    </div>
    </DrillCtx.Provider>
  );
}
