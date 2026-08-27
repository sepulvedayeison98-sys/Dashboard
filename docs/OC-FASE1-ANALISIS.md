# 📋 Órdenes de Compra — Fase 1: Entendimiento

> Análisis previo a la construcción. **No se ha escrito código ni creado tablas.**
> Pendiente de validación del usuario antes de pasar a Fase 2.
> Versión visual: artefacto publicado (ver enlace en el PR).

**Leyenda:** `[DATO]` verificado leyendo archivos del repo · `[PROPUESTA]` diseño, no existe aún · `[FALTA]` información que no está.

---

## Bloqueo principal

**En el repositorio no hay ninguna orden de compra.** Ni Excel manual del comercial, ni Excel
del gestor, ni imagen 2D, ni Excel de requisiciones, ni histórico de OC. Lo que hay es el sistema
CEDI (inventario, bandeja de picking, turnos).

Para cerrar la Fase 1 se necesita como mínimo: **2 OC manuales + 2 OC del gestor + el Excel de
requisiciones del mes**.

---

## 1. ¿Qué información existe actualmente?

Fuentes leídas: 2 XLSX (57.064 filas), 4 tablas Supabase, `AUDITORIA.md`, `docs/ARQUITECTURA.md`.

### 1.1 `Inventario.xlsx` — el hallazgo importante `[DATO]`

Hoja `InvxUbiMULTI`, 53.293 filas. Contiene el **maestro de productos ya normalizado**, que es
exactamente la base que el punto 8 del prompt pide construir.

| Nivel | Columna | Distintos | Ejemplo |
|---|---|---|---|
| Línea | `Linea` | 13 | CASCO, ACCES, TEXTIL, MALET |
| Marca | `Marca` | 30+ | ICH, SHAFT, AGV, HJC, LS2 |
| Tipo | `Tipo` | 30+ | INTEGRAL, ABATIBLE, ABIERTO, CROSS |
| **Modelo** | `ReferenciaProducto` | **347** | ICH-501_SP, ICH-3110, SH-596 |
| **SKU** | `cod_producto` | **7.104** | 304163 |
| EAN | `NuevoEAN` | — | 7706913444315 |

La configuración (decal, shell color, second color, finish, visores, talla) **no está en columnas**:
está codificada dentro de `Descripcion` como cadena posicional.

```
CASCO  INTEGRAL  ICH   ICH-501_SP  KYANU  NG   AZ/BL  TR  L    NG.GR.GR.NRL  MATE  SM R2 NG
línea  tipo      marca modelo      decal  shell 2°col  ?  TALLA cód. 4 partes finish  cola variable
```

**Consecuencia arquitectónica nº1:** en el ERP la **talla es parte del SKU** (6.713 SKU de casco
sobre 347 modelos), pero en la OC la talla es una **columna**. Toda la integración depende de un
resolvedor: 1 línea de OC × 6 tallas → hasta 6 `cod_producto`.

**Fiabilidad del parser:** el token de talla cae en la posición 8 en 6.085 de 6.713 SKU, pero se
desplaza entre las posiciones 6 y 12 en el resto, y 8 SKU de AGV usan talla no estándar (`MS`).
Un parser posicional **falla en ~9%** → parsear por patrón + cola de excepciones revisable.

**Tallas reales en inventario** (filas): L 20.293 · XL 13.823 · M 12.827 · S 4.189 · XS 963 · **XXL 11**.
El prompt asume XS–XXL; en la práctica XXL casi no existe. El grid de tallas debe generarse desde
el maestro, no fijarse en código.

### 1.2 `Bandejadeplaneacion.xlsx` — tres canales `[DATO]`

| Hoja | Bodega | Líneas | Clientes | Clientes principales |
|---|---|---|---|---|
| ITAGUÍ | IDC | 2.442 | 109 | Surticascos, Cascos YC, Grupo Famoso |
| **RADAR** | **INDU2** | **1.309** | **65** | **Rino Motorcycles, Alnusan, Motomanía CR, Hertford** |
| PROMICAL | IDCWM | 20 | 17 | Fredmotos CR, consumidores finales |

