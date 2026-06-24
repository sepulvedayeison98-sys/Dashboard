// Edge Function: envía Web Push cuando se inserta un turno nuevo
// Disparado por el trigger SQL on_turno_insert via pg_net
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";

webpush.setVapidDetails(
  "mailto:sepulvedayeison98@gmail.com",
  "BIkO5rFXvS_7NPyJSWIWyoUhafWswdr0ImaaYV2s8EvHVLiYxkHLQGcWUKOxII5fXlkL9-o4E38oKKy9qwZTspM",
  "yHjfGZk9gw4a2stLfJe-p-ptmcnjCKEOzGMpUR4-gpw"
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let turno: Record<string, unknown> = {};
  try { const body = await req.json(); turno = body.record ?? body; } catch (_) {}

  // Traer todas las suscripciones activas
  const res = await fetch(`${SUPA_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
  });
  if (!res.ok) return new Response("error fetching subs", { status: 500 });

  const subs: Array<{ endpoint: string; p256dh: string; auth: string }> = await res.json();
  if (!subs.length) return new Response("no subs", { status: 200 });

  const urgente = turno.es_mde || turno.prioridad === "urgente";
  const payload = JSON.stringify({
    title: `${urgente ? "🚨" : "🏗️"} Nuevo turno · ${turno.picking ?? ""}`,
    body: `${turno.cliente ?? ""}${turno.ciudad ? ` · ${turno.ciudad}` : ""}${urgente ? " · URGENTE" : ""}`
  });

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  // Limpiar suscripciones caducadas (410 = endpoint ya no existe)
  const dead = subs.filter((_, i) => {
    const r = results[i];
    return r.status === "rejected" &&
      [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0);
  });

  for (const d of dead) {
    await fetch(
      `${SUPA_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(d.endpoint)}`,
      { method: "DELETE", headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Prefer: "return=minimal" } }
    );
  }

  return new Response(
    JSON.stringify({ sent: subs.length - dead.length, removed: dead.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
