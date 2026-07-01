/* PRECOMPILADO desde montacargas.html — NO editar a mano. Regenerar: node scripts/precompile.js */
const {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo
} = React;
const C = {
  bg0: "#070b14",
  bg1: "#0d1320",
  bg2: "#131b2e",
  bg3: "#1a2438",
  b0: "#1f2b42",
  b1: "#2a3854",
  t1: "#e8edf5",
  t2: "#a8b5cc",
  t3: "#6b7a96",
  t4: "#46546e",
  teal: "#2dd4bf",
  accent: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  purple: "#a855f7"
};
const SUPA_URL = "https://rfysmwpdzlxmadobdvzh.supabase.co";
const SUPA_KEY = "sb_publishable_LHZWmeFFmnua2j3y8dqqdw_rx0u3vad";
const _H = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  "Content-Type": "application/json"
};
const _go = async (url, opts = {}) => {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        cache: 'no-cache',
        headers: _H,
        ...opts
      });
      if (res.ok) {
        const t = await res.text();
        return {
          data: t ? JSON.parse(t) : null,
          error: null
        };
      }
      if ([400, 403, 404, 409].includes(res.status)) {
        const t = await res.text();
        return {
          data: null,
          error: {
            status: res.status,
            message: t
          }
        };
      }
      if (i < 2) await new Promise(ok => setTimeout(ok, (i + 1) * 2000));else {
        const t = await res.text();
        return {
          data: null,
          error: {
            status: res.status,
            message: t
          }
        };
      }
    } catch (err) {
      if (i < 2) await new Promise(ok => setTimeout(ok, (i + 1) * 2000));else return {
        data: null,
        error: err
      };
    }
  }
};
const sb = {
  from: table => {
    const base = `${SUPA_URL}/rest/v1/${table}`;
    return {
      insert: body => _go(base, {
        method: "POST",
        headers: {
          ..._H,
          Prefer: "return=minimal"
        },
        body: JSON.stringify(body)
      }),
      update: body => ({
        eq: (col, val) => _go(`${base}?${col}=eq.${encodeURIComponent(val)}`, {
          method: "PATCH",
          headers: {
            ..._H,
            Prefer: "return=minimal"
          },
          body: JSON.stringify(body)
        })
      })
    };
  }
};
const fetchTurnos = () => _go(`${SUPA_URL}/rest/v1/turnos?order=fecha_solicitud.asc`, {
  headers: _H
});
const CALLE_NOM = {
  B: "Calle 1",
  C: "Calle 2",
  D: "Calle 3",
  E: "Calle 4"
};
const CALLE_ORD = {
  B: 1,
  C: 2,
  D: 3,
  E: 4
};
const esMDE = c => {
  const x = String(c || "").toUpperCase().trim();
  return x === "MDE" || x.includes("MEDELL") || x === "ITAGUI" || x === "ITAGÜI" || x.includes("ITAGU");
};
const fmtHora = ts => {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit"
  });
};
const ordenarPos = arr => [...(arr || [])].sort((a, b) => (CALLE_ORD[a.calleLetra] || 9) - (CALLE_ORD[b.calleLetra] || 9) || (a.modulo || 0) - (b.modulo || 0));
const esCalle2Sku = d => {
  const u = (d || "").toUpperCase();
  const m = u.match(/ICH[- ]?([0-9]{2,4})/);
  const fam = /\bT[- ]?10\b/.test(u) ? "T-10" : m ? m[1] : "OTRO";
  return fam === "501" && u.includes("SOLID") || u.includes("501_SP_S");
};
const normalizarCalles = arr => (arr || []).map(t => ({
  ...t,
  posiciones: (t.posiciones || []).map(p => (p.skus || []).some(s => esCalle2Sku(s.desc)) ? {
    ...p,
    calleLetra: "C"
  } : p)
}));
const familiasDePos = skus => [...new Set((skus || []).map(s => (s.desc || "").match(/[A-Z]{2,5}-(\w+)/i)?.[1] || "").filter(Boolean))];
const tipoDeSkus = skus => [...new Set((skus || []).map(s => s.tipo || (s.desc || "").split(" ")[1] || "").filter(Boolean))];
const beep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch (e) {}
};
const VAPID_PUB = "BIkO5rFXvS_7NPyJSWIWyoUhafWswdr0ImaaYV2s8EvHVLiYxkHLQGcWUKOxII5fXlkL9-o4E38oKKy9qwZTspM";
const _b64ToUint8 = b64 => {
  const raw = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};