**RADAR es el canal de las OC que este proyecto quiere controlar**: mayoristas y exportación
(Rep. Dominicana, Ecuador, Costa Rica) — el perfil de "clientes recurrentes" del prompt.

Rango de fechas: 02–31 jul 2026. 173 clientes distintos en total.

**Evidencia de seguimiento manual:** 130 líneas con la nota literal `AUN NO FACTURAR, FALTA OC`.
Hoy el estado de una OC se rastrea en texto libre del ERP.

### 1.3 Supabase `[DATO]`

4 tablas, todas de operación CEDI: `turnos`, `asignaciones`, `usuarios`, `push_subscriptions`.
**Nada de órdenes de compra.** El módulo OC parte de cero en base de datos.

### 1.4 Lo que no está `[FALTA]`

- Cualquier Excel de OC (manual o gestor), cualquier 2D, el Excel de requisiciones.
- Histórico: solo **29 días**, y de despacho (picking), no de órdenes.
- El cliente `ICAL` del ejemplo del prompt **no aparece** entre los 173 clientes. No se usa.

---

## 2. Datos maestros / fijos

| Maestro | Origen | Estado |
|---|---|---|
| Cliente (NIT, razón social, ciudad, país, canal, moneda) | Bandeja: `Nit`, `NOMBRECLIENTE`, `ciudad` | `[DATO]` |
| Modelo (referencia, marca, tipo, línea) | Inventario: `ReferenciaProducto` | `[DATO]` 347 |
| SKU (cod_producto, EAN, descripción, talla) | Inventario: `cod_producto` | `[DATO]` 7.104 |
| Atributos de configuración | Embebidos en `Descripcion` | `[PROPUESTA]` hay que extraerlos |
| Catálogo de tallas | Derivado del maestro | `[PROPUESTA]` |
| Catálogo de estados | — | `[FALTA]` |
| Parámetros / umbrales (SLA, desviación) | — | `[FALTA]` |
| Lista de precios | — | `[FALTA]` |

El **NIT es la clave natural del cliente** y ya está en la bandeja: un NIT, un cliente, N órdenes.

## 3. Datos variables

- **Orden:** nº OC del cliente, fecha OC, fecha recepción, fecha compromiso, fecha real de despacho, estado, valor, moneda, observaciones, archivo origen.
- **Línea:** configuración solicitada, precio unitario, `es_nuevo`, `requiere_2d`.
- **Línea × talla:** la cantidad. Grano más fino; de ahí salen todos los totales.
- **Derivados (nunca escritos a mano):** total por ítem, total de orden, días transcurridos, estado calculado, semáforo.

> El estado "retrasada" **no es un dato variable, es derivado**. Se calcula contra la fecha de
> compromiso. Por eso la fecha de compromiso es el campo más importante que hoy falta.

---

## 4. Entidades necesarias `[PROPUESTA]`

12 tablas, prefijo `oc_` para no colisionar con las 4 tablas CEDI existentes.

| Tabla | Una fila es… | Campos clave |
|---|---|---|
| `oc_clientes` | un cliente | `nit` (UQ), nombre, pais, ciudad, canal, moneda |
| `oc_ordenes` | una OC recibida | numero_oc, cliente_id, origen, fecha_oc, fecha_compromiso, fecha_despacho, estado, valor, pedido_siesa |
| `oc_lineas` | una configuración en una OC | orden_id, modelo_id, decal, shell, finish, visores, spoiler, precio_unit, es_nuevo, requiere_2d |
| **`oc_linea_tallas`** | **una talla de una línea** | linea_id, talla, cantidad, sku_id |
| `productos` | un SKU del ERP | `cod_producto` (PK), ean, modelo_id, talla, atributos |
| `productos_modelo` | un modelo | referencia (PK), marca, tipo, linea |
| `oc_estados_log` | un cambio de estado | orden_id, de, a, fecha, usuario, nota |
| `oc_documentos` | un adjunto | orden_id \| linea_id, tipo, url, fecha |
| `oc_desarrollos_2d` | un desarrollo en curso | linea_id, estado, f_solicitud, f_aprobacion, responsable |
| `oc_historico_mensual` | cliente × modelo × talla × mes | unidades, n_ordenes |
| `oc_parametros` | un umbral configurable | clave, valor, ambito |
| `oc_import_perfiles` | un formato de entrada | nombre, mapeo_columnas (JSON), version |

