// Edge Function: envía Web Push a todos los montacarguistas suscritos
// Se dispara via Database Webhook cuando se inserta una fila en `turnos`
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const VAPID_PUBLIC  = "BIkO5rFXvS_7NPyJSWIWyoUhafWswdr0ImaaYV2s8EvHVLiYxkHLQGcWUKOxII5fXlkL9-o4E38oKKy9qwZTspM";
const VAPID_PRIVATE = "yHjfGZk9gw4a2stLfJe-p-ptmcnjCKEOzGMpUR4-gpw";
const VAPID_SUBJECT = "mailto:sepulvedayeison98@gmail.com";

// ─── Crypto helpers para VAPID (sin npm, puro Deno/Web Crypto) ───────────────
const b64u = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const importPrivate = (b64: string) =>
  crypto.subtle.importKey(
    "pkcs8",
    (() => {
      // raw 32-byte scalar → pkcs8 wrapper for P-256
      const raw = Uint8Array.from(atob(b64.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0));
      const pkcs8 = new Uint8Array([
        0x30,0x41,0x02,0x01,0x00,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,
        0x02,0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x04,0x27,
        0x30,0x25,0x02,0x01,0x01,0x04,0x20,...raw
      ]);
      return pkcs8.buffer;
    })(),
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );

const vapidJwt = async (audience: string) => {
  const header = b64u(new TextEncoder().encode(JSON.stringify({typ:"JWT",alg:"ES256"})).buffer);
  const now = Math.floor(Date.now()/1000);
  const payload = b64u(new TextEncoder().encode(JSON.stringify({
    aud: audience, exp: now+3600, sub: VAPID_SUBJECT
  })).buffer);
  const key = await importPrivate(VAPID_PRIVATE);
  const sig = await crypto.subtle.sign(
    { name:"ECDSA", hash:"SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  return `${header}.${payload}.${b64u(sig)}`;
};

const sendPush = async (sub: { endpoint: string; p256dh: string; auth: string }, payload: string) => {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await vapidJwt(audience);

  // Encrypt payload with ECDH + HKDF + AES-GCM (RFC 8291)
  const serverKeys = await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveKey","deriveBits"]);
  const serverPubRaw = await crypto.subtle.exportKey("raw", serverKeys.publicKey);

  const clientPubRaw = Uint8Array.from(atob(sub.p256dh.replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0));
  const authSecret   = Uint8Array.from(atob(sub.auth.replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0));

  const clientPub = await crypto.subtle.importKey("raw", clientPubRaw, {name:"ECDH",namedCurve:"P-256"}, false, []);
  const sharedBits = await crypto.subtle.deriveBits({name:"ECDH",public:clientPub}, serverKeys.privateKey, 256);

  const hkdf = async (salt: Uint8Array, ikm: ArrayBuffer, info: Uint8Array, len: number) => {
    const k = await crypto.subtle.importKey("raw", ikm, {name:"HKDF"}, false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({name:"HKDF",hash:"SHA-256",salt,info}, k, len*8));
  };

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const serverPubU8 = new Uint8Array(serverPubRaw);

  const prk = await hkdf(authSecret, sharedBits,
    new TextEncoder().encode(`WebPush: info\x00`+String.fromCharCode(...clientPubRaw)+String.fromCharCode(...serverPubU8)), 32);

  const cek = await hkdf(salt, prk, new TextEncoder().encode("Content-Encoding: aes128gcm\x00"), 16);
  const nonce = await hkdf(salt, prk, new TextEncoder().encode("Content-Encoding: nonce\x00"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, {name:"AES-GCM"}, false, ["encrypt"]);
  const msg = new TextEncoder().encode(payload);
  const padded = new Uint8Array(msg.length + 1);
  padded.set(msg); padded[msg.length] = 0x02; // padding delimiter
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:nonce}, aesKey, padded));

  // Build RFC 8188 record
  const header = new Uint8Array(21 + serverPubU8.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false); // rs = 4096
  header[20] = serverPubU8.length;
  header.set(serverPubU8, 21);
  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header); body.set(ciphertext, header.length);

  return fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
    },
    body
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin":"*" } });

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let turno: Record<string, unknown> = {};
  try { const body = await req.json(); turno = body.record ?? body; } catch(_) {}

  // Fetch all push subscriptions
  const res = await fetch(`${SUPA_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
  });
  if (!res.ok) return new Response("error fetching subs", { status: 500 });
  const subs: Array<{ endpoint: string; p256dh: string; auth: string }> = await res.json();

  if (!subs.length) return new Response("no subs", { status: 200 });

  const urgente = turno.es_mde || turno.prioridad === "urgente";
  const payload = JSON.stringify({
    title: `${urgente ? "🚨" : "🏗️"} Nuevo turno · ${turno.picking ?? ""}`,
    body:  `${turno.cliente ?? ""}${turno.ciudad ? ` · ${turno.ciudad}` : ""}${urgente ? " · URGENTE" : ""}`
  });

  const results = await Promise.allSettled(subs.map(s => sendPush(s, payload)));

  // Remove expired/invalid subscriptions (410 Gone)
  const dead = subs.filter((_, i) => {
    const r = results[i];
    return r.status === "fulfilled" && (r.value as Response).status === 410;
  });
  if (dead.length) {
    await fetch(`${SUPA_URL}/rest/v1/push_subscriptions?endpoint=in.(${dead.map(d=>encodeURIComponent(d.endpoint)).join(",")})`, {
      method: "DELETE",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Prefer:"return=minimal" }
    });
  }

  return new Response(JSON.stringify({ sent: subs.length - dead.length }), {
    headers: { "Content-Type": "application/json" }
  });
});
