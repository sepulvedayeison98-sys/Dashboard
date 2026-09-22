/* ============================================================================
   EXPORTACIÓN A EXCEL
   Genera un libro listo para trabajar: hoja de portada con los filtros que
   estaban aplicados, una hoja por dimensión con totales y semáforo, y el
   detalle plano al final para tablas dinámicas. Todo con encabezado congelado,
   autofiltro, anchos calculados y formatos numéricos reales (no texto).

   Se usa igual desde el navegador (dashboard) y desde Node (pruebas), así que
   recibe la clase ExcelJS por parámetro en vez de importarla.
   ==========================================================================*/

/* Misma escala de severidad que el dashboard: amarillo más claro y +90 hacia
   carmesí, para que naranja y rojo no se confundan. `sobre` es la tinta del
   texto cuando va encima del color. */
const RANGOS_EXP = [
  { key: '0-30', label: '0–30 días', color: 'FF10B981', sobre: 'FF04140D', desc: 'Normal' },
  { key: '30-60', label: '30–60 días', color: 'FFFDE047', sobre: 'FF3F2D02', desc: 'Atención' },
  { key: '60-90', label: '60–90 días', color: 'FFF97316', sobre: 'FFFFFFFF', desc: 'Crítico' },
  { key: '+90', label: '+90 días', color: 'FFE11D48', sobre: 'FFFFFFFF', desc: 'Crítico extremo' },
];
const CRITICOS_EXP = ['60-90', '+90'];

const TINTA = {
  encabezado: 'FF0B1628',   // azul profundo del dashboard
  textoClaro: 'FFFFFFFF',
  banda: 'FFF3F5F9',
  borde: 'FFD8DEE9',
  titulo: 'FF12161F',
  suave: 'FF6B7280',
};

const FMT_NUM = '#,##0';
const FMT_PCT = '0.0%';

/* --- utilidades de hoja --------------------------------------------------*/

function estiloEncabezado(fila) {
  fila.eachCell(c => {
    c.font = { bold: true, color: { argb: TINTA.textoClaro }, size: 10 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTA.encabezado } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = { bottom: { style: 'thin', color: { argb: TINTA.borde } } };
  });
  fila.height = 26;
}

/* Ancho por contenido real, con tope para que una descripción larga no
   empuje el resto de columnas fuera de la pantalla. */
function ajustarAnchos(hoja, min = 9, max = 42) {
  hoja.columns.forEach(col => {
    let largo = min;
    col.eachCell?.({ includeEmpty: false }, c => {
      const v = c.value == null ? '' : String(c.value.richText ? c.value.richText.map(t => t.text).join('') : c.value);
      largo = Math.max(largo, ...v.split('\n').map(l => l.length + 2));
    });
    col.width = Math.min(max, largo);
  });
}

/* Semáforo sobre el % crítico: el mismo criterio que usa el dashboard. */
function pintarSeveridad(celda, pct) {
  const argb = pct >= 0.45 ? 'FFFDE7E7' : pct >= 0.30 ? 'FFFDEFE3' : pct >= 0.15 ? 'FFFDF7E3' : 'FFE9F7F1';
  const texto = pct >= 0.45 ? 'FFB42318' : pct >= 0.30 ? 'FFB54708' : pct >= 0.15 ? 'FF8A6100' : 'FF067647';
  celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  celda.font = { bold: true, color: { argb: texto }, size: 10 };
}

/* --- agregación (misma lógica que el dashboard) --------------------------*/