Las dos no obvias: `oc_estados_log` hace calculables los días y retrasos sin captura manual;
`oc_import_perfiles` permite agregar fuentes **configurando un mapeo en vez de reconstruir el
dashboard** (requisito del punto 14 del prompt).

## 5. Relaciones

```
oc_clientes ─1──N─ oc_ordenes ─1──N─ oc_lineas ─1──N─ oc_linea_tallas
                        │                 │                    │
                        │                 │                    └─N──1─ productos (SKU)
                        │                 │                                 │
                        │                 └─0..1─ oc_desarrollos_2d         └─N──1─ productos_modelo
                        ├─1──N─ oc_estados_log
                        └─1──N─ oc_documentos          oc_lineas ─N──1─ productos_modelo

oc_historico_mensual  ← se recalcula desde oc_linea_tallas (no se escribe a mano)
oc_ordenes.pedido_siesa ┄┄> bandeja / ERP  (enlace débil, por confirmar)
```

Tres reglas derivadas:

1. **Cliente ≠ orden.** El nombre nunca se escribe en `oc_ordenes`; se referencia por `cliente_id`.
2. **Referencia ≠ producto.** `productos_modelo` es la referencia (347); `productos` es el producto vendible (7.104). La OC llega a nivel modelo+configuración; el ERP necesita SKU.
3. **Estimación ≠ orden.** El pedido esperado sale de `oc_historico_mensual` y **nunca escribe en `oc_ordenes`**. Separación física, no solo visual.

---

## 6. Diferencias OC manual vs. OC del gestor `[FALTA]`

**Respuesta débil por falta de archivos.** Comparación basada únicamente en los dos listados de
campos del prompt. Cambiará al recibir un archivo de cada tipo.

| Campo | Manual | Gestor | Implicación |
|---|---|---|---|
| Idioma de encabezados | Español | Inglés (*Brand, Model*) | Mapeo por perfil, no por nombre |
| Cliente | Sí | No listado | En el gestor viene del contexto del archivo |
| Tipo de producto | Sí | No listado | Derivable del modelo vía maestro |
| Imagen | Sí | No listado | Solo la manual trae ítems nuevos con arte |
| Precio unitario / Total USD | **No** | **Sí** | El valor solo se conoce en las del gestor |
| Configuración (9 atributos) | Sí | Sí | **Núcleo común** |
| Cantidades por talla | Sí | Sí | Núcleo común |
| Totales | Por referencia y de orden | Total de unidades | Se recalculan, no se importan |

**Conclusión que no depende del detalle:** ambos comparten los 9 atributos de configuración + el
bloque de tallas → suficiente para definir el esquema interno común. Lo que difiere (precio,
imagen, idioma) se modela como opcional, y `oc_ordenes.origen` evita que el dashboard finja que
una OC manual tiene un valor USD que nadie capturó.

---

## 7. Qué falta para controlar el status

| Falta | Sin esto no se puede… | Criticidad |
|---|---|---|
| **Fecha de compromiso** | calcular retraso | Bloqueante |
| **Catálogo de estados acordado** | saber en qué punto está la orden | Bloqueante |
| **Enlace OC ↔ pedido ERP** | cerrar el ciclo automáticamente | Bloqueante |
| Significado de `EstadoERP` 1/2/3 | reutilizar el estado de la bandeja | Alta |
| Significado de `Estado` 3/5/7 | ídem | Alta |
| Responsable por orden | saber a quién escalar | Media |

Ambos códigos son numéricos sin diccionario en ningún archivo del repo. `EstadoERP` toma 3 valores
(3→3.041 líneas, 2→649, 1→81); `Estado` toma al menos 3, 5 y 7. **No se inventa su significado**,
pero es probable que uno ya represente parte del flujo, y reutilizarlo es mejor que crear un
estado paralelo.

