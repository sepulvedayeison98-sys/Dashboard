// Edge Function: publicar-lenta-rotacion
// Publica para todos un Excel cargado a mano en lenta-rotacion.html: lo sube al
// bucket público 'lenta-rotacion' y deja su ruta en la tabla
// lenta_rotacion_publicacion (ver supabase/security/lenta-rotacion-publicacion.sql).
//
// Desplegar:  supabase functions deploy publicar-lenta-rotacion --no-verify-jwt
// Requiere:   supabase secrets set ADMIN_SECRET=<clave>
//   A diferencia de admin-borrar-turnos, aquí la clave es obligatoria: sin
//   ADMIN_SECRET configurado la función rechaza todo (nunca publica abierta).
//
// Request (POST): cuerpo = bytes del .xlsx. Metadatos en headers
// (URI-encoded, porque los headers no admiten tildes):
//   x-admin-secret, x-archivo, x-publicado-por, x-fecha-dato (ISO), x-filas

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-admin-secret, x-archivo, x-publicado-por, x-fecha-dato, x-filas",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const BUCKET = "lenta-rotacion";
const MAX_BYTES = 15 * 1024 * 1024;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const expected = Deno.env.get("ADMIN_SECRET");
  if (!expected || req.headers.get("x-admin-secret") !== expected) {
    return json({ error: "clave de admin incorrecta" }, 403);
  }

  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.length) return json({ error: "archivo vacío" }, 400);
  if (buf.length > MAX_BYTES) return json({ error: "archivo de más de 15 MB" }, 413);
  // Un .xlsx es un ZIP: empieza con "PK".
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) return json({ error: "no es un .xlsx" }, 400);

  const header = (h: string) => {
    try { return decodeURIComponent(req.headers.get(h) ?? "").trim(); } catch { return ""; }
  };
  const archivo = header("x-archivo").slice(0, 200) || "manual.xlsx";
  const publicadoPor = header("x-publicado-por").slice(0, 80) || "sin nombre";
  const fecha = new Date(header("x-fecha-dato"));
  const publicadoEn = new Date().toISOString();
  const fechaDato = isNaN(fecha.getTime()) ? publicadoEn : fecha.toISOString();
  const filas = parseInt(header("x-filas"), 10);

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const H = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };

  // Ruta nueva por publicación: el CDN de Storage cachea por URL, así que
  // reusar la misma ruta serviría la versión vieja durante un rato.
  const prev = await fetch(
    `${SUPA_URL}/rest/v1/lenta_rotacion_publicacion?id=eq.1&select=ruta`,
    { headers: H },
  ).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  const ruta = `manual/${Date.now()}.xlsx`;

  const up = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: "POST",
    headers: { ...H, "Content-Type": XLSX_MIME, "cache-control": "max-age=31536000" },
    body: buf,
  });
  if (!up.ok) return json({ error: "no se pudo subir el archivo", status: up.status }, 500);

  const fila = {
    id: 1,
    fecha_dato: fechaDato,
    publicado_en: publicadoEn,
    publicado_por: publicadoPor,
    archivo,
    filas: Number.isFinite(filas) ? filas : null,
    ruta,
  };
  const ins = await fetch(`${SUPA_URL}/rest/v1/lenta_rotacion_publicacion`, {
    method: "POST",
    headers: {
      ...H,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(fila),
  });
  if (!ins.ok) {
    await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${ruta}`, { method: "DELETE", headers: H }).catch(() => {});
    return json({ error: "no se pudo registrar la publicación", status: ins.status }, 500);
  }

  const rutaPrevia = Array.isArray(prev) && prev[0]?.ruta;
  if (rutaPrevia && rutaPrevia !== ruta) {
    await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${rutaPrevia}`, { method: "DELETE", headers: H }).catch(() => {});
  }

  return json({ ok: true, ...fila });
});
