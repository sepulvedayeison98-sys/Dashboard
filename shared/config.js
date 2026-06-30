/* ════════════════════════════════════════════════════════════════════════════
 * config.js — Configuración única de Supabase para todas las apps del CEDI.
 * Reemplaza las copias duplicadas en pipeline / montacargas / admin / simulacion.
 *
 * Uso (script clásico, sin bundler): incluir ANTES del script de la app:
 *   <script src="./shared/config.js"></script>
 * y consumir vía window.CEDI_CONFIG (SUPA_URL, SUPA_KEY, _H, _go).
 *
 * NOTA seguridad: SUPA_KEY es la "publishable key" de Supabase, pensada para uso
 * en cliente. Su seguridad depende de que RLS esté activo (ver supabase/security).
 * ════════════════════════════════════════════════════════════════════════════ */
(function (global) {
  const SUPA_URL = "https://rfysmwpdzlxmadobdvzh.supabase.co";
  const SUPA_KEY = "sb_publishable_LHZWmeFFmnua2j3y8dqqdw_rx0u3vad";
  const _H = {
    apikey: SUPA_KEY,
    Authorization: `Bearer ${SUPA_KEY}`,
    "Content-Type": "application/json",
  };

  // fetch con reintentos (idéntico al patrón _go usado en las 3 apps).
  // No usa _bust(): agregar _cb a la URL rompe PostgREST (filtro de columna).
  const _go = async (url, opts = {}) => {
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(url, { cache: "no-cache", headers: _H, ...opts });
        if (res.ok) {
          const t = await res.text();
          return { data: t ? JSON.parse(t) : null, error: null };
        }
        if ([400, 403, 404, 409].includes(res.status)) {
          const t = await res.text();
          return { data: null, error: { status: res.status, message: t } };
        }
        if (i < 2) await new Promise((ok) => setTimeout(ok, (i + 1) * 2000));
        else {
          const t = await res.text();
          return { data: null, error: { status: res.status, message: t } };
        }
      } catch (err) {
        if (i < 2) await new Promise((ok) => setTimeout(ok, (i + 1) * 2000));
        else return { data: null, error: err };
      }
    }
  };

  global.CEDI_CONFIG = { SUPA_URL, SUPA_KEY, _H, _go };
})(typeof window !== "undefined" ? window : globalThis);
