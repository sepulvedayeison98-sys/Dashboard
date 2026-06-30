// Edge Function: limpiar-bandeja
// Reemplaza el DELETE directo desde el cliente. Borra turnos completados/fallidos
// y sus asignaciones usando service_role (ignora RLS de forma controlada).
//
// Desplegar (de noche):  supabase functions deploy limpiar-bandeja
// Proteger (opcional pero recomendado):
//   supabase secrets set CLEAN_SECRET=<algo-secreto>
//   → entonces el cliente debe enviar header  x-clean-secret: <algo-secreto>
//
// Llamada desde el front (reemplaza el DELETE directo):
//   await fetch(`${SUPA_URL}/functions/v1/limpiar-bandeja`, {
//     method: "POST",
//     headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
//                "x-clean-secret": "<...>" }
//   });

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-clean-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: CORS });
  }

  // Guard opcional: si CLEAN_SECRET está configurado, exigirlo.
  const expected = Deno.env.get("CLEAN_SECRET");
  if (expected && req.headers.get("x-clean-secret") !== expected) {
    return new Response("forbidden", { status: 403, headers: CORS });
  }

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const H = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };

  // 1. Traer turnos completados/fallidos (para conocer sus pickings)
  const resT = await fetch(
    `${SUPA_URL}/rest/v1/turnos?estado=in.(completado,fallido)&select=id,picking`,
    { headers: H },
  );
  if (!resT.ok) {
    return new Response("error fetching turnos", { status: 500, headers: CORS });
  }
  const turnos: Array<{ id: string; picking: string }> = await resT.json();
  if (!turnos.length) {
    return new Response(JSON.stringify({ turnos: 0, asignaciones: 0 }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // 2. Borrar esos turnos
  await fetch(`${SUPA_URL}/rest/v1/turnos?estado=in.(completado,fallido)`, {
    method: "DELETE",
    headers: { ...H, Prefer: "return=minimal" },
  });

  // 3. Borrar las asignaciones asociadas
  const pickings = [...new Set(turnos.map((t) => t.picking).filter(Boolean))];
  if (pickings.length) {
    await fetch(
      `${SUPA_URL}/rest/v1/asignaciones?picking=in.(${pickings.join(",")})`,
      { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } },
    );
  }

  return new Response(
    JSON.stringify({ turnos: turnos.length, asignaciones: pickings.length }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
