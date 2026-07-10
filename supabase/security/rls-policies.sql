-- ════════════════════════════════════════════════════════════════════════════
-- RLS FASE 1 — Endurecimiento sin romper las apps (anon key actual)
-- ════════════════════════════════════════════════════════════════════════════
-- Objetivo: habilitar Row Level Security y permitir las operaciones que las apps
-- necesitan (SELECT/INSERT/UPDATE con la anon key), pero BLOQUEAR el DELETE para
-- 'anon'. Así se cierra el riesgo catastrófico (vaciado de la operación) sin
-- requerir login todavía. El borrado pasa a hacerse solo desde Edge Functions
-- con service_role.
--
-- Ejecutar en: Supabase → SQL Editor (de noche, con la bodega cerrada).
-- Probar después: que Picking/Montacargas sigan leyendo, agendando y tomando
-- turnos con normalidad. El botón "Limpiar bandeja" dejará de borrar (esperado).
--
-- FASE 2 (futuro): migrar a Supabase Auth y restringir por usuario/rol real.
-- ════════════════════════════════════════════════════════════════════════════

-- ── turnos ───────────────────────────────────────────────────────────────────
alter table public.turnos enable row level security;
drop policy if exists turnos_select on public.turnos;
drop policy if exists turnos_insert on public.turnos;
drop policy if exists turnos_update on public.turnos;
create policy turnos_select on public.turnos for select to anon using (true);
create policy turnos_insert on public.turnos for insert to anon with check (true);
create policy turnos_update on public.turnos for update to anon using (true) with check (true);
-- (sin policy DELETE → 'anon' no puede borrar)

-- ── asignaciones ─────────────────────────────────────────────────────────────
alter table public.asignaciones enable row level security;
drop policy if exists asig_select on public.asignaciones;
drop policy if exists asig_insert on public.asignaciones;
drop policy if exists asig_update on public.asignaciones;
create policy asig_select on public.asignaciones for select to anon using (true);
create policy asig_insert on public.asignaciones for insert to anon with check (true);
create policy asig_update on public.asignaciones for update to anon using (true) with check (true);
-- (sin DELETE para anon)

-- ── usuarios ─────────────────────────────────────────────────────────────────
-- Lectura + registro de presencia (login de operarios: insert/update de
-- activo/fecha_login). Se BLOQUEA solo el DELETE (no se borran cuentas desde el
-- cliente). El login ya no hace delete+insert, usa update-or-insert.
alter table public.usuarios enable row level security;
drop policy if exists usuarios_select on public.usuarios;
drop policy if exists usuarios_insert on public.usuarios;
drop policy if exists usuarios_update on public.usuarios;
create policy usuarios_select on public.usuarios for select to anon using (true);
create policy usuarios_insert on public.usuarios for insert to anon with check (true);
create policy usuarios_update on public.usuarios for update to anon using (true) with check (true);
-- (sin DELETE para anon)

-- ── push_subscriptions ───────────────────────────────────────────────────────
-- El cliente registra su suscripción (insert/upsert) y puede leer la suya.
alter table public.push_subscriptions enable row level security;
drop policy if exists push_select on public.push_subscriptions;
drop policy if exists push_insert on public.push_subscriptions;
drop policy if exists push_update on public.push_subscriptions;
create policy push_select on public.push_subscriptions for select to anon using (true);
create policy push_insert on public.push_subscriptions for insert to anon with check (true);
create policy push_update on public.push_subscriptions for update to anon using (true) with check (true);
-- El borrado de suscripciones muertas lo hace la Edge Function (service_role),
-- que ignora RLS. (sin DELETE para anon)

-- ── Verificación rápida ──────────────────────────────────────────────────────
-- select schemaname, tablename, rowsecurity from pg_tables
--   where schemaname='public' and tablename in
--   ('turnos','asignaciones','usuarios','push_subscriptions');
