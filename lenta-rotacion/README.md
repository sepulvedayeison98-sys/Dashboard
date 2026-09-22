# Dashboard de Lenta Rotación

Herramienta analítica para identificar inventario que no rota. Lee un Excel de
inventario, lo normaliza y lo presenta en 12 secciones con drill-down, filtros
por canal y exportación a un libro Excel auditable.

Corre entero en el navegador: no hay servidor, no hay base de datos, y el
archivo que carga el usuario nunca sale de su máquina.

## Uso

Abre `lenta-rotacion.html` (en la raíz del repo) con doble clic, o publícalo en
GitHub Pages. Carga tu Excel de inventario y el dashboard detecta las columnas
solo.

### Columnas que espera

| Tipo | Columnas |
|---|---|
| Obligatorias | Bodega, Ítem, Marca, Referencia |
| Opcionales | Origen, Línea, Tipo de producto, Gráfico |
| Rangos de días | 0–30, 30–60, 60–90, +90 (unidades por rango) |

Las opcionales generan su propia sección y su hoja en el Excel solo si vienen
en el archivo. Si el detector se equivoca, la pantalla de configuración deja
corregir el mapeo antes de procesar.

## Alimentación automática desde SIESA

`lenta-rotacion/data/inventario-siesa.xlsx` (cuando existe) es una copia del
Excel que SIESA publica en vivo en SharePoint, mantenida al día por una
Rutina programada — no se edita a mano.

Cuando `lenta-rotacion.html` está publicado (por ejemplo en GitHub Pages), al
abrirlo intenta traer ese archivo solo, sin que nadie lo descargue ni lo
cargue a mano: si lo encuentra y trae las columnas obligatorias, el panel
queda listo de una vez, con un botón **Actualizar** en el encabezado para
volver a pedirlo sin recargar la página. Si no lo encuentra (todavía no existe
el archivo) o el HTML se abrió como archivo local (doble clic — el navegador
bloquea ese `fetch` por CORS de `file://`), cae sin aviso al flujo manual de
siempre: arrastrar o seleccionar el Excel.

Quien tenga el link de la página publicada ve el dato al día sin hacer nada;
solo quien tenga el conector de Microsoft 365 y permiso de escritura sobre
este repo puede actualizar lo que todos ven.

La actualización corre así:

1. Una sesión de Claude con el conector de Microsoft 365 autorizado descarga
   el Excel desde SharePoint.
2. `node scripts/sync-lenta-rotacion.js <ruta-descargada>` valida que el
   archivo abre como Excel real y trae las columnas obligatorias de la tabla
   de arriba; si algo falla, se detiene sin tocar el archivo publicado.
3. Si el contenido cambió de verdad (comparación por hash, no por fecha),
   reemplaza `lenta-rotacion/data/inventario-siesa.xlsx` y lo reporta; si es
   idéntico al último, no hace nada — para no ensuciar el historial de git
   con commits vacíos.

Este archivo es independiente del `Inventario.xlsx` de la raíz del repo (el
que usan `pipeline.html`, `montacargas.html` y `admin.html`) — nunca lo toca
ni depende de él.

## Exportación a Excel

El botón **Excel** genera un libro `.xlsx` con los filtros que estaban
aplicados: una hoja de resumen, una hoja por dimensión y el detalle plano al
final para tablas dinámicas. Cada hoja de dimensión trae encabezado congelado,
autofiltro, semáforo sobre el `% crítico` y una fila `TOTAL` con `SUBTOTAL`, de
modo que los totales se recalculan si filtras dentro de Excel.

**Dónde lo abres importa.** Desde el HTML descargado (`file://`) o desde un
servidor propio, la descarga es un `.xlsx` nativo. Dentro del visor de
artifacts de claude.ai la página no puede descargar por su cuenta y depende del
anfitrión, que rechaza esa extensión; ahí la exportación degrada en cascada a
`.xls` y luego a `.xls.html` — mismo contenido, mismas hojas, pero no es un
libro nativo. Para el `.xlsx` real, usa el HTML descargado.

## Compilar

```bash
cd build
npm install      # solo la primera vez
./build.sh
```

Sale `lenta-rotacion.html` en la raíz del repo (~2 MB), con React, Recharts,
Tailwind, SheetJS y ExcelJS incrustados. Sin dependencias en tiempo de
ejecución.

El CSS de Tailwind se genera **escaneando el JSX**, así que hay que
regenerarlo junto con el bundle: compilar solo el JS deja clases nuevas sin
estilo, en silencio. `build.sh` hace los dos pasos y falla si detecta una clase
de tamaño que no llegó al CSS.

## Estructura

```
lenta-rotacion/
  DashboardLentaRotacion.jsx   UI, estado, filtros, drill-down
  exportExcel.js               generación del libro (.xlsx y respaldo HTML)
  build/
    build.sh                   CSS + bundle + ensamblado + verificación
    entry.jsx                  punto de entrada de React
    part{1,2,3}.html           envoltorio del HTML final
lenta-rotacion.html            compilado — esto es lo que se publica
```

## Arquitectura

Siete capas, cada una con una responsabilidad, para que cambiar una regla no
obligue a tocar el resto:

| Capa | Qué hace |
|---|---|
| 1 · Dominio | Canales, rangos de días, dimensiones soportadas |
| 2 · Fuente | Lectura del Excel (SheetJS) |
| 3 · Mapeo | Detecta qué columna es qué |
| 4 · Derivación | Deriva el canal desde la bodega, valida |
| 5 · Normalización | Unpivot: una fila por combinación × rango |
| 6 · Selectores | KPIs y agregados |
| 7 · UI | Componentes React |

El **canal** (Nacional / Expo) no viene en el Excel: se deriva de la bodega.
Las bodegas que no están en ninguna lista caen en «Sin canal» y siguen
visibles — no se descartan, porque suelen ser justamente donde se concentra el
inventario viejo.
