# 🔐 Runbook de Seguridad — Ejecución nocturna (bodega cerrada)

Secuencia para cerrar los 3 riesgos P0. Hacerlo de noche para no afectar la operación.
Cada paso es reversible. Tiempo total estimado: ~45 min.

---

## Paso 1 — Confirmar estado de RLS  *(solo tú · 5 min)*
Supabase → **SQL Editor** → ejecutar:
```sql
select tablename, rowsecurity from pg_tables
where schemaname='public'
and tablename in ('turnos','asignaciones','usuarios','push_subscriptions');
```
- `rowsecurity = false` → RLS APAGADO (riesgo alto, seguir al Paso 2).
- `rowsecurity = true` → ya hay RLS; revisar las policies existentes antes de continuar.

## Paso 2 — Activar RLS  *(solo tú · 5 min)*
Supabase → **SQL Editor** → pegar y ejecutar `supabase/security/rls-policies.sql`.
Esto permite leer/insertar/actualizar con la anon key, pero **bloquea DELETE** para `anon`.

## Paso 3 — Rotar y asegurar las claves VAPID  *(tú + yo · 10 min)*
1. Generar un par NUEVO de claves VAPID (la vieja estuvo en git → comprometida):
   ```
   npx web-push generate-vapid-keys
   ```
2. Guardarlas como secrets (NUNCA en el código):
   ```
   supabase secrets set \
     VAPID_PUBLIC_KEY=<nueva_publica> \
     VAPID_PRIVATE_KEY=<nueva_privada> \
     VAPID_SUBJECT=mailto:sepulvedayeison98@gmail.com
   ```
3. Actualizar la **clave pública nueva** en el front (`VAPID_PUB` de pipeline.html y
   montacargas.html). → este cambio de código lo aplico yo.
4. Los operarios deben **re-suscribirse** a notificaciones (la suscripción vieja
   queda inválida al cambiar el par).

## Paso 4 — Desplegar la Edge Function endurecida  *(solo tú · 5 min)*
Ya dejé `index.ts` leyendo las claves desde `Deno.env`. Desplegar:
```
supabase functions deploy notify-montacarguistas
```
> Importante: hacer el Paso 3.2 (secrets) ANTES de desplegar, o la función fallará por
> falta de VAPID.

## Paso 5 — Quitar el DELETE del cliente  *(yo · HECHO en código)*
✅ **Aplicado.** `pipeline.html → limpiarBandeja` ya NO hace DELETE directo:
llama a la Edge Function `limpiar-bandeja` (service_role) por POST y maneja el
error con un aviso. Solo falta **desplegarla**: `supabase functions deploy
limpiar-bandeja` (Paso 4 bis). Si al desplegar la función rechaza la anon key
(las nuevas `sb_publishable_…` no son JWT), desplegar con `--no-verify-jwt`.

> ⚠️ **Gap detectado — otros DELETE que el RLS también romperá (fuera del runbook original):**
> Al activar el RLS (Paso 2) se bloquea TODO DELETE de `anon` en las 4 tablas, no
> solo "Limpiar bandeja". Quedan sin cubrir:
> - **`admin.html`**: `deleteTurno`, borrado masivo de turnos, limpieza de
>   completados/fallidos y de asignaciones → dejarán de funcionar.
> - **`pipeline.html` login**: borra el `usuario` operario antes de reinsertarlo
>   (limpieza de presencia). Con RLS el DELETE falla silencioso → **usuarios
>   duplicados**. Fix sugerido: cambiar delete+insert por upsert (merge-duplicates).
> Decisión pendiente del dueño: crear Edge Functions equivalentes para admin, o
> mover esas operaciones a un panel con service_role. **No aplicado aún** para no
> ampliar alcance sin confirmación.

---

## ✅ Checklist final
- [ ] RLS habilitado en las 4 tablas
- [ ] DELETE bloqueado para anon (verificado)
- [ ] Claves VAPID rotadas y en secrets
- [ ] Edge Function push desplegada y push funcionando
- [ ] Clave pública nueva en el front  ← **bloqueado: necesito la nueva VAPID_PUBLIC del Paso 3.1**
- [x] "Limpiar bandeja" ya no usa DELETE directo (código)
- [ ] Edge Function `limpiar-bandeja` desplegada
- [ ] Decidir/cubrir DELETE de admin.html y presencia de operario (gap arriba)
- [ ] Picking y Montacargas operan normal (prueba de humo)

> Lo que necesita TU acceso a Supabase: pasos 1, 2, 3.2, 4 (+ deploy de `limpiar-bandeja`).
> Lo que aplico yo en código: paso 5 ✅ · paso 3.3 (bloqueado hasta tener la nueva clave pública).
