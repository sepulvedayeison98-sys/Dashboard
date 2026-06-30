// Edge Function: envía Web Push cuando se inserta/actualiza un turno
// Recibe target_rol para notificar solo al grupo correcto (montacarguista u operario)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";

// Claves VAPID desde secrets (NO hardcodear). Configurar antes de desplegar:
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...
// IMPORTANTE: rotar el par de claves antiguo (estuvo versionado en git).
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:sepulvedayeison98@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}

  const turno = (body.record ?? body) as Record<string, unknown>;
  const target_rol = (body.target_rol as string) ?? "montacarguista";

  // Traer suscripciones del rol correcto
  const res = await fetch(
    `${SUPA_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth&rol=eq.${encodeURIComponent(target_rol)}`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
  );
  if (!res.ok) return new Response("error fetching subs", { status: 500 });

  const subs: Array<{ endpoint: string; p256dh: string; auth: string }> = await res.json();
  if (!subs.length) return new Response("no subs", { status: 200 });

  let title: string;
  let bodyText: string;

  if (body.titulo_override) {
    title = body.titulo_override as string;
    bodyText = (body.cuerpo_override as string) ?? "";
  } else {
    const urgente = turno.es_mde || turno.prioridad === "urgente";
    title = `${urgente ? "🚨" : "🏗️"} Nuevo turno · ${turno.picking ?? ""}`;
    bodyText = `${turno.cliente ?? ""}${turno.ciudad ? ` · ${turno.ciudad}` : ""}${urgente ? " · URGENTE" : ""}`;
  }

  const payload = JSON.stringify({ title, body: bodyText });

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

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
    JSON.stringify({ sent: subs.length - dead.length, removed: dead.length, rol: target_rol }),
    { headers: { "Content-Type": "application/json" } }
  );
});
