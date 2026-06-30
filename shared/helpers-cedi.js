/* ════════════════════════════════════════════════════════════════════════════
 * helpers-cedi.js — Fuente ÚNICA de la lógica de negocio del CEDI.
 * Reemplaza las copias duplicadas (2-3×) en index / pipeline / montacargas.
 *
 * Por qué existe: familia, calles, cobertura y clasificación estaban triplicadas;
 * cada regla (tope 27u, regla 501 SOLID/501_SP_S) había que cambiarla en varios
 * archivos y un olvido producía comportamientos divergentes entre apps.
 * A partir de aquí: una regla = un solo lugar.
 *
 * Uso (script clásico): <script src="./shared/helpers-cedi.js"></script>
 * y consumir vía window.CEDI.<funcion>.
 *
 * ⚠ Extraído fielmente del código vigente al 30-Jun-2026. El cableado a las apps
 *   se hace de noche (con prueba de humo), no durante operación.
 * ════════════════════════════════════════════════════════════════════════════ */
(function (global) {
  // ── Constantes de layout físico ────────────────────────────────────────────
  const CAJA = 9; // unidades por caja
  const CALLE_MAP = { B: "C1", C: "C2", D: "C3", E: "C4" };        // letra → clave dashboard
  const CALLE_NOM = { B: "Calle 1", C: "Calle 2", D: "Calle 3", E: "Calle 4" }; // letra → nombre
  const CALLE_ORD = { B: 1, C: 2, D: 3, E: 4 };                    // orden de recorrido

  // ── Parsers numéricos / texto ───────────────────────────────────────────────
  const toNum = (v) => {
    const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? 0 : n;
  };
  const tieneNota = (n) => String(n || "").trim().length > 0;

  // ── Inventario / SKU ────────────────────────────────────────────────────────
  const marcaDe = (desc) => {
    const p = String(desc || "").trim().split(/\s+/);
    return p.length >= 3 ? p[2].toUpperCase() : "";
  };
  const esEXPO = (d) => (d || "").toUpperCase().includes("EXPO");
  const familia = (d) => {
    const u = (d || "").toUpperCase();
    if (/\bT[- ]?10\b/.test(u)) return "T-10";
    const m = u.match(/ICH[- ]?([0-9]{2,4})/);
    return m ? m[1] : "OTRO";
  };

  // Regla CEDI: 501 SOLID y 501_SP_S viven en la Calle 2 (C), aunque el WMS los
  // registre en otra calle. Evita que aparezcan como reposición en la Calle 3.
  const esCalle2 = (desc) => {
    const u = (desc || "").toUpperCase();
    return (familia(u) === "501" && u.includes("SOLID")) || u.includes("501_SP_S");
  };

  // ── Ubicación WMS (ej. "D1041") ─────────────────────────────────────────────
  const parseUbi = (u) => {
    const m = /^([B-E])0?(\d{1,2})(\d)(\d)$/.exec(String(u).trim());
    if (!m) return null;
    return {
      calleKey: CALLE_MAP[m[1]],
      calleLetra: m[1],
      modulo: parseInt(m[2]),
      nivel: parseInt(m[3]),
      pos: parseInt(m[4]),
    };
  };

  // ── Ciudad ──────────────────────────────────────────────────────────────────
  const esMDE = (ciudad) => {
    const x = String(ciudad || "").toUpperCase().trim();
    return x === "MDE" || x.includes("MEDELL") || x === "ITAGUI" || x === "ITAGÜI" || x.includes("ITAGU");
  };

  // ── Cobertura piso/altura por línea de pedido (SIN tope de piso) ─────────────
  // Si el piso tiene saldo suficiente, cubre completo y NO genera viaje.
  // Devuelve flags y unidades para clasificar el pedido.
  const coberturaLinea = (stockPiso, stockAlt, cant) => {
    const cubPiso = Math.min(stockPiso, cant);     // piso cubre con su saldo real
    const restoTrasPiso = cant - cubPiso;
    const cubAlt = Math.min(stockAlt, restoTrasPiso);
    return {
      stockPiso, stockAlt, cubPiso, cubAlt, restoTrasPiso,
      hasPiso: cubPiso >= cant,                     // piso cubre TODO lo requerido
      hasPisoParcial: cubPiso > 0,
      hasAlt: stockAlt > 0,
      sinStock: stockPiso === 0 && stockAlt === 0,
    };
  };

  // Clasificación de despacho a partir de la cobertura agregada del pedido.
  const clasificar = (pctPiso, uniAlt) => {
    if (pctPiso === 100) return "despachable"; // piso cubre el 100%
    if (pctPiso >= 40) return "parcial";        // piso cubre parcialmente
    if (uniAlt > 0) return "reabasto";          // necesita bajar de altura
    return "ruptura";
  };

  // Filtro de calle por FAMILIA (layout lógico del CEDI en Reposición):
  //   C1: 3110/102/405 · C2: 501-SP + 503 · C3: 501 general (sin SOLID/SP_S) · C4: 321/3130
  // Centraliza la lógica que estaba duplicada en index.html (filtro C1–C4).
  const calleFamiliaMatch = (calle, desc) => {
    const f = familia(desc);
    const d = (desc || "").toUpperCase();
    if (calle === "C1") return ["3110", "102", "405"].includes(f);
    if (calle === "C2") return (f === "501" && /SP/.test(d)) || f === "503";
    if (calle === "C3") return f === "501" && !esCalle2(desc); // SOLID/SP_S excluidos → solo C2
    if (calle === "C4") return ["321", "3130"].includes(f);
    return true;
  };

  global.CEDI = {
    CAJA, CALLE_MAP, CALLE_NOM, CALLE_ORD,
    toNum, tieneNota, marcaDe, esEXPO, familia, esCalle2,
    parseUbi, esMDE, coberturaLinea, clasificar, calleFamiliaMatch,
  };
})(typeof window !== "undefined" ? window : globalThis);