function agrupar(rows, campo) {
  const mapa = new Map();
  for (const r of rows) {
    const clave = r[campo];
    if (clave == null) continue;
    let e = mapa.get(clave);
    if (!e) {
      e = { clave, total: 0, rangos: {}, items: new Set(), refs: new Set(), bodegas: new Set(), marcas: new Set() };
      mapa.set(clave, e);
    }
    e.total += r.unidades;
    e.rangos[r.rango_dias] = (e.rangos[r.rango_dias] || 0) + r.unidades;
    e.items.add(r.item); e.refs.add(r.referencia); e.bodegas.add(r.bodega); e.marcas.add(r.marca);
  }
  return [...mapa.values()].map(e => {
    const critico = CRITICOS_EXP.reduce((a, k) => a + (e.rangos[k] || 0), 0);
    return {
      ...e,
      items: e.items.size, refs: e.refs.size, bodegas: e.bodegas.size, marcas: e.marcas.size,
      critico, pctCritico: e.total ? critico / e.total : 0,
    };
  }).sort((a, b) => b.critico - a.critico || b.total - a.total);
}

/* --- hojas ---------------------------------------------------------------*/

function hojaResumen(wb, { rows, kpis, meta, filtrosTexto }) {
  const h = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });

  const titulo = h.addRow(['Inventario de lenta rotación']);
  titulo.font = { bold: true, size: 18, color: { argb: TINTA.titulo } };
  titulo.height = 26;
  h.mergeCells('A1:D1');

  const sub = h.addRow([`Generado el ${meta.generado}  ·  Origen: ${meta.archivo}`]);
  sub.font = { size: 10, color: { argb: TINTA.suave } };
  h.mergeCells('A2:D2');
  h.addRow([]);

  // Filtros aplicados: sin esto, el archivo no es auditable fuera del dashboard.
  const tf = h.addRow(['FILTROS APLICADOS']);
  tf.font = { bold: true, size: 11, color: { argb: TINTA.titulo } };
  h.addRow([]).height = 4;
  for (const [campo, valor] of filtrosTexto) {
    const f = h.addRow([campo, valor]);
    f.getCell(1).font = { bold: true, size: 10, color: { argb: TINTA.suave } };
    f.getCell(2).font = { size: 10, color: { argb: TINTA.titulo } };
    f.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  }
  h.addRow([]);

  const tk = h.addRow(['INDICADORES']);
  tk.font = { bold: true, size: 11, color: { argb: TINTA.titulo } };
  h.addRow([]).height = 4;

  const kpiFilas = [
    ['Unidades totales', kpis.total, FMT_NUM],
    ['Crítico ≥60 días', kpis.critico, FMT_NUM],
    ['% crítico', kpis.pctCritico, FMT_PCT],
    ['Lenta rotación (>30 días)', kpis.lenta, FMT_NUM],
    ['% lenta rotación', kpis.pctLenta, FMT_PCT],
    ['Ítems distintos', kpis.items, FMT_NUM],
    ['Referencias distintas', kpis.referencias, FMT_NUM],
    ['Bodegas distintas', kpis.bodegas, FMT_NUM],
    ['Registros exportados', rows.length, FMT_NUM],
  ];
  for (const [etq, val, fmt] of kpiFilas) {
    const f = h.addRow([etq, val]);
    f.getCell(1).font = { bold: true, size: 10, color: { argb: TINTA.suave } };
    f.getCell(2).numFmt = fmt;
    f.getCell(2).font = { bold: true, size: 11, color: { argb: TINTA.titulo } };
  }
  h.addRow([]);

  const tc = h.addRow(['COMPOSICIÓN POR ANTIGÜEDAD']);
  tc.font = { bold: true, size: 11, color: { argb: TINTA.titulo } };
  h.addRow([]).height = 4;

  const enc = h.addRow(['Rango', 'Estado', 'Unidades', '% del total']);
  estiloEncabezado(enc);
  for (const r of RANGOS_EXP) {
    const v = kpis.porRango[r.key] || 0;
    const f = h.addRow([r.label, r.desc, v, kpis.total ? v / kpis.total : 0]);
    f.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r.color } };
    f.getCell(1).font = { bold: true, color: { argb: r.sobre }, size: 10 };
    f.getCell(3).numFmt = FMT_NUM;
    f.getCell(4).numFmt = FMT_PCT;
  }
  const tot = h.addRow(['Total', '', kpis.total, kpis.total ? 1 : 0]);
  tot.eachCell(c => { c.font = { bold: true, size: 10 }; c.border = { top: { style: 'double', color: { argb: TINTA.encabezado } } }; });
  tot.getCell(3).numFmt = FMT_NUM;
  tot.getCell(4).numFmt = FMT_PCT;

  ajustarAnchos(h, 14, 60);
  return h;
}

