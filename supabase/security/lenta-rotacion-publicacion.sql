-- ════════════════════════════════════════════════════════════════════════════
-- LENTA ROTACIÓN — publicación manual compartida
-- ════════════════════════════════════════════════════════════════════════════
-- Permite que un Excel cargado a mano en lenta-rotacion.html lo vean todos.
-- El archivo vive en Storage (bucket público de solo lectura) y una tabla de
-- una sola fila dice cuál es el vigente. Nadie escribe con la anon key: solo
-- la Edge Function publicar-lenta-rotacion (service_role + ADMIN_SECRET).
--
-- Ejecutar en: Supabase → SQL Editor. Es idempotente (se puede repetir).
-- Después:
--   supabase functions deploy publicar-lenta-rotacion --no-verify-jwt
--   supabase secrets set ADMIN_SECRET=<clave>   (si todavía no existe)
-- No toca turnos, asignaciones, usuarios ni ninguna tabla de las otras apps.
-- ════════════════════════════════════════════════════════════════════════════

-- ── tabla: la publicación vigente (siempre id = 1) ──────────────────────────
create table if not exists public.lenta_rotacion_publicacion (
  id             int primary key default 1 check (id = 1),
  fecha_dato     timestamptz not null,
  publicado_en   timestamptz not null default now(),
  publicado_por  text not null,
  archivo        text not null,
  filas          int,
  ruta           text not null
);

alter table public.lenta_rotacion_publicacion enable row level security;
drop policy if exists lenta_pub_select on public.lenta_rotacion_publicacion;
create policy lenta_pub_select on public.lenta_rotacion_publicacion
  for select to anon, authenticated using (true);
-- (sin INSERT/UPDATE/DELETE para anon → solo la Edge Function escribe)

-- ── storage: bucket público de solo lectura, tope 15 MB, solo .xlsx ────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lenta-rotacion', 'lenta-rotacion', true, 15728640,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;
-- (sin policies de escritura en storage.objects → solo service_role sube/borra)
