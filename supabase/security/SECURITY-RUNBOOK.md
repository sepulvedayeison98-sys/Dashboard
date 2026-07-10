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

### Paso 5 bis — Cubrir el resto de DELETE/escrituras que el RLS afecta  *(yo · HECHO en código)*
Al activar el RLS se bloquea TODO DELETE de `anon` y (según policy) las escrituras a
`usuarios`. Cubierto:
- ✅ **`admin.html`**: `deleteTurno` y `autoLimpiar` → ahora usan la Edge Function
  **`admin-borrar-turnos`** (service_role). `limpiarTodo` → reutiliza `limpiar-bandeja`.
- ✅ **`pipeline.html` login (presencia)**: se quitó el `delete+insert` (que con RLS
  dejaba usuarios duplicados). Ahora hace **update-or-insert** (sin DELETE).
- ✅ **`rls-policies.sql`**: `usuarios` ahora permite SELECT/INSERT/UPDATE para `anon`
  (registro de presencia), **DELETE sigue bloqueado**.
- ✅ **`montacargas.html`**: no hace DELETE ni escribe `usuarios` → sin cambios.

**Falta desplegar** la nueva función:
```
supabase functions deploy admin-borrar-turnos
```
(igual que `limpiar-bandeja`, agregar `--no-verify-jwt` si la anon key no es JWT).
Guard opcional: `supabase secrets set ADMIN_SECRET=<...>` (y enviar `x-admin-secret`).

---

## ✅ Checklist final
- [ ] RLS habilitado en las 4 tablas
- [ ] DELETE bloqueado para anon (verificado)
- [ ] Claves VAPID rotadas y en secrets
- [ ] Edge Function push desplegada y push funcionando
- [ ] Clave pública nueva en el front  ← **bloqueado: necesito la nueva VAPID_PUBLIC del Paso 3.1**
- [x] "Limpiar bandeja" ya no usa DELETE directo (código)
- [x] admin.html y presencia de operario cubiertos (código — Paso 5 bis)
- [ ] Edge Functions `limpiar-bandeja` y `admin-borrar-turnos` desplegadas
- [ ] Picking, Montacargas y Admin operan normal (prueba de humo)

> Lo que necesita TU acceso a Supabase: pasos 1, 2, 3.2, 4 (+ deploy de `limpiar-bandeja`).
> Lo que aplico yo en código: paso 5 ✅ · paso 3.3 (bloqueado hasta tener la nueva clave pública).