function hojaDimension(wb, nombre, etiqueta, rows, campo, extras = []) {
  const datos = agrupar(rows, campo);
  const h = wb.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] });

  const cols = [etiqueta, 'Unidades', '0–30', '30–60', '60–90', '+90', 'Crítico ≥60', '% crítico', ...extras.map(e => e.titulo)];
  estiloEncabezado(h.addRow(cols));

  for (const d of datos) {
    const f = h.addRow([
      d.clave, d.total,
      d.rangos['0-30'] || 0, d.rangos['30-60'] || 0, d.rangos['60-90'] || 0, d.rangos['+90'] || 0,
      d.critico, d.pctCritico,
      ...extras.map(e => d[e.campo]),
    ]);
    f.getCell(1).font = { size: 10 };
    for (let i = 2; i <= 7; i++) f.getCell(i).numFmt = FMT_NUM;
    f.getCell(8).numFmt = FMT_PCT;
    pintarSeveridad(f.getCell(8), d.pctCritico);
    extras.forEach((_, i) => { f.getCell(9 + i).numFmt = FMT_NUM; });
    f.getCell(2).font = { bold: true, size: 10 };
    f.getCell(7).font = { bold: true, size: 10, color: { argb: 'FFB42318' } };
  }

  // Fila de totales, para no tener que sumarlo a mano al abrir el archivo.
  const n = datos.length;
  if (n) {
    const sum = c => ({ formula: `SUBTOTAL(109,${c}2:${c}${n + 1})` });
    const f = h.addRow(['TOTAL', sum('B'), sum('C'), sum('D'), sum('E'), sum('F'), sum('G'),
      { formula: `IF(B${n + 2}=0,0,G${n + 2}/B${n + 2})` },
      ...extras.map(() => null)]);
    f.eachCell(c => {
      c.font = { bold: true, size: 10 };
      c.border = { top: { style: 'double', color: { argb: TINTA.encabezado } } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTA.banda } };
    });
    for (let i = 2; i <= 7; i++) f.getCell(i).numFmt = FMT_NUM;
    f.getCell(8).numFmt = FMT_PCT;
    h.autoFilter = { from: { row: 1, column: 1 }, to: { row: n + 1, column: cols.length } };
  }

  ajustarAnchos(h);
  return h;
}

function hojaDetalle(wb, rows, dimsExtra = []) {
  const h = wb.addWorksheet('Detalle', { views: [{ state: 'frozen', ySplit: 1 }] });
  const cols = [...dimsExtra.filter(d => d.campo !== 'grafico').map(d => d.etiqueta),
    'Marca', 'Referencia', ...(dimsExtra.some(d => d.campo === 'grafico') ? ['Gráfico'] : []),
    'Ítem', 'Bodega', 'Rango de días', 'Estado', 'Unidades'];
  estiloEncabezado(h.addRow(cols));

  // Orden accionable: primero lo más viejo, y dentro de cada rango lo de mayor volumen.
  const orden = { '+90': 0, '60-90': 1, '30-60': 2, '0-30': 3 };
  const ordenadas = [...rows].sort((a, b) => (orden[a.rango_dias] - orden[b.rango_dias]) || (b.unidades - a.unidades));

  for (const r of ordenadas) {
    const meta = RANGOS_EXP.find(x => x.key === r.rango_dias);
    const f = h.addRow([
      ...dimsExtra.filter(d => d.campo !== 'grafico').map(d => r[d.campo] ?? ''),
      r.marca, r.referencia, ...(dimsExtra.some(d => d.campo === 'grafico') ? [r.grafico ?? ''] : []),
      r.item, r.bodega, meta.label, meta.desc, r.unidades,
    ]);
    f.eachCell(c => { c.font = { size: 10 }; });
    const cEstado = f.getCell(cols.length - 1);
    cEstado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: meta.color } };
    cEstado.font = { bold: true, size: 10, color: { argb: meta.sobre } };
    const cUni = f.getCell(cols.length);
    cUni.numFmt = FMT_NUM;
    cUni.font = { bold: true, size: 10 };
  }

  if (ordenadas.length) {
    h.autoFilter = { from: { row: 1, column: 1 }, to: { row: ordenadas.length + 1, column: cols.length } };
  }
  ajustarAnchos(h);
  return h;
}