### Flujo de estados propuesto `[PROPUESTA]`

```
Recibida → En revisión → Confirmada → En preparación → Despachada → Cerrada
  [nuevo]    [nuevo]      [nuevo]      [YA EXISTE]     [YA EXISTE]   [nuevo]

fuera de línea:  Bloqueada · Anulada
```

- **"Confirmada" es la bisagra:** la OC se vuelve pedido en el ERP y aparece `PedidoSiesa`. Desde
  ahí el estado **ya no lo escribe nadie**, se lee de la bandeja. Antes sí requiere captura humana
  → conviene que sean pocos estados.
- **"Bloqueada" no es invención:** es lo que hoy se expresa como `AUN NO FACTURAR, FALTA OC` en 130 líneas.

---

## 8. Cómo debería funcionar el histórico `[FALTA]`

Hoy hay **29 días**, de un solo mes, y son líneas de *picking* (lo que salió), no órdenes (lo que
se pidió). Con eso no se puede perfilar ningún cliente.

**Es la parte con más riesgo de fracasar en silencio.** Hay que elegir camino ahora, no después de construir:

- **(a) Cargar el histórico existente** — si las OC anteriores están en OneDrive/SharePoint, se
  importan con el mismo importador y el módulo sirve desde el día uno.
- **(b) Empezar a acumular** — el módulo se construye igual pero el perfil de cliente queda
  deshabilitado y se anuncia como "disponible desde el mes N". Nunca promedios sobre 1 mes.

Diseño `[PROPUESTA]`:
- **Fuente de verdad:** `oc_linea_tallas`. El histórico es una agregación, no una tabla que se llena.
- **Grano:** cliente × modelo × talla × mes.
- **Inmutabilidad:** las órdenes cerradas no se editan; una corrección genera fila nueva.
- **Mínimo para publicar métricas:** 6 meses para promedios, 12 para estacionalidad. Debajo, el
  dashboard dice "datos insuficientes", no un número.

Métricas por cliente: frecuencia, ticket en unidades, mix de modelos, mix de tallas, último pedido,
promedio móvil 3 y 6 meses, tasa de ítems nuevos por orden.

---

## 9. Detección de productos nuevos `[PROPUESTA]`

Cascada de 4 intentos. **"Nuevo" no es una sola cosa:**

| # | Se compara contra | Si coincide | Resultado |
|---|---|---|---|
| 1 | `NuevoEAN` / `cod_producto` | SKU exacto | Existente · resuelto |
| 2 | Firma normalizada modelo+config+talla | SKU único | Existente · resuelto |
| 3 | Firma sin talla | Modelo+config existen, esa talla no | **Talla nueva** |
| 4 | `ReferenciaProducto` | El modelo existe, la config no | **Configuración nueva** |
| — | Nada coincide | — | **Modelo nuevo** |

La proporción del maestro (347 modelos / 7.104 SKU ≈ 20 variantes por modelo) indica que **la
mayoría de "ítems nuevos" serán casos 3 y 4**: decal o color nuevo sobre un casco que ya se fabrica.
El proceso no es el mismo:

- **Configuración nueva** → normalmente sí requiere 2D (arte del decal). Ciclo corto.
- **Modelo nuevo** → molde, homologación, muestra física. Ciclo largo, probablemente fuera de este dashboard.

Por eso `requiere_2d` debe ser campo propio y no deducirse de `es_nuevo`.
`[FALTA]` Confirmar la regla real: ¿todo decal nuevo pide 2D, o solo cuando el cliente no envía el arte?

> **Advertencia de normalización:** los valores de `Marca` vienen con relleno de espacios a la
> derecha (`"HONDA     …"`) y coexisten `INDUC`, `INDUCASCOS` e `INDUC_PREMIUM`. Sin capa de
> limpieza, la comparación marcará como nuevos ítems que ya existen.

---

## 10. Pedido base del mes siguiente `[FALTA]`

