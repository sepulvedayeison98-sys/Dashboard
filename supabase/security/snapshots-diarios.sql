-- ════════════════════════════════════════════════════════════════════════════
-- HISTÓRICO CEDI → SUPABASE — tabla snapshots_diarios
-- ════════════════════════════════════════════════════════════════════════════
-- Reemplaza el histórico en localStorage (cedi_hist_v1), que hoy:
--   · vive aislado por navegador/dispositivo (cada uno ve una historia distinta)
--   · se pierde al limpiar el navegador
--   · tiene huecos (solo captura si alguien abre la app ese día)
--   · choca contra el límite de ~5 MB de localStorage
--
-- Ejecutar en Supabase → SQL Editor (junto con rls-policies.sql).
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.snapshots_diarios (
  fecha date primary key,
  stats jsonb not null default '{}'::jsonb,   -- {nG,tC,tS,nP,nR} igual que el snapshot local
  skus  jsonb not null default '[]'::jsonb,   -- [{r,g,c,s}] SKUs con gap del día
  peds  jsonb not null default '[]'::jsonb,   -- [{id,cl,ciu,f,u,cls,tp,rows}] pedidos del día
  actualizado_en timestamptz not null default now()
);

-- RLS: el cliente (anon) puede leer y escribir su snapshot del día (merge por fecha),
-- pero NO borrar. La depuración la hace service_role.
alter table public.snapshots_diarios enable row level security;
drop policy if exists snap_select on public.snapshots_diarios;
drop policy if exists snap_insert on public.snapshots_diarios;
drop policy if exists snap_update on public.snapshots_diarios;
create policy snap_select on public.snapshots_diarios for select to anon using (true);
create policy snap_insert on public.snapshots_diarios for insert to anon with check (true);
create policy snap_update on public.snapshots_diarios for update to anon using (true) with check (true);
-- (sin DELETE para anon)

-- Índice para consultas por rango de fechas (tendencias)
create index if not exists snapshots_diarios_fecha_idx on public.snapshots_diarios (fecha desc);

-- ── Verificación ──
-- select fecha, jsonb_array_length(peds) pedidos, actualizado_en
--   from snapshots_diarios order by fecha desc limit 10;

-- ── Plan de migración (después de crear la tabla) ──
-- 1. El cliente pasa a DOBLE ESCRITURA: localStorage + upsert aquí
--    (POST /rest/v1/snapshots_diarios con Prefer: resolution=merge-duplicates).
-- 2. Botón "Importar historia local" sube el JSON exportado (💾 Exportar ya existe).
-- 3. Tras 1-2 semanas estables: el Histórico LEE de aquí y localStorage queda
--    como caché offline. Se retira el candado CEDI2025 (la lectura ya es RLS).