/* --- API pública ---------------------------------------------------------*/

/**
 * Construye el libro completo. `ExcelJS` se recibe por parámetro para poder
 * ejecutarlo tanto en el navegador como en Node.
 * Devuelve el workbook listo para escribir.
 */
export function construirLibro(ExcelJS, { rows, kpis, meta, filtrosTexto, dimsExtra = [] }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dashboard Lenta Rotación';
  wb.created = new Date();
  const hayGrafico = dimsExtra.some(d => d.campo === 'grafico');

  hojaResumen(wb, { rows, kpis, meta, filtrosTexto });

  // Clasificación primero (origen, línea, tipo…), luego el detalle del producto.
  for (const d of dimsExtra.filter(x => x.campo !== 'grafico')) {
    hojaDimension(wb, `Por ${d.etiqueta.toLowerCase()}`.slice(0, 31), d.etiqueta, rows, d.campo,
      [{ titulo: 'Marcas', campo: 'marcas' }, { titulo: 'Referencias', campo: 'refs' }, { titulo: 'Bodegas', campo: 'bodegas' }]);
  }
  hojaDimension(wb, 'Por marca', 'Marca', rows, 'marca',
    [{ titulo: 'Referencias', campo: 'refs' }, { titulo: 'Ítems', campo: 'items' }, { titulo: 'Bodegas', campo: 'bodegas' }]);
  if (hayGrafico) {
    hojaDimension(wb, 'Por gráfico', 'Gráfico', rows, 'grafico',
      [{ titulo: 'Marcas', campo: 'marcas' }, { titulo: 'Referencias', campo: 'refs' }, { titulo: 'Bodegas', campo: 'bodegas' }]);
  }
  hojaDimension(wb, 'Por referencia', 'Referencia', rows, 'referencia',
    [{ titulo: 'Ítems', campo: 'items' }, { titulo: 'Bodegas', campo: 'bodegas' }]);
  hojaDimension(wb, 'Por bodega', 'Bodega', rows, 'bodega',
    [{ titulo: 'Marcas', campo: 'marcas' }, { titulo: 'Referencias', campo: 'refs' }, { titulo: 'Ítems', campo: 'items' }]);
  hojaDetalle(wb, rows, dimsExtra);

  return wb;
}

/* ============================================================================
   ALTERNATIVA EN HTML PARA EXCEL
   El visor de artifacts de claude.ai no admite descargar .xlsx, pero sí .html.
   Excel abre un HTML con directivas MSO como un libro de varias hojas,
   conservando colores, negritas y números. Se usa solo como respaldo cuando
   la descarga .xlsx no está disponible; el contenido es el mismo.
   ==========================================================================*/

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const argbACss = a => `#${String(a).slice(2)}`;

/* Las clases evitan repetir el estilo completo en cada celda: con ~22.000
   filas la diferencia entre estilos en línea y clases son varios megas, y el
   guardado del visor tiene tope de 16 MiB. */