const mostrarNotif = (titulo, cuerpo) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(titulo, {
      body: cuerpo,
      icon: "./icon-montacargas.svg",
      badge: "./icon-montacargas.svg",
      requireInteraction: false
    });
  } catch (e) {}
};
const suscribirPush = async setPushOk => {
  try {
    if (!("PushManager" in window)) {
      setPushOk && setPushOk(false);
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _b64ToUint8(VAPID_PUB)
      });
    }
    const j = sub.toJSON();
    const {
      error
    } = await _go(`${SUPA_URL}/rest/v1/push_subscriptions`, {
      method: "POST",
      headers: {
        ..._H,
        Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        endpoint: j.endpoint,
        p256dh: j.keys.p256dh,
        auth: j.keys.auth,
        rol: "montacarguista"
      })
    });
    if (error) {
      console.warn("push sub save:", error);
      setPushOk && setPushOk(false);
      return false;
    }
    setPushOk && setPushOk(true);
    return true;
  } catch (e) {
    console.warn("push sub:", e);
    setPushOk && setPushOk(false);
    return false;
  }
};
const pedirPermiso = async setPushOk => {
  if (!("Notification" in window)) {
    alert('En iPhone: toca el botón compartir (⬆) en Safari → "Añadir a inicio". La app instalada en inicio sí puede recibir notificaciones del sistema.');
    return;
  }
  if (Notification.permission === "denied") {
    alert("Notificaciones bloqueadas. Ve a Ajustes → Notificaciones → Safari (o la app) para habilitarlas.");
    return;
  }
  if (Notification.permission === "granted") {
    await suscribirPush(setPushOk);
    return;
  }
  const p = await Notification.requestPermission();
  if (p === "granted") await suscribirPush(setPushOk);else setPushOk && setPushOk(false);
};
function LoginForm({
  onLogin
}) {
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const submit = async () => {
    const n = nombre.trim();
    if (!n || cargando) return;
    setCargando(true);
    await onLogin(n);
  };
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      padding: 24,
      background: C.bg0
    }
  }, React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 360
    }
  }, React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 28
    }
  }, React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: 16,
      background: "linear-gradient(135deg,#a855f7,#3b82f6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 28,
      margin: "0 auto 14px"
    }
  }, "🏗️"), React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 22,
      letterSpacing: 0.5,
      color: C.t1
    }
  }, "MONTACARGAS"), React.createElement("div", {
    style: {
      color: C.t3,
      fontSize: 12,
      marginTop: 4
    }
  }, "INDUCASOS · CEDI ITAGUÍ")), React.createElement("div", {
    style: {
      background: C.bg2,
      borderRadius: 16,
      padding: 24,
      border: `1px solid ${C.b0}`
    }
  }, React.createElement("div", {
    style: {
      color: C.t2,
      fontSize: 13,
      fontWeight: 700,
      marginBottom: 14
    }
  }, "¿Cómo te llamas?"), React.createElement("input", {
    value: nombre,
    onChange: e => setNombre(e.target.value),
    onKeyDown: e => e.key === "Enter" && submit(),
    placeholder: "Tu nombre...",
    autoFocus: true,
    style: {
      width: "100%",
      background: C.bg3,
      border: `1px solid ${C.b1}`,
      borderRadius: 10,
      padding: "12px 14px",
      fontSize: 15,
      color: C.t1,
      outline: "none",
      marginBottom: 14
    }
  }), React.createElement("button", {
    onClick: submit,
    disabled: !nombre.trim() || cargando,
    style: {
      width: "100%",
      padding: "13px",
      background: nombre.trim() ? `linear-gradient(135deg,#a855f7,#3b82f6)` : C.bg3,
      border: "none",
      borderRadius: 10,
      color: nombre.trim() ? C.bg0 : C.t4,
      fontWeight: 800,
      fontSize: 14,
      cursor: nombre.trim() ? "pointer" : "not-allowed",
      transition: "all .2s"
    }
  }, cargando ? "Conectando..." : "Ver cola de turnos →"))));
}
function MontacargasApp() {
  const [operario, setOperario] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [tab, setTab] = useState("pendiente");
  const [busquedaSku, setBusquedaSku] = useState("");
  const [expandido, setExpandido] = useState({});
  const [procesando, setProcesando] = useState({});
  const [ultimaAct, setUltimaAct] = useState(null);
  const [alertaCancelacion, setAlertaCancelacion] = useState([]);
  const [reportando, setReportando] = useState({});
  const [reportandoPos, setReportandoPos] = useState({});
  const [toasts, setToasts] = useState([]);
  const [pushOk, setPushOk] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const timerRef = useRef(null);
  const prevPendRef = useRef(0);
  const misEnProcesoRef = useRef(new Set());
  const refrescar = useCallback(async () => {
    const {
      data: rawData,
      error
    } = await fetchTurnos();
    if (!rawData) {
      console.error("[montacargas] fetchTurnos falló:", error);
      return;
    }
    const data = normalizarCalles(rawData);
    const nPend = data.filter(t => t.estado === "pendiente").length;
    if (nPend > prevPendRef.current && prevPendRef.current >= 0) {
      beep();
      try {
        navigator.vibrate && navigator.vibrate([200, 100, 200]);
      } catch (e) {}
      document.title = `(${nPend}) MONTACARGAS · nuevo turno`;
      const prevIds = new Set(turnos.filter(t => t.estado === "pendiente").map(t => t.id));
      const nuevos = data.filter(t => t.estado === "pendiente" && !prevIds.has(t.id));
      if (nuevos.length === 1) {
        const t = nuevos[0];
        const urgente = t.es_mde || t.prioridad === "urgente";
        mostrarNotif(`${urgente ? "🚨" : "🏗️"} Turno nuevo · ${t.picking}`, `${t.cliente || ""}${t.ciudad ? ` · ${t.ciudad}` : ""}${urgente ? " · URGENTE" : ""}`);
      } else if (nuevos.length > 1) {
        mostrarNotif(`🏗️ ${nuevos.length} turnos nuevos`, nuevos.map(t => t.picking).join(" · "));
      }
      if (nuevos.length > 0) {
        setToasts(prev => [...prev, ...nuevos.map(t => ({
          id: t.id,
          picking: t.picking,
          cliente: t.cliente || "",
          ciudad: t.ciudad || "",
          urgente: !!(t.es_mde || t.prioridad === "urgente")
        }))]);
        const t0 = nuevos[0];
        fetch(`${SUPA_URL}/functions/v1/hyper-task`, {
          method: "POST",
          headers: {
            ..._H,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            record: {
              picking: t0.picking,
              cliente: t0.cliente,
              ciudad: t0.ciudad,
              es_mde: t0.es_mde,
              prioridad: t0.prioridad
            }
          })
        }).catch(() => {});
      }
    } else {
      document.title = "INDUCASOS · Montacargas";
    }
    prevPendRef.current = nPend;
    if (operario) {
      const misActualesIds = new Set(data.filter(t => t.montacarguista === operario && t.estado === "en_proceso").map(t => t.id));
      const cancelados = [];
      misEnProcesoRef.current.forEach(id => {
        const t = data.find(x => x.id === id);
        if (!t || t.estado !== "en_proceso" && t.montacarguista !== operario) {
          const ant = turnos.find(x => x.id === id);
          if (ant) cancelados.push(ant.picking || id);
        }
      });
      if (cancelados.length > 0) setAlertaCancelacion(c => [...c, ...cancelados]);
      misEnProcesoRef.current = misActualesIds;
    }
    setTurnos(data);
    setUltimaAct(new Date());
  }, [operario, turnos]);
  useEffect(() => {
    if (!operario) return;
    prevPendRef.current = -1;
    refrescar();
    timerRef.current = setInterval(refrescar, 15000);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      suscribirPush(setPushOk);
    } else {
      setPushOk(typeof Notification === "undefined" || !("PushManager" in window) ? false : null);
    }
    return () => clearInterval(timerRef.current);
  }, [operario]);
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts(p => p.slice(1)), 7000);
    return () => clearTimeout(t);
  }, [toasts.length]);
  const tomarTurno = async id => {
    setProcesando(p => ({
      ...p,
      [id]: true
    }));
    await sb.from("turnos").update({
      estado: "en_proceso",
      montacarguista: operario
    }).eq("id", id);
    await refrescar();
    setProcesando(p => ({
      ...p,
      [id]: false
    }));
  };
  const tomarGrupo = async (ids, gKey) => {
    setProcesando(p => ({
      ...p,
      [gKey]: true
    }));
    await Promise.all(ids.map(id => sb.from("turnos").update({
      estado: "en_proceso",
      montacarguista: operario
    }).eq("id", id)));
    await refrescar();
    setProcesando(p => ({
      ...p,
      [gKey]: false
    }));
  };
  const completarTurno = async id => {
    setProcesando(p => ({
      ...p,
      [id]: true
    }));
    const turno = turnos.find(t => t.id === id);
    const ts = new Date().toISOString();
    if (turno) {
      const nuevasPos = turno.posiciones.map(p => p.bajada ? p : {
        ...p,
        bajada: true,
        bajada_ts: ts
      });
      await sb.from("turnos").update({
        posiciones: nuevasPos,
        estado: "completado",
        montacarguista: operario,
        fecha_completado: ts
      }).eq("id", id);
    } else {
      await sb.from("turnos").update({
        estado: "completado",
        montacarguista: operario,
        fecha_completado: ts
      }).eq("id", id);
    }
    await refrescar();
    setProcesando(p => ({
      ...p,
      [id]: false
    }));
  };
  const marcarBajada = async (turnoId, posIdx) => {
    const turno = turnos.find(t => t.id === turnoId);
    if (!turno) return;
    const key = `${turnoId}-pos-${posIdx}`;
    setProcesando(p => ({
      ...p,
      [key]: true
    }));
    const ts = new Date().toISOString();
    const nuevasPos = turno.posiciones.map((p, i) => i === posIdx ? {
      ...p,
      bajada: true,
      bajada_ts: ts
    } : p);
    const {
      error: e1
    } = await sb.from("turnos").update({
      posiciones: nuevasPos
    }).eq("id", turnoId);
    if (!e1 && nuevasPos.every(p => p.bajada)) {
      await sb.from("turnos").update({
        estado: "completado",
        montacarguista: operario,
        fecha_completado: new Date().toISOString()
      }).eq("id", turnoId);
    }
    await refrescar();
    setProcesando(p => ({
      ...p,
      [key]: false
    }));
  };
  const reportarFallo = async (id, motivo) => {
    setProcesando(p => ({
      ...p,
      [id]: true
    }));
    await sb.from("turnos").update({
      estado: "fallido",
      motivo_fallo: motivo,
      fecha_completado: new Date().toISOString()
    }).eq("id", id);
    await refrescar();
    setProcesando(p => ({
      ...p,
      [id]: false
    }));
    setReportando(r => ({
      ...r,
      [id]: false
    }));
  };
  const marcarFalloPosicion = async (turnoId, posIdx, motivo) => {
    const turno = turnos.find(t => t.id === turnoId);
    if (!turno) return;
    const key = `${turnoId}-pos-${posIdx}`;
    setProcesando(p => ({
      ...p,
      [key]: true
    }));
    const ts = new Date().toISOString();
    const nuevasPos = turno.posiciones.map((p, i) => i === posIdx ? {
      ...p,
      fallo: true,
      motivo_fallo: motivo,
      fallo_ts: ts
    } : p);
    const {
      error: e1
    } = await sb.from("turnos").update({
      posiciones: nuevasPos
    }).eq("id", turnoId);
    if (!e1 && nuevasPos.every(p => p.bajada || p.fallo)) {
      await sb.from("turnos").update({
        estado: "completado",
        montacarguista: operario,
        fecha_completado: new Date().toISOString()
      }).eq("id", turnoId);
    }
    await refrescar();
    setProcesando(p => ({
      ...p,
      [key]: false
    }));
    setReportandoPos(r => ({
      ...r,
      [key]: false
    }));
  };
  const marcarRutaUBI = async ubiEntry => {
    const pendientes = ubiEntry.posiciones.filter(p => !p.bajada && !p.fallo);
    if (!pendientes.length) return;
    const key = `ruta-${ubiEntry.ubi}`;
    setProcesando(p => ({
      ...p,
      [key]: true
    }));
    const ts = new Date().toISOString();
    const byTurno = {};
    pendientes.forEach(p => {
      if (!byTurno[p.turnoId]) byTurno[p.turnoId] = [];
      byTurno[p.turnoId].push(p.posIdx);
    });
    for (const [turnoId, idxs] of Object.entries(byTurno)) {
      const turno = turnos.find(t => t.id === turnoId);
      if (!turno) continue;
      const nuevasPos = turno.posiciones.map((p, i) => idxs.includes(i) ? {
        ...p,
        bajada: true,
        bajada_ts: ts
      } : p);
      const {
        error: e1
      } = await sb.from("turnos").update({
        posiciones: nuevasPos
      }).eq("id", turnoId);
      if (!e1 && nuevasPos.every(p => p.bajada || p.fallo)) {
        await sb.from("turnos").update({
          estado: "completado",
          montacarguista: operario,
          fecha_completado: ts
        }).eq("id", turnoId);
      }
    }
    await refrescar();
    setProcesando(p => ({
      ...p,
      [key]: false
    }));
  };
  const limpiarCompletados = async () => {
    if (!window.confirm("¿Eliminar todos los turnos completados y fallidos?\nNo se puede deshacer.")) return;
    const {
      data: doneT
    } = await _go(`${SUPA_URL}/rest/v1/turnos?estado=in.(completado,fallido)&select=id,picking`, {
      headers: _H
    });
    if (!doneT?.length) return;
    await _go(`${SUPA_URL}/rest/v1/turnos?estado=in.(completado,fallido)`, {
      method: "DELETE",
      headers: {
        ..._H,
        Prefer: "return=minimal"
      }
    });
    const picklist = doneT.map(t => t.picking).join(",");
    if (picklist) await _go(`${SUPA_URL}/rest/v1/asignaciones?picking=in.(${picklist})`, {
      method: "DELETE",
      headers: {
        ..._H,
        Prefer: "return=minimal"
      }
    });
    await refrescar();
  };
  const porEstado = est => turnos.filter(t => t.estado === est).sort((a, b) => {
    const au = a.es_mde ? 1 : 0,
      bu = b.es_mde ? 1 : 0;
    if (au !== bu) return bu - au;
    const pa = ordenarPos(a.posiciones || [])[0] || {};
    const pb = ordenarPos(b.posiciones || [])[0] || {};
    return (CALLE_ORD[pa.calleLetra] || 9) - (CALLE_ORD[pb.calleLetra] || 9) || (pa.modulo || 0) - (pb.modulo || 0) || (pa.nivel || 0) - (pb.nivel || 0) || new Date(a.fecha_solicitud) - new Date(b.fecha_solicitud);
  });
  const misTurnosActivos = useMemo(() => turnos.filter(t => t.estado === "en_proceso" && t.montacarguista === operario), [turnos, operario]);
  const agrupadoPorUBI = useMemo(() => {
    const enActivo = misTurnosActivos.length > 0;
    const fuente = enActivo ? misTurnosActivos : turnos.filter(t => t.estado === "pendiente").sort((a, b) => (a.es_mde ? 0 : 1) - (b.es_mde ? 0 : 1));
    const map = {};
    fuente.forEach(t => {
      (t.posiciones || []).forEach((pos, i) => {
        if (!map[pos.ubi]) map[pos.ubi] = {
          ubi: pos.ubi,
          calleLetra: pos.calleLetra,
          modulo: pos.modulo,
          nivel: pos.nivel,
          posiciones: []
        };
        map[pos.ubi].posiciones.push({
          turnoId: t.id,
          posIdx: i,
          picking: t.picking,
          cliente: t.cliente,
          operario: t.operario_solicitante || "",
          urgente: t.es_mde || t.prioridad === "urgente",
          skus: pos.skus || [],
          totalSaldo: pos.totalSaldo,
          bajada: pos.bajada || false,
          fallo: pos.fallo || false
        });
      });
    });
    if (enActivo) {
      return Object.values(map).sort((a, b) => {
        const aDone = a.posiciones.every(p => p.bajada || p.fallo);
        const bDone = b.posiciones.every(p => p.bajada || p.fallo);
        if (aDone !== bDone) return aDone ? 1 : -1;
        return (CALLE_ORD[a.calleLetra] || 9) - (CALLE_ORD[b.calleLetra] || 9) || (a.modulo || 0) - (b.modulo || 0) || (a.nivel || 0) - (b.nivel || 0);
      });
    }
    return Object.values(map).sort((a, b) => b.posiciones.length - a.posiciones.length || (CALLE_ORD[a.calleLetra] || 9) - (CALLE_ORD[b.calleLetra] || 9) || (a.modulo || 0) - (b.modulo || 0));
  }, [turnos, operario, misTurnosActivos]);
  const demandaMap = useMemo(() => {
    const m = {};
    turnos.filter(t => t.estado === "pendiente").forEach(t => {
      (t.posiciones || []).forEach(p => {
        m[p.ubi] = (m[p.ubi] || 0) + 1;
      });
    });
    return m;
  }, [turnos]);
  const skuResultados = useMemo(() => {
    const q = busquedaSku.trim().toUpperCase();
    if (!q) return [];
    const hits = {};
    turnos.filter(t => t.estado === "pendiente" || t.estado === "en_proceso").forEach(t => {
      (t.posiciones || []).forEach(pos => {
        (pos.skus || []).forEach(s => {
          if ((s.ref || "").toUpperCase().includes(q) || (s.desc || "").toUpperCase().includes(q)) {
            const k = s.ref || s.desc || "?";
            if (!hits[k]) hits[k] = {ref: s.ref || k, desc: s.desc || "", items: []};
            hits[k].items.push({
              ubi: pos.ubi,
              calleLetra: pos.calleLetra,
              modulo: pos.modulo,
              nivel: pos.nivel,
              cant: s.cant || 0,
              picking: t.picking,
              operario: t.operario_solicitante || "—",
              estado: t.estado,
              bajada: pos.bajada || false,
              fallo: pos.fallo || false
            });
          }
        });
      });
    });
    return Object.values(hits).sort((a, b) => a.ref.localeCompare(b.ref));
  }, [turnos, busquedaSku]);
  if (!operario) return React.createElement(LoginForm, {
    onLogin: async nombre => {
      pedirPermiso(setPushOk);
      setOperario(nombre);
      try {
        await _go(`${SUPA_URL}/rest/v1/usuarios?nombre=eq.${encodeURIComponent(nombre)}&rol=eq.montacarguista`, {
          method: "DELETE",
          headers: {
            ..._H,
            Prefer: "return=minimal"
          }
        });
        await sb.from("usuarios").insert({
          nombre,
          rol: "montacarguista",
          activo: true,
          fecha_login: new Date().toISOString()
        });
      } catch (e) {}
    }
  });
  const nPend = porEstado("pendiente").length;
  const nProc = porEstado("en_proceso").length;
  const nRuta = misTurnosActivos.length > 0 ? agrupadoPorUBI.filter(u => !u.posiciones.every(p => p.bajada || p.fallo)).length : agrupadoPorUBI.length;
  const listaRaw = tab === "agrupado" ? [] : tab === "completado" ? porEstado(tab).sort((a, b) => new Date(b.fecha_completado || 0) - new Date(a.fecha_completado || 0)) : porEstado(tab);
  const unaHoraAtras = Date.now() - 3600000;
  const lista = tab === "completado" && !verTodos ? listaRaw.filter(t => !t.fecha_completado || new Date(t.fecha_completado).getTime() > unaHoraAtras) : listaRaw;
  const nOcultos = tab === "completado" && !verTodos ? listaRaw.length - lista.length : 0;
  const listaItems = (() => {
    if (tab !== "pendiente") return lista.map((t, i) => ({
      type: "turno",
      t,
      numLabel: i + 1
    }));
    const grupos = {};
    lista.forEach(t => {
      const k = t.operario_solicitante || "—";
      if (!grupos[k]) grupos[k] = [];
      grupos[k].push(t);
    });
    const keys = Object.keys(grupos);
    const necesitaHeader = keys.some(k => grupos[k].length > 1);
    if (!necesitaHeader) return lista.map((t, i) => ({
      type: "turno",
      t,
      numLabel: i + 1
    }));
    return keys.flatMap(k => [{
      type: "header",
      operario: k,
      count: grupos[k].length,
      ids: grupos[k].map(t => t.id)
    }, ...grupos[k].map((t, gi) => ({
      type: "turno",
      t,
      numLabel: gi + 1
    }))]);
  })();
  return React.createElement("div", {
    style: {
      minHeight: "100vh",
      paddingBottom: 24
    }
  }, toasts.length > 0 && React.createElement("div", {
    style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      animation: "slideDown .35s ease"
    }
  }, React.createElement("div", {
    style: {
      background: toasts[0].urgente ? `linear-gradient(135deg,${C.red},${C.orange})` : `linear-gradient(135deg,${C.purple},${C.accent})`,
      padding: "14px 16px",
      boxShadow: "0 4px 20px #00000060"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, React.createElement("span", {
    style: {
      fontSize: 22,
      flexShrink: 0
    }
  }, toasts[0].urgente ? "🚨" : "🏗️"), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      color: "#fff",
      fontWeight: 800,
      fontSize: 15
    }
  }, toasts.length > 1 ? `${toasts.length} turnos nuevos` : `Nuevo turno · ${toasts[0].picking}`), React.createElement("div", {
    style: {
      color: "rgba(255,255,255,.75)",
      fontSize: 12,
      marginTop: 2,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, toasts.length > 1 ? toasts.map(t => t.picking).join(" · ") : `${toasts[0].cliente}${toasts[0].ciudad ? ` · ${toasts[0].ciudad}` : ""}`)), React.createElement("button", {
    onClick: () => setToasts([]),
    style: {
      background: "rgba(255,255,255,.2)",
      border: "none",
      color: "#fff",
      borderRadius: 7,
      width: 30,
      height: 30,
      fontSize: 16,
      cursor: "pointer",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, "✕")))), React.createElement("div", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 10,
      background: C.bg1,
      borderBottom: `1px solid ${C.b0}`,
      padding: "12px 14px"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 10
    }
  }, React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 9,
      background: "linear-gradient(135deg,#a855f7,#3b82f6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18
    }
  }, "🏗️"), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 15
    }
  }, "MONTACARGAS"), React.createElement("div", {
    style: {
      color: C.t3,
      fontSize: 10
    }
  }, "CEDI ITAGUÍ · ", operario, ultimaAct ? ` · act. ${fmtHora(ultimaAct)}` : "")), React.createElement("button", {
    onClick: refrescar,
    style: {
      background: C.bg3,
      border: `1px solid ${C.b0}`,
      color: C.t3,
      borderRadius: 8,
      padding: "7px 11px",
      fontSize: 13,
      cursor: "pointer"
    }
  }, "↻"), (() => {
    const denied = typeof Notification !== "undefined" && Notification.permission === "denied";
    const noSoporta = !("Notification" in window) || !("PushManager" in window);
    const col = pushOk === true ? C.green : denied ? C.red : C.yellow;
    const title = pushOk === true ? "Notificaciones activas — recibirás alertas con la app cerrada" : denied ? "Bloqueado: ve a Ajustes → Notificaciones" : noSoporta ? "Instala la app en pantalla de inicio (iOS)" : "Toca para activar notificaciones en segundo plano";
    return React.createElement("button", {
      onClick: () => pedirPermiso(setPushOk),
      title: title,
      style: {
        background: `${col}18`,
        border: `1px solid ${col}40`,
        color: col,
        borderRadius: 8,
        padding: "7px 10px",
        fontSize: 14,
        cursor: "pointer",
        opacity: pushOk === null ? 0.5 : 1
      }
    }, pushOk === true ? "🔔✓" : pushOk === false && denied ? "🔕" : "🔔");
  })(), React.createElement("button", {
    onClick: () => {
      setOperario(null);
      setTurnos([]);
      prevPendRef.current = 0;
      misEnProcesoRef.current = new Set();
    },
    style: {
      background: C.bg3,
      border: `1px solid ${C.b0}`,
      color: C.t3,
      borderRadius: 8,
      padding: "7px 10px",
      fontSize: 11
    }
  }, "⇦")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 4
    }
  }, [{
    key: "pendiente",
    lbl: "⏳ Pend.",
    n: nPend,
    col: C.yellow
  }, {
    key: "en_proceso",
    lbl: "🔄 En curso",
    n: nProc,
    col: C.orange
  }, {
    key: "agrupado",
    lbl: misTurnosActivos.length > 0 ? "🗺 Mi Ruta" : "📊 Ruta",
    n: nRuta,
    col: C.purple
  }, {
    key: "completado",
    lbl: "✅ Listo",
    n: null,
    col: C.green
  }, {
    key: "buscar",
    lbl: "🔍 SKU",
    n: null,
    col: C.teal
  }].map(t => React.createElement("button", {
    key: t.key,
    onClick: () => setTab(t.key),
    style: {
      flex: 1,
      padding: "8px 2px",
      borderRadius: 9,
      border: `1px solid ${tab === t.key ? t.col : C.b0}`,
      background: tab === t.key ? `${t.col}18` : C.bg2,
      color: tab === t.key ? t.col : C.t3,
      fontWeight: 700,
      fontSize: 10,
      position: "relative"
    }
  }, t.lbl, t.n > 0 && React.createElement("span", {
    style: {
      position: "absolute",
      top: -5,
      right: -3,
      background: t.col,
      color: C.bg0,
      borderRadius: "50%",
      width: 16,
      height: 16,
      fontSize: 8,
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, t.n))))), React.createElement("div", {
    style: {
      padding: "12px 12px 0"
    }
  }, alertaCancelacion.length > 0 && React.createElement("div", {
    style: {
      background: `${C.red}18`,
      border: `1px solid ${C.red}40`,
      borderRadius: 11,
      padding: "10px 14px",
      marginBottom: 10,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      animation: "fadeUp .3s ease"
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      color: C.red,
      fontWeight: 800,
      fontSize: 12
    }
  }, "⚠️ Turno cancelado por Admin"), React.createElement("div", {
    style: {
      color: C.t3,
      fontSize: 10,
      marginTop: 2
    }
  }, "Picking: ", alertaCancelacion.join(", "))), React.createElement("button", {
    onClick: () => setAlertaCancelacion([]),
    style: {
      background: "none",
      border: "none",
      color: C.t3,
      fontSize: 18,
      cursor: "pointer",
      padding: "0 4px"
    }
  }, "✕")), tab !== "agrupado" && tab !== "buscar" && React.createElement(React.Fragment, null, tab === "completado" && listaRaw.length > 0 && React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
      padding: "0 2px",
      gap: 6
    }
  }, nOcultos > 0 ? React.createElement("button", {
    onClick: () => setVerTodos(true),
    style: {
      background: `${C.accent}15`,
      border: `1px solid ${C.accent}35`,
      color: C.accent,
      borderRadius: 8,
      padding: "6px 11px",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, "+", nOcultos, " oculto", nOcultos !== 1 ? "s" : "", " · Ver todos") : verTodos ? React.createElement("button", {
    onClick: () => setVerTodos(false),
    style: {
      background: C.bg3,
      border: `1px solid ${C.b0}`,
      color: C.t3,
      borderRadius: 8,
      padding: "6px 11px",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, "Mostrar solo <1h") : React.createElement("div", null), React.createElement("button", {
    onClick: limpiarCompletados,
    style: {
      background: `${C.red}15`,
      border: `1px solid ${C.red}35`,
      color: C.red,
      borderRadius: 8,
      padding: "6px 13px",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
      letterSpacing: ".3px"
    }
  }, "🗑 Limpiar todo")), lista.length === 0 && React.createElement("div", {
    style: {
      textAlign: "center",
      color: C.t3,
      padding: "50px 20px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 40,
      marginBottom: 12
    }
  }, tab === "pendiente" ? "🎉" : tab === "en_proceso" ? "⚙️" : "📋"), React.createElement("div", {
    style: {
      fontSize: 14
    }
  }, tab === "pendiente" ? "Sin turnos pendientes · actualiza cada 15s" : tab === "en_proceso" ? "No hay turnos en proceso" : nOcultos > 0 ? `${nOcultos} turno${nOcultos !== 1 ? "s" : ""} oculto${nOcultos !== 1 ? "s" : ""} (>1h) · usa Limpiar para eliminar` : "Sin completados hoy")), listaItems.map((item, ti) => {
    if (item.type === "header") {
      const gKey = "grp-" + item.operario;
      const gProc = !!procesando[gKey];
      return React.createElement("div", {
        key: gKey,
        style: {
          marginBottom: 6,
          marginTop: ti > 0 ? 12 : 0
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 2px",
          marginBottom: item.count > 1 ? 8 : 4
        }
      }, React.createElement("div", {
        style: {
          height: 1,
          flex: 1,
          background: C.b0
        }
      }), React.createElement("span", {
        style: {
          color: C.t2,
          fontSize: 11,
          fontWeight: 800,
          whiteSpace: "nowrap",
          background: C.bg2,
          padding: "3px 10px",
          borderRadius: 20,
          border: `1px solid ${C.b0}`
        }
      }, "👷 ", item.operario, " · ", item.count, " turno", item.count > 1 ? "s" : ""), React.createElement("div", {
        style: {
          height: 1,
          flex: 1,
          background: C.b0
        }
      })), item.count > 1 && React.createElement("button", {
        onClick: () => tomarGrupo(item.ids, gKey),
        disabled: gProc,
        style: {
          width: "100%",
          padding: "11px",
          background: gProc ? C.bg3 : `linear-gradient(135deg,${C.orange},${C.yellow})`,
          border: "none",
          borderRadius: 11,
          color: gProc ? C.t4 : C.bg0,
          fontWeight: 800,
          fontSize: 13,
          cursor: gProc ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          letterSpacing: ".2px"
        }
      }, gProc ? "Tomando turnos..." : "🚜 Tomar los " + item.count + " turnos de " + item.operario));
    }
    const t = item.t;
    const numLabel = item.numLabel;
    const posiciones = ordenarPos(t.posiciones.map((p, i) => ({
      ...p,
      _origIdx: i
    })));
    const exp = !!expandido[t.id];
    const proc = !!procesando[t.id];
    const urgente = t.es_mde || t.prioridad === "urgente";
    const accentCol = urgente ? C.red : C.purple;
    const nBaj = posiciones.filter(p => p.bajada).length;
    const nFalloPosicion = posiciones.filter(p => p.fallo).length;
    const nHecho = nBaj + nFalloPosicion;
    const todosDone = posiciones.length > 0 && nHecho === posiciones.length;
    const todosBajados = todosDone && nFalloPosicion === 0;
    const totalUnids = posiciones.reduce((s, p) => (p.skus || []).reduce((u, k) => u + k.cant, s), 0);
    const totalSKUs = posiciones.reduce((s, p) => s + (p.skus || []).length, 0);
    return React.createElement("div", {
      key: t.id,
      style: {
        background: C.bg2,
        borderRadius: 13,
        marginBottom: 10,
        border: `1px solid ${urgente ? C.red + "40" : C.b0}`,
        borderLeft: `4px solid ${accentCol}`,
        animation: "fadeUp .2s ease both"
      }
    }, React.createElement("div", {
      onClick: () => setExpandido(o => ({
        ...o,
        [t.id]: !o[t.id]
      })),
      style: {
        padding: "12px 14px",
        cursor: "pointer"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 6
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: `${accentCol}20`,
        color: accentCol,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: 12,
        flexShrink: 0
      }
    }, numLabel), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap"
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        color: C.teal,
        fontWeight: 800,
        fontSize: 15
      }
    }, t.picking), urgente && React.createElement("span", {
      style: {
        background: `${C.red}20`,
        color: C.red,
        border: `1px solid ${C.red}40`,
        borderRadius: 4,
        padding: "1px 6px",
        fontSize: 8,
        fontWeight: 800
      }
    }, "🚨 URGENTE"), t.estado === "en_proceso" && (todosBajados ? React.createElement("span", {
      style: {
        background: `${C.green}20`,
        color: C.green,
        borderRadius: 4,
        padding: "1px 6px",
        fontSize: 8,
        fontWeight: 800,
        animation: "pop .3s ease"
      }
    }, "✅ Todo en piso") : React.createElement("span", {
      style: {
        background: `${C.orange}15`,
        color: C.orange,
        borderRadius: 4,
        padding: "1px 6px",
        fontSize: 8,
        fontWeight: 700
      }
    }, nBaj, "/", posiciones.length, " en piso"))), React.createElement("div", {
      style: {
        color: C.t2,
        fontSize: 11,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        marginTop: 2
      }
    }, t.cliente))), React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0
      }
    }, React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, React.createElement("div", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        color: C.green,
        fontWeight: 800,
        fontSize: 15,
        lineHeight: 1
      }
    }, totalUnids, "u"), React.createElement("div", {
      style: {
        color: C.t4,
        fontSize: 8
      }
    }, totalSKUs, " SKU", totalSKUs !== 1 ? "s" : "")), React.createElement("span", {
      style: {
        color: C.t3,
        fontSize: 15,
        transform: exp ? "rotate(90deg)" : "none",
        transition: "transform .2s"
      }
    }, "▶"))), React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        fontSize: 10,
        color: C.t3,
        flexWrap: "wrap",
        marginBottom: exp ? 0 : 6
      }
    }, React.createElement("span", null, "👷 ", t.operario_solicitante), React.createElement("span", null, "📍 ", t.ciudad), React.createElement("span", null, "🕐 ", fmtHora(t.fecha_solicitud)), t.montacarguista && React.createElement("span", {
      style: {
        color: C.teal
      }
    }, "🏗️ ", t.montacarguista)), t.estado === "en_proceso" && posiciones.length > 0 && (() => {
      const pct = Math.round(nHecho / posiciones.length * 100);
      const col = todosBajados ? C.green : todosDone ? C.orange : nFalloPosicion > 0 ? C.orange : C.orange;
      const label = todosBajados ? "✓ Todo en piso" : todosDone ? `✓ ${nBaj} bajados · ${nFalloPosicion} con fallo` : `${nBaj} bajados${nFalloPosicion > 0 ? ` · ${nFalloPosicion} fallo` : ""} / ${posiciones.length}`;
      return React.createElement("div", {
        style: {
          marginTop: 8,
          background: C.bg3,
          border: `1px solid ${todosDone ? (todosBajados ? C.green : C.orange) + "40" : C.b0}`,
          borderRadius: 10,
          padding: "8px 10px",
          transition: "border-color .4s"
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6
        }
      }, React.createElement("div", {
        style: {
          fontSize: 9,
          fontWeight: 700,
          color: todosBajados ? C.green : todosDone ? C.orange : C.t3,
          letterSpacing: ".4px",
          textTransform: "uppercase"
        }
      }, label), React.createElement("div", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 20,
          fontWeight: 900,
          color: col,
          lineHeight: 1
        }
      }, pct, React.createElement("span", {
        style: {
          fontSize: 10,
          fontWeight: 600,
          color: C.t3
        }
      }, "%"))), React.createElement("div", {
        style: {
          height: 7,
          background: C.b0,
          borderRadius: 5,
          overflow: "hidden"
        }
      }, React.createElement("div", {
        style: {
          height: "100%",
          width: `${pct}%`,
          background: todosDone ? col : `linear-gradient(90deg,${col}99,${col})`,
          borderRadius: 5,
          transition: "width .5s cubic-bezier(.4,0,.2,1)",
          boxShadow: pct > 0 ? `0 0 8px ${col}60` : "none"
        }
      })));
    })(), !exp && t.estado !== "en_proceso" && React.createElement("div", {
      style: {
        display: "flex",
        gap: 4,
        flexWrap: "wrap",
        marginTop: 4
      }
    }, posiciones.map((p, pi) => React.createElement("span", {
      key: pi,
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        background: p.bajada ? `${C.green}15` : C.bg3,
        border: `1px solid ${p.bajada ? C.green + "40" : C.b0}`,
        borderRadius: 5,
        padding: "2px 7px",
        fontSize: 9,
        color: p.bajada ? C.green : C.teal
      }
    }, p.ubi, p.bajada ? " ✓" : "")))), exp && React.createElement("div", {
      style: {
        borderTop: `1px solid ${C.b0}`,
        padding: "8px 14px 10px"
      }
    }, [...posiciones].sort((a, b) => {
      if (a.bajada && !b.bajada) return 1;
      if (!a.bajada && b.bajada) return -1;
      return (CALLE_ORD[a.calleLetra] || 9) - (CALLE_ORD[b.calleLetra] || 9) || (a.modulo || 0) - (b.modulo || 0) || (a.nivel || 0) - (b.nivel || 0) || (demandaMap[b.ubi] || 0) - (demandaMap[a.ubi] || 0);
    }).map(pos => {
      const pi = pos._origIdx;
      const keyBaj = `${t.id}-pos-${pi}`;
      const bajando = !!procesando[keyBaj];
      const esBajada = !!pos.bajada;
      const esFalloPosicion = !!pos.fallo;
      const reportandoEstePosicion = !!reportandoPos[keyBaj];
      const demanda = demandaMap[pos.ubi] || 0;
      const esPrioridad = !esBajada && !esFalloPosicion && demanda > 1;
      const borderCol = esBajada ? C.green : esFalloPosicion ? C.red : esPrioridad ? C.yellow : C.purple;
      const bgCol = esBajada ? `${C.green}10` : esFalloPosicion ? `${C.red}08` : esPrioridad ? `${C.yellow}08` : C.bg3;
      return React.createElement("div", {
        key: pi,
        style: {
          background: bgCol,
          borderRadius: 9,
          marginBottom: 6,
          borderLeft: `3px solid ${borderCol}`,
          transition: "all .3s",
          overflow: "hidden"
        }
      }, React.createElement("div", {
        style: {
          padding: "8px 10px"
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: esBajada || esFalloPosicion ? 0 : 5
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 7,
          flex: 1,
          minWidth: 0,
          flexWrap: "wrap"
        }
      }, React.createElement("span", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: esBajada ? C.green : esFalloPosicion ? C.red : esPrioridad ? C.yellow : C.teal,
          fontWeight: 800,
          fontSize: 14
        }
      }, pos.ubi), esPrioridad && React.createElement("span", {
        style: {
          background: `${C.yellow}20`,
          color: C.yellow,
          border: `1px solid ${C.yellow}40`,
          borderRadius: 4,
          padding: "1px 6px",
          fontSize: 8,
          fontWeight: 800,
          animation: "pop .3s ease"
        }
      }, "⚡ ", demanda, " pedidos"), React.createElement("span", {
        style: {
          fontSize: 9,
          color: C.t3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, CALLE_NOM[pos.calleLetra] || pos.calleLetra, " · Mód ", pos.modulo, " · Niv ", pos.nivel)), t.estado === "en_proceso" ? esBajada ? React.createElement("span", {
        style: {
          color: C.green,
          fontSize: 11,
          fontWeight: 800,
          flexShrink: 0,
          animation: "pop .3s ease"
        }
      }, "✅ En piso") : esFalloPosicion ? React.createElement("span", {
        style: {
          color: C.red,
          fontSize: 10,
          fontWeight: 700,
          flexShrink: 0
        }
      }, "⚠ ", pos.motivo_fallo) : reportandoEstePosicion ? null : React.createElement("div", {
        style: {
          display: "flex",
          gap: 4,
          flexShrink: 0
        }
      }, React.createElement("button", {
        onClick: () => marcarBajada(t.id, pi),
        disabled: bajando,
        style: {
          padding: "5px 11px",
          background: bajando ? C.bg2 : `linear-gradient(135deg,${C.green},${C.teal})`,
          border: "none",
          borderRadius: 7,
          color: bajando ? C.t3 : C.bg0,
          fontSize: 11,
          fontWeight: 800,
          cursor: bajando ? "not-allowed" : "pointer",
          fontFamily: "inherit"
        }
      }, bajando ? "..." : "⬇ Bajar"), React.createElement("button", {
        onClick: () => setReportandoPos(r => ({
          ...r,
          [keyBaj]: true
        })),
        style: {
          padding: "5px 9px",
          background: `${C.red}15`,
          border: `1px solid ${C.red}30`,
          borderRadius: 7,
          color: C.red,
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "inherit"
        }
      }, "⚠")) : React.createElement("span", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: C.t4,
          fontWeight: 700,
          fontSize: 11,
          flexShrink: 0
        }
      }, (pos.skus || []).length !== 1 ? `${pos.totalSaldo}u` : "")), !esBajada && !esFalloPosicion && !reportandoEstePosicion && (pos.skus || []).map((s, si) => {
        const tipo = s.tipo || (s.desc || '').split(' ')[1] || '';
        const modelo = (s.desc || '').match(/[A-Z]{2,5}-(\w+)/i)?.[1] || '';
        return React.createElement("div", {
          key: si,
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "3px 0",
            borderTop: si > 0 ? `1px solid ${C.b0}` : "none"
          }
        }, React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexWrap: "wrap"
          }
        }, React.createElement("span", {
          style: {
            fontSize: 8,
            background: `${C.accent}20`,
            color: C.accent,
            borderRadius: 3,
            padding: "1px 4px",
            fontWeight: 800
          }
        }, "SKU"), React.createElement("span", {
          style: {
            fontFamily: "'JetBrains Mono',monospace",
            color: C.accent,
            fontSize: 11,
            fontWeight: 700
          }
        }, s.ref), tipo && React.createElement("span", {
          style: {
            fontSize: 8,
            background: `${C.purple}20`,
            color: C.purple,
            border: `1px solid ${C.purple}30`,
            borderRadius: 3,
            padding: "1px 5px",
            fontWeight: 800,
            letterSpacing: .3
          }
        }, tipo), modelo && React.createElement("span", {
          style: {
            fontSize: 8,
            background: `${C.teal}15`,
            color: C.teal,
            border: `1px solid ${C.teal}30`,
            borderRadius: 3,
            padding: "1px 5px",
            fontWeight: 700
          }
        }, modelo)), React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 6
          }
        }, React.createElement("span", {
          style: {
            fontFamily: "'JetBrains Mono',monospace",
            color: C.yellow,
            fontSize: 11,
            fontWeight: 700
          }
        }, s.cant, "u")));
      }), esBajada && React.createElement("div", {
        style: {
          color: C.green,
          fontSize: 9,
          marginTop: 4,
          fontWeight: 600
        }
      }, (pos.skus || []).map(s => `${s.ref} · ${s.cant}u`).join("  ·  ")), (pos.solicitantes || []).length > 0 && React.createElement("div", {
        style: {
          marginTop: 6,
          borderTop: `1px solid ${C.b0}`,
          paddingTop: 5
        }
      }, React.createElement("div", {
        style: {
          fontSize: 7,
          color: C.t4,
          fontWeight: 700,
          marginBottom: 3,
          letterSpacing: .5
        }
      }, "SOLICITANTES"), (pos.solicitantes || []).map((sol, si) => React.createElement("div", {
        key: si,
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 3,
          padding: "3px 6px",
          background: C.bg3,
          borderRadius: 5
        }
      }, React.createElement("div", null, React.createElement("div", {
        style: {
          color: C.t2,
          fontSize: 9,
          fontWeight: 700
        }
      }, sol.operario), React.createElement("div", {
        style: {
          color: C.t4,
          fontSize: 7,
          marginTop: 1
        }
      }, (sol.skus || []).map(s => `${s.ref}·${s.cant}u`).join(" "))), React.createElement("div", {
        style: {
          color: C.t4,
          fontSize: 7,
          flexShrink: 0,
          marginLeft: 6
        }
      }, sol.fecha ? new Date(sol.fecha).toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit"
      }) : "")))), esFalloPosicion && React.createElement("div", {
        style: {
          color: C.red,
          fontSize: 9,
          marginTop: 2,
          opacity: .7
        }
      }, fmtHora(pos.fallo_ts) || "")), reportandoEstePosicion && React.createElement("div", {
        style: {
          background: `${C.red}10`,
          borderTop: `1px solid ${C.red}20`,
          padding: "8px 10px"
        }
      }, React.createElement("div", {
        style: {
          fontSize: 9,
          color: C.red,
          fontWeight: 700,
          marginBottom: 7
        }
      }, "¿Qué pasó en ", pos.ubi, "?"), React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 5
        }
      }, [{
        ico: "❓",
        txt: "No encontrada"
      }, {
        ico: "📭",
        txt: "Posición vacía"
      }, {
        ico: "💥",
        txt: "Caja dañada"
      }, {
        ico: "🚧",
        txt: "Acceso bloqueado"
      }, {
        ico: "📋",
        txt: "Diferencia stock"
      }, {
        ico: "✏️",
        txt: "Otro"
      }].map(m => React.createElement("button", {
        key: m.txt,
        onClick: () => marcarFalloPosicion(t.id, pi, m.ico + " " + m.txt),
        disabled: bajando,
        style: {
          padding: "8px 6px",
          background: `${C.red}12`,
          border: `1px solid ${C.red}30`,
          borderRadius: 8,
          color: C.red,
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3
        }
      }, React.createElement("span", {
        style: {
          fontSize: 17
        }
      }, m.ico), React.createElement("span", {
        style: {
          fontSize: 9,
          textAlign: "center",
          lineHeight: 1.2
        }
      }, m.txt)))), React.createElement("button", {
        onClick: () => setReportandoPos(r => ({
          ...r,
          [keyBaj]: false
        })),
        style: {
          width: "100%",
          padding: "6px",
          background: C.bg3,
          border: `1px solid ${C.b0}`,
          borderRadius: 7,
          color: C.t3,
          fontSize: 10,
          cursor: "pointer",
          fontFamily: "inherit",
          marginTop: 6
        }
      }, "Cancelar")));
    }), t.motivo_fallo && React.createElement("div", {
      style: {
        background: `${C.orange}10`,
        border: `1px solid ${C.orange}30`,
        borderRadius: 8,
        padding: "6px 10px",
        marginTop: 4
      }
    }, React.createElement("span", {
      style: {
        color: C.orange,
        fontSize: 10,
        fontWeight: 700
      }
    }, "⚠️ Fallo: "), React.createElement("span", {
      style: {
        color: C.t2,
        fontSize: 10
      }
    }, t.motivo_fallo))), React.createElement("div", {
      style: {
        borderTop: `1px solid ${C.b0}`
      }
    }, t.estado === "pendiente" && React.createElement("button", {
      onClick: () => tomarTurno(t.id),
      disabled: proc,
      style: {
        width: "100%",
        padding: "12px",
        background: proc ? C.bg3 : `linear-gradient(135deg,${C.orange},${C.yellow})`,
        border: "none",
        borderRadius: "0 0 12px 12px",
        color: proc ? C.t3 : C.bg0,
        fontWeight: 800,
        fontSize: 13,
        cursor: proc ? "not-allowed" : "pointer",
        fontFamily: "inherit"
      }
    }, proc ? "Procesando..." : "🚜 Tomar turno"), t.estado === "en_proceso" && React.createElement("button", {
      onClick: () => completarTurno(t.id),
      disabled: proc,
      style: {
        width: "100%",
        padding: "12px",
        background: proc ? C.bg3 : todosBajados ? `linear-gradient(135deg,${C.green},${C.teal})` : todosDone ? `linear-gradient(135deg,${C.orange},${C.yellow})` : `${C.green}25`,
        border: "none",
        borderRadius: "0 0 12px 12px",
        color: proc ? C.t3 : todosDone ? C.bg0 : C.green,
        fontWeight: 800,
        fontSize: 12,
        cursor: proc ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        transition: "all .3s"
      }
    }, proc ? "Procesando..." : todosBajados ? "✅ Completar turno" : todosDone ? `⚠ ${nFalloPosicion} con fallo · Completar` : `⬇ ${nBaj}/${posiciones.length} bajadas · Completar`), (t.estado === "completado" || t.estado === "fallido") && React.createElement("div", {
      style: {
        padding: "10px",
        textAlign: "center",
        color: t.estado === "fallido" ? C.orange : C.green,
        fontSize: 11,
        fontWeight: 700
      }
    }, t.estado === "fallido" ? `⚠️ Reportado: ${t.motivo_fallo || "problema"}` : `✅ Completado a las ${fmtHora(t.fecha_completado)} · ${t.montacarguista}`)));
  })), tab === "buscar" && React.createElement("div", {style: {paddingTop: 4}},
  React.createElement("div", {style: {fontWeight: 800, fontSize: 15, color: C.t1, marginBottom: 4}}, "🔍 Buscar SKU"),
  React.createElement("div", {style: {color: C.t3, fontSize: 11, marginBottom: 10}}, "Busca entre los SKUs de todos los turnos pendientes y en curso"),
  React.createElement("input", {
    value: busquedaSku,
    onChange: function(e) { setBusquedaSku(e.target.value); },
    placeholder: "Ref del SKU, ej: ICH-100, T10...",
    style: {
      width: "100%",
      background: C.bg2,
      border: "1px solid " + (busquedaSku ? C.teal : C.b1),
      borderRadius: 11,
      padding: "11px 14px",
      fontSize: 14,
      color: C.t1,
      outline: "none",
      marginBottom: 12,
      transition: "border-color .2s"
    }
  }),
  !busquedaSku.trim()
    ? React.createElement("div", {style: {textAlign: "center", color: C.t3, padding: "30px 0", fontSize: 12}}, "Escribe la referencia del SKU a buscar")
    : skuResultados.length === 0
      ? React.createElement("div", {style: {textAlign: "center", color: C.t3, padding: "30px 0"}},
          React.createElement("div", {style: {fontSize: 28, marginBottom: 8}}, "🔍"),
          React.createElement("div", {style: {fontSize: 13}}, "Sin resultados para \"" + busquedaSku.trim() + "\"")
        )
      : React.createElement("div", null,
          React.createElement("div", {style: {fontSize: 10, color: C.t3, marginBottom: 8}}, skuResultados.length + " referencia" + (skuResultados.length !== 1 ? "s" : "") + " encontrada" + (skuResultados.length !== 1 ? "s" : "")),
          skuResultados.map(function(r) {
            var operariosDistinct = Array.from(new Set(r.items.map(function(i) { return i.operario; })));
            var isConflict = operariosDistinct.length > 1;
            var totalUnids = r.items.reduce(function(s, i) { return s + i.cant; }, 0);
            return React.createElement("div", {
              key: r.ref,
              style: {
                background: isConflict ? C.red + "08" : C.bg2,
                borderRadius: 12,
                marginBottom: 8,
                border: "1px solid " + (isConflict ? C.red + "40" : C.b0),
                borderLeft: "4px solid " + (isConflict ? C.red : C.teal),
                overflow: "hidden",
                animation: "fadeUp .2s ease both"
              }
            },
              React.createElement("div", {style: {padding: "10px 13px"}},
                React.createElement("div", {style: {display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6}},
                  React.createElement("div", null,
                    React.createElement("div", {style: {display: "flex", alignItems: "center", gap: 7, marginBottom: 2}},
                      React.createElement("span", {style: {
                        fontFamily: "'JetBrains Mono',monospace",
                        color: isConflict ? C.red : C.teal,
                        fontWeight: 800,
                        fontSize: 15
                      }}, r.ref),
                      isConflict && React.createElement("span", {style: {
                        background: C.red + "20",
                        color: C.red,
                        border: "1px solid " + C.red + "40",
                        borderRadius: 4,
                        padding: "1px 6px",
                        fontSize: 8,
                        fontWeight: 800,
                        animation: "pop .3s ease"
                      }}, "⚠ " + operariosDistinct.length + " ops. lo piden")
                    ),
                    r.desc && React.createElement("div", {style: {color: C.t3, fontSize: 10}}, r.desc)
                  ),
                  React.createElement("div", {style: {textAlign: "right", flexShrink: 0, marginLeft: 8}},
                    React.createElement("div", {style: {
                      fontFamily: "'JetBrains Mono',monospace",
                      color: C.green,
                      fontWeight: 800,
                      fontSize: 14
                    }}, totalUnids + "u"),
                    React.createElement("div", {style: {color: C.t4, fontSize: 9}}, r.items.length + " ubic.")
                  )
                ),
                r.items.map(function(item, ii) {
                  return React.createElement("div", {
                    key: ii,
                    style: {
                      background: item.bajada ? C.green + "08" : item.fallo ? C.red + "08" : C.bg3,
                      borderRadius: 8,
                      padding: "7px 10px",
                      marginTop: 5,
                      borderLeft: "3px solid " + (item.bajada ? C.green : item.fallo ? C.red : item.estado === "en_proceso" ? C.orange : C.t4),
                      opacity: item.bajada || item.fallo ? 0.65 : 1
                    }
                  },
                    React.createElement("div", {style: {display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3}},
                      React.createElement("div", {style: {display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap"}},
                        React.createElement("span", {style: {
                          fontFamily: "'JetBrains Mono',monospace",
                          color: item.bajada ? C.green : item.fallo ? C.red : C.teal,
                          fontWeight: 800,
                          fontSize: 13
                        }}, item.ubi),
                        React.createElement("span", {style: {fontSize: 9, color: C.t3}},
                          (CALLE_NOM[item.calleLetra] || item.calleLetra) + " · Mód " + item.modulo + " · Niv " + item.nivel
                        )
                      ),
                      React.createElement("div", {style: {display: "flex", alignItems: "center", gap: 6, flexShrink: 0}},
                        React.createElement("span", {style: {
                          fontFamily: "'JetBrains Mono',monospace",
                          color: C.yellow,
                          fontWeight: 700,
                          fontSize: 12
                        }}, item.cant + "u"),
                        React.createElement("span", {style: {
                          background: item.estado === "en_proceso" ? C.orange + "20" : C.yellow + "15",
                          color: item.estado === "en_proceso" ? C.orange : C.yellow,
                          borderRadius: 4,
                          padding: "1px 5px",
                          fontSize: 7,
                          fontWeight: 800
                        }}, item.estado === "en_proceso" ? "🔄" : "⏳")
                      )
                    ),
                    React.createElement("div", {style: {display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap"}},
                      React.createElement("span", {style: {fontSize: 9, color: C.t3}}, "👷"),
                      React.createElement("span", {style: {
                        fontSize: 9,
                        color: isConflict ? C.orange : C.t2,
                        fontWeight: isConflict ? 700 : 400
                      }}, item.operario),
                      item.bajada && React.createElement("span", {style: {color: C.green, fontSize: 9, fontWeight: 700}}, "· ✓ bajado"),
                      item.fallo && React.createElement("span", {style: {color: C.red, fontSize: 9}}, "· ⚠ fallo")
                    )
                  );
                })
              )
            );
          })
        )
), tab === "agrupado" && React.createElement(React.Fragment, null, misTurnosActivos.length > 0 ? ((() => {
    const totalPos = agrupadoPorUBI.reduce((s, u) => s + u.posiciones.length, 0);
    const bajadas = agrupadoPorUBI.reduce((s, u) => s + u.posiciones.filter(p => p.bajada || p.fallo).length, 0);
    const pct = totalPos > 0 ? Math.round(bajadas / totalPos * 100) : 0;
    const nPendUBI = agrupadoPorUBI.filter(u => !u.posiciones.every(p => p.bajada || p.fallo)).length;
    return React.createElement("div", null, React.createElement("div", {
      style: {
        background: C.bg2,
        borderRadius: 13,
        padding: "14px 15px",
        marginBottom: 12,
        border: `1px solid ${C.purple}35`
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 11
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        fontWeight: 900,
        fontSize: 17,
        color: C.purple
      }
    }, "🗺 Tu ruta"), React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.t2,
        marginTop: 3,
        fontWeight: 600
      }
    }, misTurnosActivos.length, " turno", misTurnosActivos.length !== 1 ? "s" : "", " · ", nPendUBI, " posición", nPendUBI !== 1 ? "es" : "", " pendiente", nPendUBI !== 1 ? "s" : "")), React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, React.createElement("div", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 32,
        fontWeight: 900,
        color: pct === 100 ? C.green : C.orange,
        lineHeight: 1
      }
    }, pct, React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: C.t3
      }
    }, "%")), React.createElement("div", {
      style: {
        fontSize: 11,
        color: C.t3,
        marginTop: 2
      }
    }, bajadas, "/", totalPos, " bajadas"))), React.createElement("div", {
      style: {
        height: 8,
        background: C.b0,
        borderRadius: 5,
        overflow: "hidden",
        marginBottom: 11
      }
    }, React.createElement("div", {
      style: {
        height: "100%",
        width: `${pct}%`,
        background: pct === 100 ? C.green : `linear-gradient(90deg,${C.purple},${C.teal})`,
        borderRadius: 5,
        transition: "width .5s cubic-bezier(.4,0,.2,1)",
        boxShadow: pct > 0 ? `0 0 10px ${C.purple}60` : "none"
      }
    })), React.createElement("div", {
      style: {
        display: "flex",
        gap: 5,
        flexWrap: "wrap"
      }
    }, misTurnosActivos.map(t => {
      const nB = (t.posiciones || []).filter(p => p.bajada).length;
      const nT = (t.posiciones || []).length;
      const done = nB === nT;
      return React.createElement("span", {
        key: t.id,
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          background: done ? `${C.green}15` : C.bg3,
          border: `1px solid ${done ? C.green + "40" : C.b0}`,
          borderRadius: 6,
          padding: "3px 10px",
          fontSize: 11,
          color: done ? C.green : C.teal,
          fontWeight: 700
        }
      }, t.picking, " ", done ? "✓" : `${nB}/${nT}`);
    }))), nPendUBI === 0 ? React.createElement("div", {
      style: {
        textAlign: "center",
        color: C.green,
        padding: "30px 20px"
      }
    }, React.createElement("div", {
      style: {
        fontSize: 40,
        marginBottom: 10
      }
    }, "✅"), React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700
      }
    }, "¡Todo bajado!"), React.createElement("div", {
      style: {
        fontSize: 11,
        color: C.t3,
        marginTop: 4
      }
    }, "Ve a \"En curso\" para completar los turnos")) : agrupadoPorUBI.map((ubiEntry, pi) => {
      const pendPos = ubiEntry.posiciones.filter(p => !p.bajada && !p.fallo);
      const allDone = pendPos.length === 0;
      const tieneUrgente = pendPos.some(p => p.urgente);
      const isMulti = ubiEntry.posiciones.length > 1;
      const keyProc = `ruta-${ubiEntry.ubi}`;
      const proc = !!procesando[keyProc];
      const totalUnids = ubiEntry.posiciones.reduce((s, p) => p.skus.reduce((u, k) => u + k.cant, s), 0);
      const exp = !!expandido[`ruta-${ubiEntry.ubi}`];
      const borderCol = allDone ? C.t4 : tieneUrgente ? C.red : isMulti ? C.yellow : C.purple;
      return React.createElement("div", {
        key: ubiEntry.ubi,
        style: {
          background: allDone ? C.bg1 : C.bg2,
          borderRadius: 13,
          marginBottom: 7,
          border: `1px solid ${allDone ? C.b0 : tieneUrgente ? C.red + "40" : isMulti ? C.yellow + "30" : C.purple + "30"}`,
          borderLeft: `4px solid ${borderCol}`,
          opacity: allDone ? 0.45 : 1,
          animation: "fadeUp .2s ease both",
          transition: "opacity .4s"
        }
      }, React.createElement("div", {
        onClick: () => setExpandido(o => ({
          ...o,
          [`ruta-${ubiEntry.ubi}`]: !o[`ruta-${ubiEntry.ubi}`]
        })),
        style: {
          padding: "11px 13px",
          cursor: "pointer"
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: allDone ? 0 : 5
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8
        }
      }, React.createElement("div", {
        style: {
          width: 27,
          height: 27,
          borderRadius: "50%",
          background: allDone ? `${C.t4}15` : `${borderCol}20`,
          color: allDone ? C.t4 : borderCol,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 10,
          flexShrink: 0
        }
      }, allDone ? "✓" : pi + 1), React.createElement("div", null, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap"
        }
      }, React.createElement("span", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: allDone ? C.t3 : C.teal,
          fontWeight: 800,
          fontSize: 15
        }
      }, ubiEntry.ubi), tieneUrgente && !allDone && React.createElement("span", {
        style: {
          background: `${C.red}20`,
          color: C.red,
          borderRadius: 3,
          padding: "0 4px",
          fontSize: 7,
          fontWeight: 800
        }
      }, "🚨"), isMulti && !allDone && React.createElement("span", {
        style: {
          background: `${C.yellow}20`,
          color: C.yellow,
          borderRadius: 3,
          padding: "1px 5px",
          fontSize: 8,
          fontWeight: 700
        }
      }, ubiEntry.posiciones.length, " ped.")), React.createElement("div", {
        style: {
          color: C.t3,
          fontSize: 8,
          marginTop: 1
        }
      }, CALLE_NOM[ubiEntry.calleLetra], " · Mód ", ubiEntry.modulo, " · Niv ", ubiEntry.nivel))), React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0
        }
      }, !allDone && React.createElement("div", {
        style: {
          textAlign: "right"
        }
      }, React.createElement("div", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: C.green,
          fontWeight: 800,
          fontSize: 14
        }
      }, totalUnids, "u"), React.createElement("div", {
        style: {
          fontSize: 7,
          color: C.t4
        }
      }, ubiEntry.posiciones.reduce((s, p) => s + p.skus.length, 0), " SKUs")), React.createElement("span", {
        style: {
          color: C.t3,
          fontSize: 13,
          transform: exp ? "rotate(90deg)" : "none",
          transition: "transform .2s"
        }
      }, "▶"))), !allDone && !exp && React.createElement("div", {
        style: {
          display: "flex",
          gap: 5,
          flexWrap: "wrap"
        }
      }, pendPos.map((p, i) => {
        const fams = familiasDePos(p.skus);
        const tipos = tipoDeSkus(p.skus);
        return React.createElement("div", {
          key: i,
          style: {
            background: p.urgente ? `${C.red}12` : C.bg3,
            border: `1px solid ${p.urgente ? C.red + "40" : C.b0}`,
            borderRadius: 7,
            padding: "5px 9px",
            display: "inline-flex",
            flexDirection: "column",
            gap: 3
          }
        }, React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 5
          }
        }, p.urgente && React.createElement("span", {
          style: {
            color: C.red,
            fontSize: 10
          }
        }, "🚨"), React.createElement("span", {
          style: {
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 11,
            color: p.urgente ? C.red : C.teal,
            fontWeight: 800
          }
        }, p.picking)), React.createElement("div", {
          style: {
            display: "flex",
            gap: 4,
            alignItems: "center",
            flexWrap: "wrap"
          }
        }, p.operario && React.createElement("span", {
          style: {
            fontSize: 10,
            color: C.t2,
            fontWeight: 600
          }
        }, "👷 ", p.operario), fams.map(f => React.createElement("span", {
          key: f,
          style: {
            fontSize: 9,
            background: `${C.accent}18`,
            color: C.accent,
            borderRadius: 3,
            padding: "1px 5px",
            fontWeight: 800
          }
        }, f)), tipos.map(t => React.createElement("span", {
          key: t,
          style: {
            fontSize: 9,
            background: `${C.purple}18`,
            color: C.purple,
            borderRadius: 3,
            padding: "1px 5px",
            fontWeight: 700
          }
        }, t))));
      }))), exp && React.createElement("div", {
        style: {
          borderTop: `1px solid ${C.b0}`,
          padding: "8px 13px 10px"
        }
      }, ubiEntry.posiciones.map((p, i) => {
        const fams = familiasDePos(p.skus);
        const tipos = tipoDeSkus(p.skus);
        const borderCol = p.bajada ? C.green : p.fallo ? C.red : p.urgente ? C.red : C.teal;
        const keyRep = `rep-ruta-${p.turnoId}-${p.posIdx}`;
        const reportandoEste = !!reportandoPos[keyRep];
        const procEste = !!procesando[keyRep];
        return React.createElement("div", {
          key: i,
          style: {
            background: p.bajada ? `${C.green}08` : p.fallo ? `${C.red}08` : C.bg3,
            borderRadius: 10,
            padding: "9px 11px",
            marginBottom: 5,
            borderLeft: `3px solid ${borderCol}`,
            opacity: p.bajada || p.fallo ? 0.65 : 1
          }
        }, React.createElement("div", {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4
          }
        }, React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 0
          }
        }, p.urgente && !p.bajada && React.createElement("span", {
          style: {
            fontSize: 10,
            color: C.red,
            flexShrink: 0
          }
        }, "🚨"), React.createElement("span", {
          style: {
            fontFamily: "'JetBrains Mono',monospace",
            color: p.bajada ? C.green : p.fallo ? C.red : C.teal,
            fontWeight: 800,
            fontSize: 14
          }
        }, p.picking), p.bajada && React.createElement("span", {
          style: {
            color: C.green,
            fontSize: 11,
            fontWeight: 700
          }
        }, "✓ bajado"), p.fallo && React.createElement("span", {
          style: {
            color: C.red,
            fontSize: 10
          }
        }, "⚠ ", p.motivo_fallo || "fallo")), !p.bajada && !p.fallo && !reportandoEste && React.createElement("button", {
          onClick: () => setReportandoPos(r => ({
            ...r,
            [keyRep]: true
          })),
          style: {
            padding: "4px 8px",
            background: `${C.red}15`,
            border: `1px solid ${C.red}30`,
            borderRadius: 6,
            color: C.red,
            fontSize: 14,
            cursor: "pointer",
            fontFamily: "inherit",
            flexShrink: 0
          }
        }, "⚠")), React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginBottom: 4,
            flexWrap: "wrap"
          }
        }, p.operario && React.createElement("span", {
          style: {
            fontSize: 11,
            color: C.t2,
            fontWeight: 600
          }
        }, "👷 ", p.operario), fams.map(f => React.createElement("span", {
          key: f,
          style: {
            background: `${C.accent}18`,
            color: C.accent,
            borderRadius: 3,
            padding: "2px 6px",
            fontSize: 10,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono',monospace"
          }
        }, f)), tipos.map(t => React.createElement("span", {
          key: t,
          style: {
            background: `${C.purple}18`,
            color: C.purple,
            borderRadius: 3,
            padding: "2px 6px",
            fontSize: 10,
            fontWeight: 700
          }
        }, t))), p.cliente && React.createElement("div", {
          style: {
            fontSize: 10,
            color: C.t3,
            marginBottom: !p.bajada && !p.fallo && p.skus.length > 0 ? 5 : 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }
        }, p.cliente), !p.bajada && !p.fallo && !reportandoEste && p.skus.map((s, si) => {
          const tipo2 = s.tipo || (s.desc || "").split(" ")[1] || "";
          return React.createElement("div", {
            key: si,
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "3px 0",
              borderTop: si > 0 ? `1px solid ${C.b0}` : "none"
            }
          }, React.createElement("div", {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 5,
              flexWrap: "wrap"
            }
          }, React.createElement("span", {
            style: {
              fontSize: 8,
              background: `${C.accent}20`,
              color: C.accent,
              borderRadius: 2,
              padding: "0 4px",
              fontWeight: 800
            }
          }, "SKU"), React.createElement("span", {
            style: {
              fontFamily: "'JetBrains Mono',monospace",
              color: C.accent,
              fontSize: 11,
              fontWeight: 700
            }
          }, s.ref), tipo2 && React.createElement("span", {
            style: {
              fontSize: 9,
              background: `${C.purple}18`,
              color: C.purple,
              borderRadius: 3,
              padding: "1px 5px",
              fontWeight: 700
            }
          }, tipo2)), React.createElement("span", {
            style: {
              fontFamily: "'JetBrains Mono',monospace",
              color: C.yellow,
              fontSize: 11,
              fontWeight: 700
            }
          }, s.cant, "u"));
        }), reportandoEste && React.createElement("div", {
          style: {
            background: `${C.red}10`,
            borderRadius: 8,
            padding: "8px 10px",
            marginTop: 4,
            border: `1px solid ${C.red}20`
          }
        }, React.createElement("div", {
          style: {
            fontSize: 10,
            color: C.red,
            fontWeight: 700,
            marginBottom: 7
          }
        }, "¿Qué pasó en ", ubiEntry.ubi, "?"), React.createElement("div", {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 5
          }
        }, [{
          ico: "❓",
          txt: "No encontrada"
        }, {
          ico: "📭",
          txt: "Posición vacía"
        }, {
          ico: "💥",
          txt: "Caja dañada"
        }, {
          ico: "🚧",
          txt: "Acceso bloqueado"
        }, {
          ico: "📋",
          txt: "Diferencia stock"
        }, {
          ico: "✏️",
          txt: "Otro"
        }].map(m => React.createElement("button", {
          key: m.txt,
          onClick: () => {
            marcarFalloPosicion(p.turnoId, p.posIdx, m.ico + " " + m.txt);
            setReportandoPos(r => ({
              ...r,
              [keyRep]: false
            }));
          },
          disabled: procEste,
          style: {
            padding: "8px 6px",
            background: `${C.red}12`,
            border: `1px solid ${C.red}30`,
            borderRadius: 8,
            color: C.red,
            fontSize: 10,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3
          }
        }, React.createElement("span", {
          style: {
            fontSize: 17
          }
        }, m.ico), React.createElement("span", {
          style: {
            fontSize: 9,
            textAlign: "center",
            lineHeight: 1.2
          }
        }, m.txt)))), React.createElement("button", {
          onClick: () => setReportandoPos(r => ({
            ...r,
            [keyRep]: false
          })),
          style: {
            width: "100%",
            padding: "7px",
            background: C.bg3,
            border: `1px solid ${C.b0}`,
            borderRadius: 7,
            color: C.t3,
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
            marginTop: 6
          }
        }, "Cancelar")));
      })), !allDone && React.createElement("div", {
        style: {
          borderTop: `1px solid ${C.b0}`
        }
      }, React.createElement("button", {
        onClick: () => marcarRutaUBI(ubiEntry),
        disabled: proc,
        style: {
          width: "100%",
          padding: "12px",
          background: proc ? C.bg3 : `linear-gradient(135deg,${C.purple},${C.teal})`,
          border: "none",
          borderRadius: "0 0 12px 12px",
          color: proc ? C.t3 : C.bg0,
          fontWeight: 800,
          fontSize: 12,
          cursor: proc ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          transition: "all .2s"
        }
      }, proc ? "Procesando..." : pendPos.length > 1 ? `⬇ Bajar ${pendPos.length} pallets · ${totalUnids}u` : `⬇ Bajar pallet · ${totalUnids}u`)));
    }));
  })()) : (agrupadoPorUBI.length === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      color: C.t3,
      padding: "50px 20px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 40,
      marginBottom: 12
    }
  }, "🎉"), React.createElement("div", {
    style: {
      fontSize: 14
    }
  }, "Sin turnos pendientes")) : React.createElement("div", null, React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 6,
      marginBottom: 10
    }
  }, [{
    l: "Posiciones",
    v: agrupadoPorUBI.length,
    c: C.purple
  }, {
    l: "Pedidos únicos",
    v: new Set(agrupadoPorUBI.flatMap(u => u.posiciones.map(p => p.picking))).size,
    c: C.teal
  }].map(k => React.createElement("div", {
    key: k.l,
    style: {
      background: C.bg2,
      borderRadius: 9,
      padding: "10px",
      textAlign: "center",
      border: `1px solid ${C.b0}`
    }
  }, React.createElement("div", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 24,
      fontWeight: 800,
      color: k.c,
      lineHeight: 1
    }
  }, k.v), React.createElement("div", {
    style: {
      fontSize: 9,
      color: C.t4,
      fontWeight: 700,
      textTransform: "uppercase",
      marginTop: 4
    }
  }, k.l)))), React.createElement("div", {
    style: {
      fontSize: 10,
      color: C.t3,
      marginBottom: 8,
      textAlign: "center"
    }
  }, "Vista de demanda · toma turnos para activar tu ruta"), agrupadoPorUBI.map((ubiEntry, pi) => {
    const isMultiPed = ubiEntry.posiciones.length > 1;
    const tieneUrgente = ubiEntry.posiciones.some(p => p.urgente);
    const totalUnids = ubiEntry.posiciones.reduce((s, p) => p.skus.reduce((u, k) => u + k.cant, s), 0);
    const exp = !!expandido[`grup-${ubiEntry.ubi}`];
    return React.createElement("div", {
      key: ubiEntry.ubi,
      style: {
        background: C.bg2,
        borderRadius: 12,
        marginBottom: 8,
        border: `1px solid ${tieneUrgente ? C.red + "40" : isMultiPed ? C.yellow + "40" : C.b0}`,
        borderLeft: `4px solid ${tieneUrgente ? C.red : isMultiPed ? C.yellow : C.purple}`,
        animation: "fadeUp .2s ease both"
      }
    }, React.createElement("div", {
      onClick: () => setExpandido(o => ({
        ...o,
        [`grup-${ubiEntry.ubi}`]: !o[`grup-${ubiEntry.ubi}`]
      })),
      style: {
        padding: "12px 14px",
        cursor: "pointer"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 6
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: `${isMultiPed ? C.yellow : C.purple}20`,
        color: isMultiPed ? C.yellow : C.purple,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: 11,
        flexShrink: 0
      }
    }, pi + 1), React.createElement("div", null, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        flexWrap: "wrap"
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        color: C.teal,
        fontWeight: 800,
        fontSize: 16
      }
    }, ubiEntry.ubi), tieneUrgente && React.createElement("span", {
      style: {
        background: `${C.red}20`,
        color: C.red,
        borderRadius: 4,
        padding: "1px 5px",
        fontSize: 8,
        fontWeight: 800
      }
    }, "🚨"), isMultiPed && React.createElement("span", {
      style: {
        background: `${C.yellow}20`,
        color: C.yellow,
        borderRadius: 4,
        padding: "1px 6px",
        fontSize: 8,
        fontWeight: 700
      }
    }, ubiEntry.posiciones.length, " pedidos")), React.createElement("div", {
      style: {
        color: C.t3,
        fontSize: 9,
        marginTop: 2
      }
    }, CALLE_NOM[ubiEntry.calleLetra], " · Mód ", ubiEntry.modulo, " · Niv ", ubiEntry.nivel))), React.createElement("div", {
      style: {
        textAlign: "right",
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        color: C.green,
        fontWeight: 800,
        fontSize: 15
      }
    }, totalUnids, "u"), React.createElement("div", {
      style: {
        color: C.t4,
        fontSize: 8
      }
    }, ubiEntry.posiciones.reduce((s, p) => s + p.skus.length, 0), " SKUs")), React.createElement("span", {
      style: {
        color: C.t3,
        fontSize: 14,
        transform: exp ? "rotate(90deg)" : "none",
        transition: "transform .2s"
      }
    }, "▶"))), !exp && React.createElement("div", {
      style: {
        display: "flex",
        gap: 4,
        flexWrap: "wrap"
      }
    }, ubiEntry.posiciones.map((p, i) => React.createElement("span", {
      key: i,
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        background: p.urgente ? `${C.red}15` : C.bg3,
        border: `1px solid ${p.urgente ? C.red + "40" : C.b0}`,
        borderRadius: 4,
        padding: "2px 6px",
        fontSize: 9,
        color: p.urgente ? C.red : C.teal
      }
    }, p.picking)))), exp && React.createElement("div", {
      style: {
        borderTop: `1px solid ${C.b0}`,
        padding: "8px 14px 10px"
      }
    }, ubiEntry.posiciones.map((p, pi2) => React.createElement("div", {
      key: pi2,
      style: {
        background: C.bg3,
        borderRadius: 8,
        padding: "8px 10px",
        marginBottom: 5,
        borderLeft: `3px solid ${p.urgente ? C.red : C.teal}`
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, p.urgente && React.createElement("span", {
      style: {
        fontSize: 9,
        color: C.red,
        fontWeight: 800
      }
    }, "🚨"), React.createElement("span", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        color: C.teal,
        fontWeight: 800,
        fontSize: 12
      }
    }, p.picking)), React.createElement("span", {
      style: {
        color: C.t3,
        fontSize: 10,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 120
      }
    }, p.cliente)), p.skus.map((s, si) => React.createElement("div", {
      key: si,
      style: {
        display: "flex",
        justifyContent: "space-between",
        padding: "2px 0",
        borderTop: si > 0 ? `1px solid ${C.b0}` : "none"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 4
      }
    }, React.createElement("span", {
      style: {
        fontSize: 7,
        background: `${C.accent}20`,
        color: C.accent,
        borderRadius: 2,
        padding: "0 3px",
        fontWeight: 800
      }
    }, "SKU"), React.createElement("span", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        color: C.accent,
        fontSize: 10
      }
    }, s.ref)), React.createElement("span", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        color: C.yellow,
        fontSize: 10,
        fontWeight: 700
      }
    }, s.cant, "u")))))));
  }))))));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(MontacargasApp, null));