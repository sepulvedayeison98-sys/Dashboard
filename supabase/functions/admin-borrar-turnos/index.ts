// Edge Function: admin-borrar-turnos
// Borrado de turnos desde el panel de administración usando service_role
// (el RLS bloquea DELETE para 'anon'). Reemplaza los DELETE directos de admin.html
// en deleteTurno / autoLimpiar.
//
// Desplegar (de noche):  supabase functions deploy admin-borrar-turnos
//   (si la anon key nueva 'sb_publishable_…' no es JWT: agregar --no-verify-jwt)
// Proteger (opcional):   supabase secrets set ADMIN_SECRET=<algo-secreto>
//   → entonces el cliente debe enviar header  x-admin-secret: <algo-secreto>
//
// Body esperado (POST, JSON):
//   { "ids": ["<turno_id>", ...], "borrarAsignaciones": true|false }
//   - ids: turnos a borrar por id.
//   - borrarAsignaciones: si true, borra también las asignaciones de los pickings
//     de esos turnos (usado por la limpieza automática).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: CORS });
  }

  // Guard opcional
  const expected = Deno.env.get("ADMIN_SECRET");
  if (expected && req.headers.get("x-admin-secret") !== expected) {
    return new Response("forbidden", { status: 403, headers: CORS });
  }

  let body: { ids?: unknown; borrarAsignaciones?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const borrarAsignaciones = body.borrarAsignaciones === true;
  if (!ids.length) return json({ turnos: 0, asignaciones: 0 });

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const H = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };
  const inList = `(${ids.join(",")})`;

  // 1. (opcional) conocer los pickings antes de borrar, para limpiar asignaciones
  let pickings: string[] = [];
  if (borrarAsignaciones) {
    const resT = await fetch(
      `${SUPA_URL}/rest/v1/turnos?id=in.${inList}&select=picking`,
      { headers: H },
    );
    if (resT.ok) {
      const rows: Array<{ picking: string }> = await resT.json();
      pickings = [...new Set(rows.map((r) => r.picking).filter(Boolean))];
    }
  }

  // 2. borrar los turnos por id
  const delT = await fetch(`${SUPA_URL}/rest/v1/turnos?id=in.${inList}`, {
    method: "DELETE",
    headers: { ...H, Prefer: "return=minimal" },
  });
  if (!delT.ok) {
    return json({ error: "error deleting turnos", status: delT.status }, 500);
  }

  // 3. (opcional) borrar asignaciones asociadas
  if (borrarAsignaciones && pickings.length) {
    await fetch(
      `${SUPA_URL}/rest/v1/asignaciones?picking=in.(${pickings.join(",")})`,
      { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } },
    );
  }

  return json({ turnos: ids.length, asignaciones: pickings.length });
});