const CLASES_HTML = `
td,th{font-family:Arial,sans-serif;font-size:11px;vertical-align:middle;border:1px solid ${argbACss(TINTA.borde)};padding:4px 8px}
th{background:${argbACss(TINTA.encabezado)};color:#fff;font-weight:700;text-align:center;padding:6px 8px}
.n{text-align:right}
.b{font-weight:700}
.cr{color:#B42318;font-weight:700}
.s0{background:#E9F7F1;color:#067647;font-weight:700}
.s1{background:#FDF7E3;color:#8A6100;font-weight:700}
.s2{background:#FDEFE3;color:#B54708;font-weight:700}
.s3{background:#FDE7E7;color:#B42318;font-weight:700}
${RANGOS_EXP.map((r, i) => `.r${i}{background:${argbACss(r.color)};color:${argbACss(r.sobre)};font-weight:700}`).join('\n')}
br{mso-data-placement:same-cell}
`;

function tablaHTML({ encabezados, filas, anchos }) {
  const th = encabezados.map(h => `<th>${esc(h)}</th>`).join('');

  const tr = filas.map(f => '<tr>' + f.map(c => {
    if (c && typeof c === 'object') {
      const cls = [c.num ? 'n' : '', c.cls || '', c.negrita && !c.cls ? 'b' : ''].filter(Boolean).join(' ');
      // x:num hace que Excel lo interprete como número y no como texto.
      return `<td${c.num ? ' x:num' : ''}${cls ? ` class="${cls}"` : ''}>${esc(c.v)}</td>`;
    }
    return `<td>${esc(c)}</td>`;
  }).join('') + '</tr>').join('');

  const cols = (anchos || []).map(w => `<col width="${Math.round(w * 7)}">`).join('');
  return `<table border="0" cellspacing="0" cellpadding="0">${cols}<thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

/** Construye el archivo .html que Excel abre como libro de varias hojas. */
export function construirHTMLExcel({ rows, kpis, meta, filtrosTexto, dimsExtra = [] }) {
  const hayGrafico = dimsExtra.some(d => d.campo === 'grafico');
  const extrasNoGraf = dimsExtra.filter(d => d.campo !== 'grafico');
  const hojas = [];
  const numero = n => ({ v: n, num: true });

  // --- Resumen ---
  const filasResumen = [
    ...filtrosTexto.map(([k, v]) => [{ v: k, negrita: true }, v]),
    ['', ''],
    [{ v: 'INDICADORES', negrita: true }, ''],
    [{ v: 'Unidades totales', negrita: true }, numero(kpis.total)],
    [{ v: 'Crítico ≥60 días', negrita: true }, numero(kpis.critico)],
    [{ v: '% crítico', negrita: true }, `${(kpis.pctCritico * 100).toFixed(1)}%`],
    [{ v: 'Lenta rotación (>30 días)', negrita: true }, numero(kpis.lenta)],
    [{ v: '% lenta rotación', negrita: true }, `${(kpis.pctLenta * 100).toFixed(1)}%`],
    [{ v: 'Ítems distintos', negrita: true }, numero(kpis.items)],
    [{ v: 'Referencias distintas', negrita: true }, numero(kpis.referencias)],
    [{ v: 'Bodegas distintas', negrita: true }, numero(kpis.bodegas)],
    ['', ''],
    [{ v: 'COMPOSICIÓN POR ANTIGÜEDAD', negrita: true }, ''],
    ...RANGOS_EXP.map((r, i) => {
      const v = kpis.porRango[r.key] || 0;
      return [{ v: r.label, cls: `r${i}` }, numero(v)];
    }),
    [{ v: 'Total', negrita: true }, numero(kpis.total)],
  ];
  hojas.push({
    nombre: 'Resumen',
    html: `<h2 style="font-family:Arial;margin:0 0 4px">Inventario de lenta rotación</h2>` +
          `<div style="font-family:Arial;font-size:11px;color:#6b7280;margin-bottom:10px">` +
          `Generado el ${esc(meta.generado)} · Origen: ${esc(meta.archivo)}</div>` +
          tablaHTML({ encabezados: ['Concepto', 'Valor'], filas: filasResumen, anchos: [34, 22] }),
  });

  // --- Hojas por dimensión ---
  const dims = [
    ...extrasNoGraf.map(d => [`Por ${d.etiqueta.toLowerCase()}`.slice(0, 31), d.etiqueta, d.campo,
      [['Marcas', 'marcas'], ['Referencias', 'refs'], ['Bodegas', 'bodegas']]]),
    ['Por marca', 'Marca', 'marca', [['Referencias', 'refs'], ['Ítems', 'items'], ['Bodegas', 'bodegas']]],
    ...(hayGrafico ? [['Por gráfico', 'Gráfico', 'grafico', [['Marcas', 'marcas'], ['Referencias', 'refs'], ['Bodegas', 'bodegas']]]] : []),
    ['Por referencia', 'Referencia', 'referencia', [['Ítems', 'items'], ['Bodegas', 'bodegas']]],
    ['Por bodega', 'Bodega', 'bodega', [['Marcas', 'marcas'], ['Referencias', 'refs'], ['Ítems', 'items']]],
  ];

  for (const [nombre, etiqueta, campo, extras] of dims) {
    const datos = agrupar(rows, campo);
    const filas = datos.map(d => {
      const pct = d.pctCritico;
      const sev = pct >= 0.45 ? 's3' : pct >= 0.30 ? 's2' : pct >= 0.15 ? 's1' : 's0';
      return [
        d.clave,
        { v: d.total, num: true, negrita: true },
        numero(d.rangos['0-30'] || 0), numero(d.rangos['30-60'] || 0),
        numero(d.rangos['60-90'] || 0), numero(d.rangos['+90'] || 0),
        { v: d.critico, num: true, cls: 'cr' },
        { v: `${(pct * 100).toFixed(1)}%`, cls: sev },
        ...extras.map(([, c]) => numero(d[c])),
      ];
    });
    hojas.push({
      nombre,
      html: tablaHTML({
        encabezados: [etiqueta, 'Unidades', '0–30', '30–60', '60–90', '+90', 'Crítico ≥60', '% crítico', ...extras.map(e => e[0])],
        filas,
        anchos: [28, 12, 10, 10, 10, 10, 12, 11, ...extras.map(() => 11)],
      }),
    });
  }

  // --- Detalle ---
  const orden = { '+90': 0, '60-90': 1, '30-60': 2, '0-30': 3 };
  const det = [...rows].sort((a, b) => (orden[a.rango_dias] - orden[b.rango_dias]) || (b.unidades - a.unidades));
  hojas.push({
    nombre: 'Detalle',
    html: tablaHTML({
      encabezados: [...extrasNoGraf.map(d => d.etiqueta), 'Marca', 'Referencia', ...(hayGrafico ? ['Gráfico'] : []), 'Ítem', 'Bodega', 'Rango de días', 'Estado', 'Unidades'],
      filas: det.map(r => {
        const i = RANGOS_EXP.findIndex(x => x.key === r.rango_dias);
        const m = RANGOS_EXP[i];
        return [
          ...extrasNoGraf.map(d => r[d.campo] ?? ''),
          r.marca, r.referencia, ...(hayGrafico ? [r.grafico ?? ''] : []),
          r.item, r.bodega, m.label,
          { v: m.desc, cls: `r${i}` },
          { v: r.unidades, num: true, negrita: true },
        ];
      }),
      anchos: [...extrasNoGraf.map(() => 14), 18, 26, ...(hayGrafico ? [26] : []), 12, 12, 14, 16, 12],
    }),
  });

  // Directivas MSO: cada <div> con nombre se abre como una hoja distinta.
  const nombresHojas = hojas.map(h => `<x:ExcelWorksheet><x:Name>${esc(h.nombre)}</x:Name>` +
    `<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>`).join('');

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>${nombresHojas}</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>${CLASES_HTML}</style>
</head><body>` +
    hojas.map(h => `<div>${h.html}</div>`).join('\n') +
    `</body></html>`;
}

export { RANGOS_EXP, agrupar };