**Todavía no se puede definir el método; proponer uno ahora sería inventar.** Elegir entre promedio,
mediana o promedio móvil, y fijar cualquier umbral, exige ver la dispersión real de ≥6 meses.

Lo que sí queda cerrado es la **forma** de la salida:

| Modelo | Últ. pedido *(dato real)* | Promedio 6m *(dato real)* | Base sugerida *(estimación)* | Confianza |
|---|---|---|---|---|

Tres reglas no negociables (punto 10 del prompt):

1. La columna de estimación va **visualmente separada** de las de dato real, con encabezado que dice "estimación".
2. Cada fila muestra su **confianza** (cuántos períodos la sustentan).
3. La estimación **no escribe en `oc_ordenes`** y no hay botón que la convierta en orden. Se exporta, y alguien decide.

---

## 11. Reporte de requisiciones automático

Estructuralmente simple: una agregación con subtotales. Una consulta, no una tabla.

```
desde   oc_linea_tallas → oc_lineas → productos_modelo
donde   orden.estado ∈ (Confirmada, En preparación)   ← POR DEFINIR
        y orden.fecha ∈ período seleccionado
agrupar por  marca, tipo, modelo   con subtotales por marca y total general
medir        SUM(cantidad)
```

`[FALTA]` Dos columnas pedidas que no se pueden mapear porque no están en ninguna fuente:

- **`REP planta`** — ¿reporte de planta, cantidad a reponer, responsable? No se adivina.
- **`Código`** — podría ser `cod_producto` o un código de planta distinto.

Y una decisión de negocio: **¿qué estados entran en la requisición del mes?** Si entran las órdenes
solo recibidas, la planta produce contra algo que aún puede cambiar. Si entran solo las confirmadas,
el reporte llega tarde. Define el valor de todo el reporte.

---

## 12. Arquitectura recomendada `[PROPUESTA]`

Mantener el stack que ya opera (GitHub Pages estático + Supabase por PostgREST, reutilizando
`shared/config.js` y el patrón `_go`), **con una diferencia deliberada respecto al CEDI**.

> `AUDITORIA.md` identifica como falla estructural nº1 la **doble fuente de verdad**: inventario y
> pedidos en Excel manual mientras los turnos viven en Supabase, y por eso "CEDI Live" no es live.
> **El módulo OC no debe repetir ese error.** Aquí el Excel es *entrada*, nunca base de datos: se
> importa, se normaliza, se guarda en Supabase, y desde ese momento la verdad está en la base.

```
ENTRADA        Excel comercial ─┐
               Excel gestor ────┼─→ IMPORTADOR ─→ perfil de mapeo ─→ esquema común
               (fuente futura) ─┘        ├─→ resolvedor de SKU ─→ marca ítems nuevos
                                         └─→ validaciones      ─→ cola de excepciones

MAESTROS       Inventario.xlsx ─→ script de sync ─→ productos · productos_modelo

DATOS          Supabase / PostgREST · RLS activa desde el día uno
               oc_* (12 tablas) + vistas: requisiciones, histórico, excepciones

PRESENTACIÓN   oc.html + oc.app.js  ← JSX PRECOMPILADO, sin Babel en navegador
               Resumen → Cliente → OC → Ítem, sin perder filtros
```

Cuatro decisiones y su porqué:

- **Importación en dos pasos con previsualización.** El usuario ve qué se detectó, qué SKU se
  resolvieron y qué quedó marcado como nuevo *antes* de confirmar. Sin esto, un Excel mal formado
  envenena la base y el histórico queda inservible.
- **Perfiles de mapeo en tabla, no en código.** Cumple "agregar fuentes sin reconstruir": un formato
  nuevo es una fila, no un despliegue.
- **JSX precompilado.** `pipeline.html` ya lo hace y la auditoría lo marca como P1.
- **RLS desde el inicio.** La auditoría marca RLS sin confirmar y `DELETE` desde cliente como P0.
  Un módulo con datos comerciales y precios no puede nacer con ese hueco.

### Orden de construcción sugerido

