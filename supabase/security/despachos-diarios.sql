-- ════════════════════════════════════════════════════════════════════════════
-- LEDGER DE DESPACHOS → tabla despachos_diarios + vista rotacion_sku
-- ════════════════════════════════════════════════════════════════════════════
-- PARA QUÉ: hoy la rotación de Slotting (VEL_HIST, embebido en index.app.js) se
-- estima reconstruyendo snapshots del historial de Git y midiendo la CAÍDA DE
-- STOCK por SKU. Ese proxy tiene dos defectos medidos:
--
--   1. Subestima ~24%. Solo ve la caída NETA: si un SKU despacha 50 u y recibe
--      40 u de reposición el mismo día, cuenta 10 (lo real fue 50).
--   2. Es manual. Hay que regenerarlo a mano en cada actualización de datos;
--      no se retroalimenta solo.
--
-- LA FUENTE REAL: el propio Inventario.xlsx trae columnas `entradas`/`salidas`
-- por fila. Se verificó sobre las 51.114 filas del archivo que se cumple SIEMPRE,
-- sin una sola excepción:
--
--                     saldo = entradas − salidas
--
-- Es decir, son el movimiento ACUMULADO DE VIDA de cada lote físico (llave única
-- verificada: Orden|Referencia|cajap — 37.365 llaves para 37.365 filas CASCO ICH).
-- No sirven tal cual (no se sabe en cuánto tiempo se acumularon), pero el DELTA
-- de `salidas` entre dos actualizaciones SÍ son unidades despachadas reales del
-- WMS en esa ventana.
--
-- Validación contra el método actual sobre 15 días reales (2–24 jul, 2.440 SKUs):
--   · caída de stock (método actual) ....... 65.143 u
--   · Δsalidas WMS (lotes vivos) ........... 25.599 u
--   · saldo de lotes agotados .............. 55.336 u
--   · TOTAL despachos reales ............... 80.935 u
--   · correlación entre ambos métodos ...... r = 0,982
--
-- La correlación alta confirma que la clasificación Alta/Media/Baja de hoy YA es
-- confiable en su ranking; este ledger corrige la magnitud absoluta (u/día) y,
-- sobre todo, hace que la rotación se alimente sola.
--
-- OJO — llave estable a reubicaciones: la llave de lote NO incluye `ubicacion`.
-- El CEDI mueve pallets altura↔piso todo el día; si se incluye la ubicación, cada
-- reubicación se cuenta falsamente como "lote consumido" (probado: infla el total
-- de 55.336 u a 178.236 u, un +222% inventado).
--
-- Ejecutar en: Supabase → SQL Editor.
-- Carga de datos: node scripts/ingest-despachos.js  (ver cabecera de ese archivo)
-- ════════════════════════════════════════════════════════════════════════════

-- ── Tabla ────────────────────────────────────────────────────────────────────
-- Una fila por (día, SKU). Solo se insertan SKUs CON movimiento ese día: la
-- ausencia de fila significa "no se despachó nada", y así la tabla se mantiene
-- en ~2.500 filas por actualización en vez de ~37.000.
create table if not exists public.despachos_diarios (
  fecha          date not null,
  ref            text not null,
  unidades       numeric not null default 0,
  metodo         text not null default 'salidas_wms',  -- trazabilidad del origen
  actualizado_en timestamptz not null default now(),
  primary key (fecha, ref)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- El navegador SOLO LEE. La escritura la hace el script de ingesta con
-- service_role (que salta RLS), nunca el cliente. Esto es más estricto que
-- turnos/asignaciones, donde el cliente sí escribe por necesidad operativa.
alter table public.despachos_diarios enable row level security;
drop policy if exists desp_select on public.despachos_diarios;
create policy desp_select on public.despachos_diarios for select to anon using (true);
-- (sin INSERT/UPDATE/DELETE para anon → el ledger no se puede alterar desde el cliente)

create index if not exists despachos_diarios_ref_idx   on public.despachos_diarios (ref);
create index if not exists despachos_diarios_fecha_idx on public.despachos_diarios (fecha desc);

-- ── Vista de rotación ────────────────────────────────────────────────────────
-- Entrega la rotación ya calculada para que el dashboard la consuma en UN request
-- (~2.500 filas) en vez de traerse el ledger completo y agregar en el navegador.
--
-- IMPORTANTE: `dias` es la ventana GLOBAL del ledger (primera a última fecha
-- cargada), no los días propios de cada SKU. Dividir por los días propios daría
-- una velocidad inflada: un SKU que despachó 30 u en un solo día no rota 30 u/día,
-- rota 30/ventana. Ese fue exactamente el tipo de error que se corrigió antes.
create or replace view public.rotacion_sku as
with ventana as (
  select
    min(fecha) as desde,
    max(fecha) as hasta,
    greatest(max(fecha) - min(fecha), 1) as dias
  from public.despachos_diarios
)
select
  d.ref,
  sum(d.unidades)                          as total_u,
  count(*)                                 as dias_con_mov,
  v.desde,
  v.hasta,
  v.dias,
  round(sum(d.unidades) / v.dias, 2)       as vel_dia,
  -- Mismos umbrales que ya usa Slotting hoy (alta ≥1 · media ≥0,2 · baja ≥0,05)
  case
    when round(sum(d.unidades) / v.dias, 2) >= 1    then 'alta'
    when round(sum(d.unidades) / v.dias, 2) >= 0.2  then 'media'
    when round(sum(d.unidades) / v.dias, 2) >= 0.05 then 'baja'
    else 'sin_movimiento'
  end                                      as rotacion
from public.despachos_diarios d
cross join ventana v
group by d.ref, v.desde, v.hasta, v.dias;

grant select on public.rotacion_sku to anon;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- select desde, hasta, dias, count(*) skus, sum(total_u) unidades
--   from rotacion_sku group by desde, hasta, dias;
--
-- select rotacion, count(*) from rotacion_sku group by rotacion order by 2 desc;
--
-- Contraste contra lo que muestra Slotting hoy (VEL_HIST embebido): el ranking
-- debería coincidir casi 1:1 (r=0,982 medido); las magnitudes u/día subirán ~24%
-- porque el método actual subestima. Si el ranking NO coincide, algo está mal en
-- la ingesta — no publicar hasta entenderlo.

-- ── Plan de conexión (después de cargar datos) ───────────────────────────────
-- 1. Backfill: node scripts/ingest-despachos.js --backfill  → 15 días de historial.
-- 2. index.app.js consulta /rest/v1/rotacion_sku?select=ref,vel_dia,rotacion
--    al cargar, y usa VEL_HIST embebido como FALLBACK si Supabase no responde
--    (el proyecto ya estuvo pausado una vez: Slotting nunca puede quedarse en blanco).
-- 3. Cada actualización de Inventario.xlsx corre la ingesta incremental → la
--    ventana crece sola y VEL_HIST embebido deja de tener que regenerarse a mano.
