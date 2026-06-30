/* ════════════════════════════════════════════════════════════════════════════
 * theme.js — Paletas de color de las apps del CEDI, centralizadas.
 * Cada app conserva su identidad (CEDI azul/teal, Picking índigo, Montacargas
 * púrpura). Extraído fiel al código vigente; al cablear, NO cambia el aspecto.
 *
 * Uso: <script src="./shared/theme.js"></script>
 *   const C = window.CEDI_THEME.picking;   // según la app
 * ════════════════════════════════════════════════════════════════════════════ */
(function (global) {
  // CEDI Live (index.html)
  const cedi = {
    bg0: "#040c17", bg1: "#070f1c", bg2: "#0b1628", bg3: "#0f1e35",
    b0: "#152236", b1: "#1c3050",
    t1: "#eef2ff", t2: "#9db3cd", t3: "#8095b2", t4: "#637691",
    accent: "#38bdf8", accentDim: "#38bdf820",
    green: "#10b981", greenDim: "#10b98118",
    yellow: "#f59e0b", yellowDim: "#f59e0b18",
    orange: "#f97316", orangeDim: "#f9731618",
    red: "#ef4444", redDim: "#ef444418",
    purple: "#a78bfa", purpleDim: "#a78bfa18",
    teal: "#2dd4bf", tealDim: "#2dd4bf18",
  };

  // Picking (pipeline.html)
  const picking = {
    bg0: "#05080f", bg1: "#080d19", bg2: "#0c1220", bg3: "#111a2c",
    b0: "#182236", b1: "#1f2d45",
    t1: "#dde6f8", t2: "#6f84a8", t3: "#3f5270", t4: "#283548",
    teal: "#38bdf8", accent: "#818cf8",
    green: "#34d399", greenDim: "#34d39914",
    yellow: "#fbbf24", yellowDim: "#fbbf2414",
    tealDim: "#38bdf814", accentDim: "#818cf814",
    orange: "#fb923c", orangeDim: "#fb923c14",
    red: "#fb7185", redDim: "#fb718514",
    purple: "#c084fc", purpleDim: "#c084fc14",
  };

  // Montacargas (montacargas.html) y Admin (admin.html) comparten paleta
  const montacargas = {
    bg0: "#070b14", bg1: "#0d1320", bg2: "#131b2e", bg3: "#1a2438",
    b0: "#1f2b42", b1: "#2a3854",
    t1: "#e8edf5", t2: "#a8b5cc", t3: "#6b7a96", t4: "#46546e",
    teal: "#2dd4bf", accent: "#3b82f6", green: "#22c55e", yellow: "#eab308",
    orange: "#f97316", red: "#ef4444", purple: "#a855f7",
  };

  global.CEDI_THEME = { cedi, picking, montacargas, admin: montacargas };
})(typeof window !== "undefined" ? window : globalThis);