1. Maestro de productos (sync desde `Inventario.xlsx`) + parser de configuración con cola de excepciones.
2. Esquema `oc_*` en Supabase con RLS.
3. Importador con un solo perfil + previsualización.
4. Vista de status de órdenes + detalle de OC.
5. Detección de ítems nuevos y seguimiento de 2D.
6. Reporte de requisiciones.
7. Histórico y comportamiento de cliente — *solo cuando haya meses suficientes*.
8. Pedido esperado — el último, depende de todo lo anterior.

Los pasos 1–4 ya entregan un sistema útil que reemplaza carpetas y revisión manual.

---

## Semáforo de excepciones

| Nivel | Regla | Estado |
|---|---|---|
| 🔴 Orden retrasada | `hoy > compromiso` y estado no terminal | `[FALTA]` fecha de compromiso |
| 🟠 Cantidad fuera de lo habitual | Requiere histórico para fijar umbral | `[FALTA]` histórico — **no se pone un ±30% arbitrario** |
| 🟡 Ítem nuevo | Contra 7.104 SKU / 347 modelos del maestro | ✅ computable hoy |
| 🟡 2D pendiente | Una vez definida la regla de cuándo se exige 2D | `[PROPUESTA]` casi |
| 🟢 Dentro de lo esperado | Ausencia de las otras cuatro | ✅ computable hoy |

---

## 13. Preguntas a resolver antes de construir

### Archivos necesarios `[FALTA]`

| # | Qué | Para qué |
|---|---|---|
| 1 | 2–3 **OC manuales** de clientes distintos | Perfil de mapeo real y ver cuánto varían entre comerciales |
| 2 | 2–3 **OC del gestor** | Segundo perfil de mapeo |
| 3 | El **Excel de requisiciones** del mes | Saber qué son `REP planta` y `Código` |
| 4 | Un ejemplo de **2D** con su OC asociada | Entender cómo se enlaza el arte con la línea |

### Decisiones de negocio `[FALTA]`

| # | Pregunta | Bloquea |
|---|---|---|
| 5 | ¿Existe hoy una fecha de compromiso? ¿Quién la fija y con qué criterio? | Todo el cálculo de retrasos |
| 6 | ¿Qué significan `EstadoERP` 1/2/3 y `Estado` 3/5/7? | Reutilizar el estado del ERP |
| 7 | ¿Se puede guardar el nº de OC del cliente dentro del pedido en Siesa? | Cierre automático del ciclo |
| 8 | ¿Cuántos meses de OC históricas hay y dónde están? | Histórico, comportamiento y pedido esperado |
| 9 | ¿Qué define que un ítem "requiere 2D"? | Semáforo amarillo y seguimiento de desarrollo |
| 10 | ¿Qué estados entran en la requisición mensual? | Reporte de requisiciones |
| 11 | ¿Quién actualiza el estado y en qué momento? | Diseño de la pantalla de operación |
| 12 | ¿Los 2D viven en OneDrive/SharePoint con enlaces estables? | Módulo de documentos |
| 13 | ¿Cuántos usuarios, qué roles y quién ve precios? | Diseño de RLS |
| 14 | **¿El dashboard cubre solo el canal RADAR o los tres?** | **Alcance completo** |

> **La más urgente es la 14**, y no estaba anticipada hasta ver los datos. Si el alcance es solo
> RADAR (exportación y mayoristas, 65 clientes, 1.309 líneas/mes), el proyecto es abordable y el
> histórico relevante es pequeño. Si son los tres canales, entran 173 clientes y la mayor parte del
> volumen es venta directa que probablemente no llega por OC en Excel. **Cambia el tamaño del
> proyecto, no solo el filtro.**

---

## Estado

Fase 1 cerrada hasta donde los datos disponibles lo permiten. No se ha escrito código ni creado
ninguna tabla, según el punto 20 del prompt.

Lo único que puede empezar sin esperar nada de lo anterior, si se autoriza: el **maestro de
productos y el parser de configuración** (pregunta 9). Es la pieza más laboriosa, depende
únicamente de `Inventario.xlsx` que ya está en el repo, y es prerrequisito de todo lo demás.
