/* PRECOMPILADO desde admin.html — NO editar a mano. Regenerar: node scripts/precompile.js */
const {
  useState,
  useEffect,
  useCallback,
  useRef
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
const api = {
  turnos: () => _go(`${SUPA_URL}/rest/v1/turnos?order=fecha_solicitud.desc`, {
    headers: _H
  }),
  asigs: () => _go(`${SUPA_URL}/rest/v1/asignaciones?order=fecha_asignacion.desc`, {
    headers: _H
  }),
  usuarios: () => _go(`${SUPA_URL}/rest/v1/usuarios?order=fecha_login.desc`, {
    headers: _H
  }),
  patchTurno: (id, body) => _go(`${SUPA_URL}/rest/v1/turnos?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      ..._H,
      Prefer: "return=minimal"
    },
    body: JSON.stringify(body)
  }),
  deleteTurno: id => _go(`${SUPA_URL}/rest/v1/turnos?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      ..._H,
      Prefer: "return=minimal"
    }
  }),
  patchAsig: (id, body) => _go(`${SUPA_URL}/rest/v1/asignaciones?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      ..._H,
      Prefer: "return=minimal"
    },
    body: JSON.stringify(body)
  })
};
const CALLE_ORD = {
  B: 1,
  C: 2,
  D: 3,
  E: 4
};
const CALLE_NOM = {
  B: "Calle 1",
  C: "Calle 2",
  D: "Calle 3",
  E: "Calle 4"
};
const ordenarPos = arr => [...(arr || [])].sort((a, b) => (CALLE_ORD[a.calleLetra] || 9) - (CALLE_ORD[b.calleLetra] || 9) || (a.modulo || 0) - (b.modulo || 0));
const fmtHora = ts => {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit"
  });
};
const fmtFecha = ts => {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1} ${fmtHora(ts)}`;
};
const hoy = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const transcurrido = ts => {
  if (!ts) return "";
  const m = Math.round((new Date() - new Date(ts)) / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60 > 0 ? ` ${m % 60}m` : ""}`;
};
const estadoCol = {
  pendiente: C.yellow,
  en_proceso: C.orange,
  completado: C.green,
  liberado: C.t3,
  fallido: C.red
};
const estadoLbl = {
  pendiente: "PEND",
  en_proceso: "EN PROC",
  completado: "COMP",
  liberado: "LIBRE",
  fallido: "FALLO"
};
function AdminApp() {
  const [tab, setTab] = useState("operarios");
  const [turnos, setTurnos] = useState([]);
  const [asigs, setAsigs] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ultimaAct, setUltimaAct] = useState(null);
  const [expandido, setExpandido] = useState({});
  const [editando, setEditando] = useState(null);
  const [procesando, setProcesando] = useState({});
  const [busca, setBusca] = useState("");
  const [filtroEst, setFiltroEst] = useState("todos");
  const timerRef = useRef(null);
  const autoLimpiar = async () => {
    const cutoff8h = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
    const {
      data: viejos
    } = await _go(`${SUPA_URL}/rest/v1/turnos?estado=in.(completado,fallido)&fecha_completado=lt.${cutoff8h}&select=id,picking`);
    if (viejos?.length) {
      const ids = viejos.map(t => t.id).join(",");
      await _go(`${SUPA_URL}/rest/v1/turnos?id=in.(${ids})`, {
        method: "DELETE",
        headers: {
          ..._H,
          Prefer: "return=minimal"
        }
      });
      const picks = viejos.map(t => t.picking).filter(Boolean).join(",");
      if (picks) await _go(`${SUPA_URL}/rest/v1/asignaciones?picking=in.(${picks})`, {
        method: "DELETE",
        headers: {
          ..._H,
          Prefer: "return=minimal"
        }
      });
    }
    const cutoff5h = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    await _go(`${SUPA_URL}/rest/v1/asignaciones?estado=eq.en_proceso&fecha_asignacion=lt.${cutoff5h}`, {
      method: "PATCH",
      headers: {
        ..._H,
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        estado: "completado",
        fecha_completado: new Date().toISOString()
      })
    });
  };
  const refrescar = useCallback(async () => {
    await autoLimpiar();
    const [rT, rA, rU] = await Promise.all([api.turnos(), api.asigs(), api.usuarios()]);
    if (rT.data) setTurnos(rT.data);
    if (rA.data) setAsigs(rA.data);
    if (rU.data) setUsuarios(rU.data);
    setUltimaAct(new Date());
    setCargando(false);
  }, []);
  useEffect(() => {
    refrescar();
    timerRef.current = setInterval(refrescar, 30000);
    return () => clearInterval(timerRef.current);
  }, [refrescar]);
  const hoyCut = hoy();
  const nOperariosActivos = new Set(asigs.filter(a => a.estado === "en_proceso").map(a => a.operario)).size;
  const nPedidosEnCurso = asigs.filter(a => a.estado === "en_proceso").length;
  const nTurnosPend = turnos.filter(t => t.estado === "pendiente" && !(t.picking || "").startsWith("UBI-")).length;
  const nCompletadosHoy = turnos.filter(t => t.estado === "completado" && t.fecha_completado && new Date(t.fecha_completado) >= hoyCut).length;
  const nFallidos = turnos.filter(t => t.estado === "fallido").length;
  const nUBI = turnos.filter(t => (t.picking || "").startsWith("UBI-") && (t.estado === "pendiente" || t.estado === "en_proceso")).length;
  const avgMinHoy = (() => {
    const c = turnos.filter(t => t.estado === "completado" && t.fecha_completado && t.fecha_solicitud && new Date(t.fecha_completado) >= hoyCut);
    if (!c.length) return null;
    const avg = c.reduce((s, t) => (new Date(t.fecha_completado) - new Date(t.fecha_solicitud)) / 60000 + s, 0) / c.length;
    return Math.round(avg);
  })();
  const priorizarTurno = async id => {
    setProcesando(p => ({
      ...p,
      [id]: true
    }));
    await api.patchTurno(id, {
      prioridad: "urgente",
      es_mde: true
    });
    await refrescar();
    setProcesando(p => ({
      ...p,
      [id]: false
    }));
  };
  const cancelarTurno = async id => {
    if (!window.confirm("¿Cancelar este turno?")) return;
    setProcesando(p => ({
      ...p,
      [id]: true
    }));
    const turno = turnos.find(t => t.id === id);
    await api.patchTurno(id, {
      estado: "completado",
      fecha_completado: new Date().toISOString(),
      montacarguista: "[Admin-cancelado]"
    });
    if (turno?.picking) {
      await _go(`${SUPA_URL}/rest/v1/asignaciones?picking=eq.${encodeURIComponent(turno.picking)}`, {
        method: "PATCH",
        headers: {
          ..._H,
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          estado: "liberado",
          fecha_completado: new Date().toISOString()
        })
      });
    }
    await refrescar();
    setProcesando(p => ({
      ...p,
      [id]: false
    }));
  };
  const eliminarTurno = async id => {
    if (!window.confirm("¿Eliminar este turno permanentemente?")) return;
    setProcesando(p => ({
      ...p,
      [id]: true
    }));
    await api.deleteTurno(id);
    await refrescar();
    setProcesando(p => ({
      ...p,
      [id]: false
    }));
  };
  const reintentarTurno = async id => {
    setProcesando(p => ({
      ...p,
      [id]: true
    }));
    await api.patchTurno(id, {
      estado: "pendiente",
      motivo_fallo: null,
      fecha_completado: null,
      montacarguista: null
    });
    await refrescar();
    setProcesando(p => ({
      ...p,
      [id]: false
    }));
  };
  const limpiarTodo = async () => {
    if (!window.confirm("¿Eliminar todos los turnos completados y fallidos?\nEsta acción no se puede deshacer.")) return;
    const {
      data: doneT
    } = await _go(`${SUPA_URL}/rest/v1/turnos?estado=in.(completado,fallido)&select=id,picking`);
    await _go(`${SUPA_URL}/rest/v1/turnos?estado=in.(completado,fallido)`, {
      method: "DELETE",
      headers: {
        ..._H,
        Prefer: "return=minimal"
      }
    });
    if (doneT?.length) {
      const picklist = doneT.map(t => t.picking).join(",");
      if (picklist) await _go(`${SUPA_URL}/rest/v1/asignaciones?picking=in.(${picklist})`, {
        method: "DELETE",
        headers: {
          ..._H,
          Prefer: "return=minimal"
        }
      });
    }
    await refrescar();
  };
  const liberarPedido = async id => {
    setProcesando(p => ({
      ...p,
      [id]: true
    }));
    await api.patchAsig(id, {
      estado: "liberado",
      fecha_completado: new Date().toISOString()
    });
    await refrescar();
    setProcesando(p => ({
      ...p,
      [id]: false
    }));
  };
  const completarPedido = async id => {
    setProcesando(p => ({
      ...p,
      [id]: true
    }));
    await api.patchAsig(id, {
      estado: "completado",
      fecha_completado: new Date().toISOString()
    });
    await refrescar();
    setProcesando(p => ({
      ...p,
      [id]: false
    }));
  };
  const completarVencidos = async () => {
    const vencidas = asigs.filter(a => a.estado === "en_proceso" && (new Date() - new Date(a.fecha_asignacion)) / 3600000 > 5);
    if (!vencidas.length) return;
    if (!window.confirm(`¿Marcar como completados los ${vencidas.length} pedido${vencidas.length !== 1 ? "s" : ""} con más de 5h en proceso?`)) return;
    const ids = vencidas.map(a => a.id).join(",");
    await _go(`${SUPA_URL}/rest/v1/asignaciones?id=in.(${ids})`, {
      method: "PATCH",
      headers: {
        ..._H,
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        estado: "completado",
        fecha_completado: new Date().toISOString()
      })
    });
    await refrescar();
  };
  const reasignarPedido = async (id, nuevoOperario) => {
    setProcesando(p => ({
      ...p,
      [id]: true
    }));
    await api.patchAsig(id, {
      operario: nuevoOperario
    });
    await refrescar();
    setEditando(null);
    setProcesando(p => ({
      ...p,
      [id]: false
    }));
  };
  const operariosActivos = (() => {
    const map = {};
    asigs.filter(a => a.estado === "en_proceso").forEach(a => {
      const key = (a.operario || "").toLowerCase().trim();
      if (!map[key]) map[key] = {
        nombre: a.operario,
        pedidos: [],
        turnosPend: 0
      };
      map[key].pedidos.push(a);
    });
    turnos.filter(t => t.estado === "pendiente").forEach(t => {
      const key = (t.operario_solicitante || "").toLowerCase().trim();
      if (map[key]) map[key].turnosPend++;
    });
    const recientes = usuarios.filter(u => {
      const diff = (new Date() - new Date(u.fecha_login)) / 1000 / 60;
      return u.rol === "operario" && diff < 240;
    });
    recientes.forEach(u => {
      const key = (u.nombre || "").toLowerCase().trim();
      if (!map[key]) map[key] = {
        nombre: u.nombre,
        pedidos: [],
        turnosPend: 0,
        soloLogin: true
      };
    });
    return Object.values(map).sort((a, b) => b.pedidos.length - a.pedidos.length);
  })();
  const montacarguistasActivos = (() => {
    const map = {};
    usuarios.forEach(u => {
      if (u.rol !== "montacarguista") return;
      const diff = (new Date() - new Date(u.fecha_login)) / 1000 / 60;
      if (diff >= 240) return;
      const key = (u.nombre || "").toLowerCase().trim();
      if (!map[key] || new Date(u.fecha_login) > new Date(map[key].fecha_login)) map[key] = u;
    });
    return Object.values(map);
  })();
  if (cargando) return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      gap: 14
    }
  }, React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      border: `3px solid ${C.b1}`,
      borderTopColor: C.accent,
      borderRadius: "50%",
      animation: "spin 1s linear infinite"
    }
  }), React.createElement("div", {
    style: {
      color: C.t3,
      fontSize: 13
    }
  }, "Cargando panel..."));
  return React.createElement("div", {
    style: {
      minHeight: "100vh",
      paddingBottom: 24
    }
  }, React.createElement("div", {
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
      background: "linear-gradient(135deg,#3b82f6,#2dd4bf)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18
    }
  }, "⚙️"), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 15
    }
  }, "PANEL ADMIN"), React.createElement("div", {
    style: {
      color: C.t3,
      fontSize: 10
    }
  }, "INDUCASOS · CEDI ITAGUÍ", ultimaAct ? ` · act. ${fmtHora(ultimaAct)}` : "")), React.createElement("button", {
    onClick: limpiarTodo,
    title: "Eliminar completados y fallidos",
    style: {
      background: `${C.red}12`,
      border: `1px solid ${C.red}30`,
      color: C.red,
      borderRadius: 8,
      padding: "7px 10px",
      fontSize: 13,
      cursor: "pointer"
    }
  }, "🗑"), React.createElement("button", {
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
  }, "↻")), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 5,
      marginBottom: 5
    }
  }, [{
    l: "Operarios",
    v: nOperariosActivos,
    c: C.teal,
    ico: "👷"
  }, {
    l: "Pedidos",
    v: nPedidosEnCurso,
    c: C.accent,
    ico: "📦"
  }, {
    l: "T. Pend.",
    v: nTurnosPend,
    c: nTurnosPend > 0 ? C.yellow : C.t4,
    ico: "⏳"
  }].map(k => React.createElement("div", {
    key: k.l,
    style: {
      background: C.bg2,
      borderRadius: 9,
      padding: "8px 4px",
      textAlign: "center",
      border: `1px solid ${C.b0}`
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13
    }
  }, k.ico), React.createElement("div", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 20,
      fontWeight: 800,
      color: k.c,
      lineHeight: 1.1
    }
  }, k.v), React.createElement("div", {
    style: {
      fontSize: 7,
      color: C.t4,
      fontWeight: 700,
      textTransform: "uppercase",
      marginTop: 2
    }
  }, k.l)))), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 5,
      marginBottom: 10
    }
  }, [{
    l: "Comp. Hoy",
    v: nCompletadosHoy,
    c: C.green,
    ico: "✅",
    sub: avgMinHoy != null ? `~${avgMinHoy}m prom.` : null
  }, {
    l: "Fallidos",
    v: nFallidos,
    c: nFallidos > 0 ? C.red : C.t4,
    ico: "⚠️",
    sub: null
  }, {
    l: "UBI activas",
    v: nUBI,
    c: nUBI > 0 ? C.purple : C.t4,
    ico: "⬇",
    sub: null
  }].map(k => React.createElement("div", {
    key: k.l,
    style: {
      background: C.bg2,
      borderRadius: 9,
      padding: "8px 4px",
      textAlign: "center",
      border: `1px solid ${k.v > 0 ? k.c + "30" : C.b0}`
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13
    }
  }, k.ico), React.createElement("div", {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 20,
      fontWeight: 800,
      color: k.c,
      lineHeight: 1.1
    }
  }, k.v), React.createElement("div", {
    style: {
      fontSize: 7,
      color: C.t4,
      fontWeight: 700,
      textTransform: "uppercase",
      marginTop: 2
    }
  }, k.l), k.sub && React.createElement("div", {
    style: {
      fontSize: 7,
      color: k.c,
      fontWeight: 600,
      marginTop: 1,
      opacity: .8
    }
  }, k.sub)))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 5
    }
  }, [{
    key: "operarios",
    lbl: "👷 Operarios"
  }, {
    key: "turnos",
    lbl: "🏗️ Turnos"
  }, {
    key: "asignaciones",
    lbl: "📋 Pedidos"
  }, {
    key: "metricas",
    lbl: "📊 Métricas"
  }].map(t => React.createElement("button", {
    key: t.key,
    onClick: () => setTab(t.key),
    style: {
      flex: 1,
      padding: "8px 4px",
      borderRadius: 9,
      border: `1px solid ${tab === t.key ? C.accent : C.b0}`,
      background: tab === t.key ? `${C.accent}18` : C.bg2,
      color: tab === t.key ? C.accent : C.t3,
      fontWeight: 700,
      fontSize: 10,
      cursor: "pointer"
    }
  }, t.lbl)))), (() => {
    const demorados = turnos.filter(t => t.estado === "pendiente" && (new Date() - new Date(t.fecha_solicitud)) / 60000 > 20);
    if (!demorados.length) return null;
    return React.createElement("div", {
      style: {
        margin: "8px 12px 0",
        background: `${C.red}12`,
        border: `1px solid ${C.red}40`,
        borderRadius: 11,
        padding: "10px 13px",
        animation: "fadeUp .2s ease both"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        marginBottom: 7
      }
    }, React.createElement("span", {
      style: {
        fontSize: 16
      }
    }, "🚨"), React.createElement("span", {
      style: {
        fontSize: 10,
        color: C.red,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: .5
      }
    }, demorados.length, " turno", demorados.length !== 1 ? "s" : "", " demorado", demorados.length !== 1 ? "s" : "", " (>20 min)")), demorados.map(t => {
      const min = Math.round((new Date() - new Date(t.fecha_solicitud)) / 60000);
      const esUBI = (t.picking || "").startsWith("UBI-");
      return React.createElement("div", {
        key: t.id,
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "5px 0",
          borderTop: `1px solid ${C.red}20`
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6
        }
      }, esUBI && React.createElement("span", {
        style: {
          background: `${C.purple}20`,
          color: C.purple,
          borderRadius: 3,
          padding: "0 4px",
          fontSize: 7,
          fontWeight: 800
        }
      }, "UBI"), React.createElement("span", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: esUBI ? C.purple : C.teal,
          fontWeight: 700,
          fontSize: 12
        }
      }, t.picking), React.createElement("span", {
        style: {
          fontSize: 9,
          color: C.t3
        }
      }, "👷 ", t.operario_solicitante || "—")), React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6
        }
      }, React.createElement("span", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: C.red,
          fontWeight: 800,
          fontSize: 11
        }
      }, min, "m"), React.createElement("button", {
        onClick: () => {
          setTab("turnos");
          setFiltroEst("pendiente");
        },
        style: {
          padding: "3px 7px",
          background: `${C.red}20`,
          border: `1px solid ${C.red}40`,
          borderRadius: 5,
          color: C.red,
          fontSize: 9,
          fontWeight: 700,
          cursor: "pointer"
        }
      }, "Ver")));
    }));
  })(), React.createElement("div", {
    style: {
      padding: "12px 12px 0"
    }
  }, tab === "operarios" && React.createElement("div", null, montacarguistasActivos.length > 0 && React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 7
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      color: C.purple,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 1
    }
  }, "🏗️ Montacarguistas activos"), React.createElement("div", {
    style: {
      fontSize: 9,
      color: C.t4
    }
  }, montacarguistasActivos.length, " conectado", montacarguistasActivos.length !== 1 ? "s" : "")), montacarguistasActivos.map(u => {
    const nombre = u.nombre;
    const enProceso = turnos.filter(t => t.montacarguista === nombre && t.estado === "en_proceso").sort((a, b) => (b.es_mde ? 1 : 0) - (a.es_mde ? 1 : 0));
    const completadosHoy = turnos.filter(t => t.montacarguista === nombre && t.estado === "completado" && t.fecha_completado && new Date(t.fecha_completado) >= hoyCut);
    const avgMcMin = completadosHoy.length > 0 ? Math.round(completadosHoy.filter(t => t.fecha_solicitud).reduce((s, t) => (new Date(t.fecha_completado) - new Date(t.fecha_solicitud)) / 60000 + s, 0) / completadosHoy.length) : null;
    const ultimoMcTs = completadosHoy.map(t => t.fecha_completado).filter(Boolean).sort().pop();
    const libre = enProceso.length === 0;
    const accentCol = libre ? C.green : C.orange;
    const expKey = `mc-${nombre}`;
    const exp = !!expandido[expKey];
    return React.createElement("div", {
      key: nombre,
      style: {
        background: C.bg2,
        borderRadius: 13,
        marginBottom: 8,
        border: `1px solid ${libre ? C.b0 : C.orange + "30"}`,
        borderLeft: `4px solid ${accentCol}`,
        animation: "fadeUp .2s ease both"
      }
    }, React.createElement("div", {
      onClick: () => setExpandido(o => ({
        ...o,
        [expKey]: !o[expKey]
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
        marginBottom: enProceso.length > 0 ? 8 : 0
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 9
      }
    }, React.createElement("div", {
      style: {
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "linear-gradient(135deg,#a855f7,#3b82f6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 17,
        flexShrink: 0
      }
    }, "🏗️"), React.createElement("div", null, React.createElement("div", {
      style: {
        fontWeight: 800,
        fontSize: 14,
        color: C.t1,
        textTransform: "capitalize"
      }
    }, nombre), React.createElement("div", {
      style: {
        fontSize: 9,
        color: C.t3
      }
    }, libre ? "Libre" : enProceso.length === 1 ? "1 turno activo" : `${enProceso.length} turnos activos`, " · hace ", transcurrido(u.fecha_login)))), React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, React.createElement("div", {
      style: {
        textAlign: "center",
        background: C.bg3,
        borderRadius: 7,
        padding: "4px 9px",
        border: `1px solid ${enProceso.length > 0 ? C.orange + "30" : C.b0}`
      }
    }, React.createElement("div", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 15,
        fontWeight: 800,
        color: enProceso.length > 0 ? C.orange : C.t4,
        lineHeight: 1
      }
    }, enProceso.length), React.createElement("div", {
      style: {
        fontSize: 7,
        color: C.t4,
        textTransform: "uppercase",
        marginTop: 1
      }
    }, "activos")), React.createElement("div", {
      style: {
        textAlign: "center",
        background: C.bg3,
        borderRadius: 7,
        padding: "4px 9px",
        border: `1px solid ${completadosHoy.length > 0 ? C.green + "30" : C.b0}`
      }
    }, React.createElement("div", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 15,
        fontWeight: 800,
        color: completadosHoy.length > 0 ? C.green : C.t4,
        lineHeight: 1
      }
    }, completadosHoy.length), React.createElement("div", {
      style: {
        fontSize: 7,
        color: C.t4,
        textTransform: "uppercase",
        marginTop: 1
      }
    }, "hoy"), avgMcMin != null && React.createElement("div", {
      style: {
        fontSize: 7,
        color: C.green,
        fontWeight: 600,
        marginTop: 1
      }
    }, "~", avgMcMin, "m")), (completadosHoy.length > 0 || enProceso.length > 0) && React.createElement("span", {
      style: {
        color: C.t3,
        fontSize: 13,
        transform: exp ? "rotate(90deg)" : "none",
        transition: "transform .2s"
      }
    }, "▶"))), enProceso.map((t, ti) => {
      const pos = t.posiciones || [];
      const nBaj = pos.filter(p => p.bajada).length;
      const nFallo = pos.filter(p => p.fallo).length;
      const nHecho = nBaj + nFallo;
      const pct = pos.length > 0 ? Math.round(nHecho / pos.length * 100) : 0;
      const col = pct === 100 ? C.green : C.orange;
      const lastAction = pos.map(p => p.bajada_ts || p.fallo_ts).filter(Boolean).sort().pop();
      const esUBI = (t.picking || "").startsWith("UBI-");
      return React.createElement("div", {
        key: t.id,
        onClick: e => {
          e.stopPropagation();
          setTab("turnos");
          setExpandido(o => ({
            ...o,
            [`t-${t.id}`]: true
          }));
        },
        style: {
          marginTop: ti === 0 ? 2 : 4,
          background: C.bg3,
          borderRadius: 8,
          padding: "6px 9px",
          border: `1px solid ${C.b0}`,
          cursor: "pointer"
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
          gap: 5,
          minWidth: 0,
          flex: 1
        }
      }, esUBI && React.createElement("span", {
        style: {
          background: `${C.purple}20`,
          color: C.purple,
          borderRadius: 3,
          padding: "0 4px",
          fontSize: 7,
          fontWeight: 800,
          flexShrink: 0
        }
      }, "UBI"), React.createElement("span", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: esUBI ? C.purple : C.teal,
          fontSize: 11,
          fontWeight: 800,
          flexShrink: 0
        }
      }, t.picking), (t.es_mde || t.prioridad === "urgente") && React.createElement("span", {
        style: {
          background: `${C.red}20`,
          color: C.red,
          borderRadius: 3,
          padding: "0 4px",
          fontSize: 7,
          fontWeight: 800,
          flexShrink: 0
        }
      }, "🚨"), React.createElement("span", {
        style: {
          color: C.t4,
          fontSize: 9,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, (t.cliente || "").slice(0, 18))), React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0
        }
      }, React.createElement("span", {
        style: {
          color: C.t4,
          fontSize: 8
        }
      }, lastAction ? fmtHora(lastAction) : transcurrido(t.fecha_solicitud)), React.createElement("span", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: col,
          fontSize: 12,
          fontWeight: 800
        }
      }, pct, "%"))), React.createElement("div", {
        style: {
          height: 5,
          background: C.b0,
          borderRadius: 3,
          overflow: "hidden",
          marginBottom: 3
        }
      }, React.createElement("div", {
        style: {
          height: "100%",
          width: `${pct}%`,
          background: pct === 100 ? col : `linear-gradient(90deg,${col}80,${col})`,
          borderRadius: 3,
          transition: "width .5s",
          boxShadow: pct > 0 ? `0 0 6px ${col}50` : "none"
        }
      })), React.createElement("div", {
        style: {
          fontSize: 8,
          color: C.t4
        }
      }, nBaj, " bajada", nBaj !== 1 ? "s" : "", nFallo > 0 ? ` · ${nFallo} fallo${nFallo !== 1 ? "s" : ""}` : "", "  /  ", pos.length, " pos."));
    }), libre && completadosHoy.length > 0 && React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 9,
        color: C.green,
        fontWeight: 600
      }
    }, "✓ Completó ", completadosHoy.length, " turno", completadosHoy.length !== 1 ? "s" : "", " hoy")), exp && completadosHoy.length > 0 && React.createElement("div", {
      style: {
        borderTop: `1px solid ${C.b0}`,
        padding: "7px 13px 10px"
      }
    }, React.createElement("div", {
      style: {
        fontSize: 8,
        color: C.green,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: ".5px",
        marginBottom: 6
      }
    }, "✅ Completados hoy"), completadosHoy.map(t => {
      const nFallo = (t.posiciones || []).filter(p => p.fallo).length;
      const esUBI = (t.picking || "").startsWith("UBI-");
      return React.createElement("div", {
        key: t.id,
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "4px 0",
          borderBottom: `1px solid ${C.b0}`
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 5
        }
      }, esUBI && React.createElement("span", {
        style: {
          background: `${C.purple}20`,
          color: C.purple,
          borderRadius: 3,
          padding: "0 4px",
          fontSize: 7,
          fontWeight: 800
        }
      }, "UBI"), React.createElement("span", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: esUBI ? C.purple : C.teal,
          fontSize: 10,
          fontWeight: 700
        }
      }, t.picking), nFallo > 0 && React.createElement("span", {
        style: {
          background: `${C.orange}20`,
          color: C.orange,
          borderRadius: 3,
          padding: "0 4px",
          fontSize: 7,
          fontWeight: 700
        }
      }, nFallo, " fallo", nFallo !== 1 ? "s" : "")), React.createElement("span", {
        style: {
          fontSize: 9,
          color: C.t4,
          flexShrink: 0
        }
      }, fmtHora(t.fecha_completado)));
    })));
  })), React.createElement("div", {
    style: {
      fontSize: 10,
      color: C.teal,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 6
    }
  }, "👷 Operarios de picking"), operariosActivos.length === 0 && React.createElement("div", {
    style: {
      textAlign: "center",
      color: C.t3,
      padding: "30px 20px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 32,
      marginBottom: 8
    }
  }, "😴"), React.createElement("div", {
    style: {
      fontSize: 13
    }
  }, "Sin operarios activos")), operariosActivos.map((op, i) => React.createElement("div", {
    key: i,
    style: {
      background: C.bg2,
      borderRadius: 12,
      marginBottom: 8,
      border: `1px solid ${op.pedidos.length > 0 ? C.teal + "30" : C.b0}`,
      borderLeft: `4px solid ${op.pedidos.length > 0 ? C.teal : C.t4}`,
      animation: "fadeUp .2s ease both"
    }
  }, React.createElement("div", {
    onClick: () => setExpandido(o => ({
      ...o,
      [`op-${op.nombre}`]: !o[`op-${op.nombre}`]
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
      marginBottom: 5
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: "50%",
      background: `${C.teal}20`,
      color: C.teal,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 800,
      fontSize: 13
    }
  }, op.nombre.charAt(0).toUpperCase()), React.createElement("div", null, React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      color: C.t1
    }
  }, op.nombre), React.createElement("div", {
    style: {
      fontSize: 10,
      color: C.t3
    }
  }, op.pedidos.length > 0 ? `${op.pedidos.length} pedido${op.pedidos.length !== 1 ? "s" : ""} asignado${op.pedidos.length !== 1 ? "s" : ""}` : op.soloLogin ? "En sesión · sin pedidos" : "Inactivo"))), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, op.turnosPend > 0 && React.createElement("span", {
    style: {
      background: `${C.yellow}20`,
      color: C.yellow,
      borderRadius: 4,
      padding: "1px 6px",
      fontSize: 8,
      fontWeight: 700
    }
  }, op.turnosPend, " turno", op.turnosPend !== 1 ? "s" : ""), op.pedidos.length > 0 && React.createElement("span", {
    style: {
      color: C.t3,
      fontSize: 14,
      transform: expandido[`op-${op.nombre}`] ? "rotate(90deg)" : "none",
      transition: "transform .2s"
    }
  }, "▶"))), op.pedidos.length > 0 && React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      flexWrap: "wrap"
    }
  }, op.pedidos.map((a, ai) => React.createElement("span", {
    key: ai,
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      background: C.bg3,
      border: `1px solid ${C.b0}`,
      borderRadius: 4,
      padding: "2px 7px",
      fontSize: 9,
      color: C.teal
    }
  }, a.picking))), (() => {
    const opKey = (op.nombre || "").toLowerCase().trim();
    const compHoyOp = asigs.filter(a => a.estado === "completado" && (a.operario || "").toLowerCase().trim() === opKey && a.fecha_completado && new Date(a.fecha_completado) >= hoyCut);
    const ultimoOp = compHoyOp.map(a => a.fecha_completado).filter(Boolean).sort().pop();
    if (!compHoyOp.length) return null;
    return React.createElement("div", {
      style: {
        marginTop: 5,
        padding: "4px 8px",
        background: C.bg3,
        borderRadius: 6,
        display: "flex",
        gap: 12,
        fontSize: 9,
        color: C.t3,
        flexWrap: "wrap"
      }
    }, React.createElement("span", {
      style: {
        color: C.green
      }
    }, "✅ ", compHoyOp.length, " completado", compHoyOp.length !== 1 ? "s" : "", " hoy"), ultimoOp && React.createElement("span", null, "🕐 Último: ", fmtHora(ultimoOp)));
  })()), expandido[`op-${op.nombre}`] && op.pedidos.map((a, ai) => {
    const horas = (new Date() - new Date(a.fecha_asignacion)) / 3600000;
    const vencida = horas > 5;
    const demorada = horas > 2 && !vencida;
    const pickCol = vencida ? C.red : demorada ? C.orange : C.teal;
    return React.createElement("div", {
      key: ai,
      style: {
        borderTop: `1px solid ${vencida ? C.red + "30" : demorada ? C.orange + "25" : C.b0}`,
        padding: "8px 13px",
        background: vencida ? `${C.red}06` : demorada ? `${C.orange}05` : "transparent"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 3
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6
      }
    }, React.createElement("span", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        color: pickCol,
        fontWeight: 700,
        fontSize: 12
      }
    }, a.picking), vencida && React.createElement("span", {
      style: {
        background: `${C.red}20`,
        color: C.red,
        borderRadius: 3,
        padding: "0 5px",
        fontSize: 7,
        fontWeight: 800
      }
    }, "VENCIDO"), demorada && React.createElement("span", {
      style: {
        background: `${C.orange}20`,
        color: C.orange,
        borderRadius: 3,
        padding: "0 5px",
        fontSize: 7,
        fontWeight: 800
      }
    }, "DEMORADO")), React.createElement("span", {
      style: {
        fontSize: 10,
        color: vencida ? C.red : demorada ? C.orange : C.t3,
        fontWeight: vencida || demorada ? 700 : 400
      }
    }, "desde ", fmtHora(a.fecha_asignacion), " · ", transcurrido(a.fecha_asignacion))), React.createElement("div", {
      style: {
        color: C.t2,
        fontSize: 11,
        marginBottom: 6,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, a.cliente), React.createElement("div", {
      style: {
        display: "flex",
        gap: 6
      }
    }, !vencida && React.createElement("button", {
      onClick: () => setEditando(`asig-${a.id}`),
      style: {
        flex: 1,
        padding: "6px",
        background: C.bg3,
        border: `1px solid ${C.b0}`,
        borderRadius: 7,
        color: C.t2,
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, "✏️ Reasignar"), vencida ? React.createElement("button", {
      onClick: () => completarPedido(a.id),
      disabled: !!procesando[a.id],
      style: {
        flex: 1,
        padding: "8px",
        background: `${C.green}20`,
        border: `1px solid ${C.green}40`,
        borderRadius: 7,
        color: C.green,
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer"
      }
    }, "✅ Completar") : React.createElement("button", {
      onClick: () => liberarPedido(a.id),
      disabled: !!procesando[a.id],
      style: {
        flex: 1,
        padding: "6px",
        background: `${C.orange}15`,
        border: `1px solid ${C.orange}30`,
        borderRadius: 7,
        color: C.orange,
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, "🔓 Liberar")), editando === `asig-${a.id}` && React.createElement(ReasignarForm, {
      operarioActual: a.operario,
      operariosDisp: [...new Set([...operariosActivos.map(o => o.nombre), ...usuarios.filter(u => u.rol === "operario").map(u => u.nombre)])].filter(Boolean).sort(),
      onGuardar: n => reasignarPedido(a.id, n),
      onCancelar: () => setEditando(null)
    }));
  })))), tab === "turnos" && React.createElement("div", null, React.createElement("input", {
    value: busca,
    onChange: e => setBusca(e.target.value),
    placeholder: "🔍 Buscar por picking, cliente u operario...",
    style: {
      width: "100%",
      background: C.bg3,
      color: C.t1,
      border: `1px solid ${C.b1}`,
      borderRadius: 11,
      padding: "11px 13px",
      fontSize: 13,
      marginBottom: 10
    }
  }), React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      marginBottom: 10,
      flexWrap: "wrap"
    }
  }, [{
    k: "todos",
    lbl: "Todos",
    ico: ""
  }, {
    k: "pendiente",
    lbl: "Pendiente",
    ico: "⏳"
  }, {
    k: "en_proceso",
    lbl: "En proceso",
    ico: "🔄"
  }, {
    k: "completado",
    lbl: "Completado",
    ico: "✅"
  }, {
    k: "fallido",
    lbl: "Fallido",
    ico: "⚠️"
  }].map(f => {
    const col = {
      pendiente: C.yellow,
      en_proceso: C.orange,
      completado: C.green,
      fallido: C.red,
      todos: C.accent
    }[f.k];
    const cnt = f.k === "todos" ? turnos.filter(t => !(t.picking || "").startsWith("UBI-")).length : turnos.filter(t => t.estado === f.k && !(t.picking || "").startsWith("UBI-")).length;
    const sel = filtroEst === f.k;
    return React.createElement("button", {
      key: f.k,
      onClick: () => setFiltroEst(f.k),
      style: {
        padding: "5px 9px",
        borderRadius: 8,
        border: `1px solid ${sel ? col : C.b0}`,
        background: sel ? `${col}20` : C.bg2,
        color: sel ? col : C.t3,
        fontSize: 10,
        fontWeight: 700,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4
      }
    }, f.ico && React.createElement("span", null, f.ico), React.createElement("span", null, f.lbl), React.createElement("span", {
      style: {
        background: sel ? `${col}35` : C.bg3,
        borderRadius: 5,
        padding: "0 5px",
        fontSize: 9,
        fontWeight: 800,
        color: sel ? col : C.t4
      }
    }, cnt));
  })), (filtroEst === "todos" || filtroEst === "pendiente" || filtroEst === "en_proceso" || filtroEst === "completado" || filtroEst === "fallido") && (() => {
    const q = busca.trim().toLowerCase();
    const ubiTurnos = turnos.filter(t => (t.picking || "").startsWith("UBI-")).filter(t => filtroEst === "todos" || t.estado === filtroEst).filter(t => !q || (t.picking || "").toLowerCase().includes(q) || (t.cliente || "").toLowerCase().includes(q) || (t.operario_solicitante || "").toLowerCase().includes(q)).sort((a, b) => new Date(b.fecha_solicitud) - new Date(a.fecha_solicitud));
    if (ubiTurnos.length === 0) return null;
    const activas = ubiTurnos.filter(t => t.estado === "pendiente" || t.estado === "en_proceso");
    return React.createElement("div", {
      style: {
        marginBottom: 16
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        marginBottom: 7
      }
    }, React.createElement("span", {
      style: {
        fontSize: 10,
        color: C.purple,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1
      }
    }, "⬇ Bajadas UBI"), activas.length > 0 && React.createElement("span", {
      style: {
        background: `${C.purple}20`,
        color: C.purple,
        borderRadius: 10,
        padding: "1px 7px",
        fontSize: 9,
        fontWeight: 700
      }
    }, activas.length, " activa", activas.length !== 1 ? "s" : "")), ubiTurnos.map(t => {
      const col = {
        pendiente: C.yellow,
        en_proceso: C.orange,
        completado: C.green,
        fallido: C.red
      }[t.estado] || C.t3;
      const ubi = (t.picking || "").replace("UBI-", "");
      const skus = ((t.posiciones || [])[0] || {}).skus || [];
      const elapsed = transcurrido(t.fecha_solicitud);
      const demorado = t.estado === "pendiente" && (new Date() - new Date(t.fecha_solicitud)) / 60000 > 20;
      const lbl = {
        pendiente: "⏳ Pendiente",
        en_proceso: "🔄 En proceso",
        completado: "✅ Listo",
        fallido: "⚠ Fallo"
      }[t.estado] || t.estado;
      return React.createElement("div", {
        key: t.id,
        style: {
          background: C.bg2,
          borderRadius: 10,
          marginBottom: 6,
          border: `1px solid ${demorado ? C.red + "40" : col + "25"}`,
          borderLeft: `4px solid ${demorado ? C.red : col}`,
          animation: "fadeUp .2s ease both",
          padding: "9px 12px"
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 5
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
          color: C.purple,
          fontWeight: 800,
          fontSize: 15
        }
      }, ubi), React.createElement("span", {
        style: {
          background: `${col}20`,
          color: col,
          borderRadius: 4,
          padding: "1px 6px",
          fontSize: 8,
          fontWeight: 700,
          border: `1px solid ${col}40`
        }
      }, lbl), demorado && React.createElement("span", {
        style: {
          background: `${C.red}20`,
          color: C.red,
          borderRadius: 4,
          padding: "1px 5px",
          fontSize: 7,
          fontWeight: 800
        }
      }, "DEMORADO")), React.createElement("div", {
        style: {
          textAlign: "right",
          flexShrink: 0,
          marginLeft: 8
        }
      }, React.createElement("div", {
        style: {
          fontSize: 9,
          color: demorado ? C.red : C.t4
        }
      }, elapsed), t.montacarguista && React.createElement("div", {
        style: {
          fontSize: 9,
          color: C.purple,
          marginTop: 1
        }
      }, "🏗️ ", t.montacarguista))), React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: skus.length ? 5 : 0
        }
      }, React.createElement("span", {
        style: {
          fontSize: 9,
          color: C.t3
        }
      }, "👷 ", t.operario_solicitante || "—"), React.createElement("div", {
        style: {
          display: "flex",
          gap: 3,
          flexWrap: "wrap",
          justifyContent: "flex-end"
        }
      }, skus.slice(0, 4).map((s, si) => React.createElement("span", {
        key: si,
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          background: C.bg3,
          border: `1px solid ${C.b0}`,
          borderRadius: 4,
          padding: "1px 5px",
          fontSize: 8,
          color: C.accent
        }
      }, s.ref)), skus.length > 4 && React.createElement("span", {
        style: {
          fontSize: 8,
          color: C.t4
        }
      }, "+", skus.length - 4))), React.createElement("div", {
        style: {
          display: "flex",
          gap: 5,
          marginTop: 6
        }
      }, t.estado === "fallido" && React.createElement("button", {
        onClick: () => reintentarTurno(t.id),
        disabled: !!procesando[t.id],
        style: {
          flex: 1,
          padding: "6px",
          background: `${C.green}15`,
          border: `1px solid ${C.green}30`,
          borderRadius: 7,
          color: C.green,
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer"
        }
      }, "↻ Reintentar"), t.estado === "pendiente" && React.createElement("button", {
        onClick: () => cancelarTurno(t.id),
        disabled: !!procesando[t.id],
        style: {
          flex: 1,
          padding: "6px",
          background: `${C.t4}10`,
          border: `1px solid ${C.b0}`,
          borderRadius: 7,
          color: C.t3,
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer"
        }
      }, "✕ Cancelar"), (t.estado === "completado" || t.estado === "fallido") && React.createElement("button", {
        onClick: () => eliminarTurno(t.id),
        disabled: !!procesando[t.id],
        style: {
          flex: 1,
          padding: "6px",
          background: `${C.red}10`,
          border: `1px solid ${C.red}25`,
          borderRadius: 7,
          color: C.red,
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer"
        }
      }, "🗑 Eliminar")));
    }));
  })(), (filtroEst === "todos" ? ["pendiente", "en_proceso", "fallido", "completado"] : [filtroEst]).map(est => {
    const q = busca.trim().toLowerCase();
    const lista = turnos.filter(t => t.estado === est && !(t.picking || "").startsWith("UBI-")).filter(t => !q || (t.picking || "").toLowerCase().includes(q) || (t.cliente || "").toLowerCase().includes(q) || (t.operario_solicitante || "").toLowerCase().includes(q) || (t.montacarguista || "").toLowerCase().includes(q)).sort((a, b) => {
      const au = a.es_mde ? 1 : 0,
        bu = b.es_mde ? 1 : 0;
      if (au !== bu) return bu - au;
      return new Date(b.fecha_solicitud) - new Date(a.fecha_solicitud);
    });
    if (lista.length === 0) return null;
    const col = {
      pendiente: C.yellow,
      en_proceso: C.orange,
      fallido: C.red,
      completado: C.green
    }[est];
    const lbl = {
      pendiente: "⏳ Pendientes",
      en_proceso: "🔄 En proceso",
      fallido: "⚠️ Fallidos",
      completado: "✅ Completados"
    }[est];
    return React.createElement("div", {
      key: est,
      style: {
        marginBottom: 16
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        marginBottom: 7
      }
    }, React.createElement("span", {
      style: {
        fontSize: 10,
        color: col,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1
      }
    }, lbl), React.createElement("span", {
      style: {
        background: `${col}20`,
        color: col,
        borderRadius: 10,
        padding: "1px 7px",
        fontSize: 9,
        fontWeight: 700
      }
    }, lista.length)), lista.map(t => {
      const posiciones = ordenarPos(t.posiciones);
      const exp = !!expandido[`t-${t.id}`];
      const urgente = t.es_mde || t.prioridad === "urgente";
      const totalUnids = posiciones.reduce((s, p) => (p.skus || []).reduce((u, k) => u + k.cant, s), 0);
      const elapsed = transcurrido(t.fecha_solicitud);
      const demorado = est === "pendiente" && (new Date() - new Date(t.fecha_solicitud)) / 60000 > 15;
      return React.createElement("div", {
        key: t.id,
        style: {
          background: C.bg2,
          borderRadius: 11,
          marginBottom: 6,
          border: `1px solid ${urgente || demorado ? C.red + "40" : C.b0}`,
          borderLeft: `4px solid ${urgente || demorado ? C.red : col}`,
          animation: "fadeUp .2s ease both"
        }
      }, React.createElement("div", {
        onClick: () => setExpandido(o => ({
          ...o,
          [`t-${t.id}`]: !o[`t-${t.id}`]
        })),
        style: {
          padding: "10px 13px",
          cursor: "pointer"
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
          flexWrap: "wrap"
        }
      }, React.createElement("span", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: C.teal,
          fontWeight: 800,
          fontSize: 13
        }
      }, t.picking), urgente && React.createElement("span", {
        style: {
          background: `${C.red}20`,
          color: C.red,
          borderRadius: 4,
          padding: "1px 5px",
          fontSize: 8,
          fontWeight: 800
        }
      }, "🚨"), demorado && React.createElement("span", {
        style: {
          background: `${C.red}15`,
          color: C.red,
          borderRadius: 4,
          padding: "1px 5px",
          fontSize: 7,
          fontWeight: 800
        }
      }, "DEMORADO"), React.createElement("span", {
        style: {
          background: `${col}18`,
          color: col,
          borderRadius: 4,
          padding: "1px 5px",
          fontSize: 8,
          fontWeight: 700
        }
      }, posiciones.length, " pos")), React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8
        }
      }, React.createElement("span", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: C.green,
          fontSize: 12,
          fontWeight: 700
        }
      }, totalUnids, "u"), React.createElement("span", {
        style: {
          color: C.t3,
          fontSize: 13,
          transform: exp ? "rotate(90deg)" : "none",
          transition: "transform .2s"
        }
      }, "▶"))), React.createElement("div", {
        style: {
          display: "flex",
          gap: 8,
          fontSize: 10,
          color: C.t3,
          flexWrap: "wrap"
        }
      }, React.createElement("span", null, "👷 ", t.operario_solicitante), t.montacarguista && React.createElement("span", {
        style: {
          color: C.purple
        }
      }, "🏗️ ", t.montacarguista), React.createElement("span", {
        style: {
          color: demorado ? C.red : C.t4
        }
      }, "⏱ ", elapsed)), !exp && React.createElement("div", {
        style: {
          display: "flex",
          gap: 3,
          flexWrap: "wrap",
          marginTop: 5
        }
      }, posiciones.map((p, pi) => React.createElement("span", {
        key: pi,
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          background: C.bg3,
          border: `1px solid ${C.b0}`,
          borderRadius: 4,
          padding: "1px 6px",
          fontSize: 8,
          color: C.teal
        }
      }, p.ubi)))), exp && React.createElement("div", {
        style: {
          borderTop: `1px solid ${C.b0}`,
          padding: "6px 13px 10px"
        }
      }, posiciones.map((pos, pi) => React.createElement("div", {
        key: pi,
        style: {
          background: C.bg3,
          borderRadius: 7,
          padding: "6px 9px",
          marginBottom: 5,
          borderLeft: `2px solid ${col}`
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 3
        }
      }, React.createElement("span", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: C.teal,
          fontWeight: 700,
          fontSize: 12
        }
      }, pos.ubi), React.createElement("span", {
        style: {
          fontSize: 9,
          color: C.t3
        }
      }, CALLE_NOM[pos.calleLetra] || pos.calleLetra, " · Niv ", pos.nivel)), (pos.skus || []).map((s, si) => React.createElement("div", {
        key: si,
        style: {
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: C.t2,
          padding: "2px 0",
          borderTop: si > 0 ? `1px solid ${C.b0}` : "none"
        }
      }, React.createElement("span", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: C.accent
        }
      }, s.ref), React.createElement("span", {
        style: {
          color: C.yellow,
          fontWeight: 700
        }
      }, s.cant, "u"))))), React.createElement("div", {
        style: {
          display: "flex",
          gap: 5,
          marginTop: 6
        }
      }, !urgente && est === "pendiente" && React.createElement("button", {
        onClick: () => priorizarTurno(t.id),
        disabled: !!procesando[t.id],
        style: {
          flex: 1,
          padding: "7px",
          background: `${C.red}15`,
          border: `1px solid ${C.red}30`,
          borderRadius: 7,
          color: C.red,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer"
        }
      }, "🚨 Priorizar"), est === "fallido" && React.createElement("button", {
        onClick: () => reintentarTurno(t.id),
        disabled: !!procesando[t.id],
        style: {
          flex: 1,
          padding: "7px",
          background: `${C.green}15`,
          border: `1px solid ${C.green}30`,
          borderRadius: 7,
          color: C.green,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer"
        }
      }, "↻ Reintentar"), t.motivo_fallo && React.createElement("div", {
        style: {
          flex: 2,
          padding: "5px 8px",
          background: `${C.orange}10`,
          borderRadius: 7,
          color: C.orange,
          fontSize: 10
        }
      }, t.motivo_fallo), est !== "completado" && est !== "fallido" && React.createElement("button", {
        onClick: () => cancelarTurno(t.id),
        disabled: !!procesando[t.id],
        style: {
          flex: 1,
          padding: "7px",
          background: `${C.t4}15`,
          border: `1px solid ${C.b0}`,
          borderRadius: 7,
          color: C.t3,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer"
        }
      }, "✕ Cancelar"), (est === "completado" || est === "fallido") && React.createElement("button", {
        onClick: () => eliminarTurno(t.id),
        disabled: !!procesando[t.id],
        style: {
          flex: 1,
          padding: "7px",
          background: `${C.red}10`,
          border: `1px solid ${C.red}25`,
          borderRadius: 7,
          color: C.red,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer"
        }
      }, "🗑 Eliminar"))));
    }));
  }), turnos.filter(t => !(t.picking || "").startsWith("UBI-")).length === 0 && !busca && React.createElement("div", {
    style: {
      textAlign: "center",
      color: C.t3,
      padding: "40px 20px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 36,
      marginBottom: 10
    }
  }, "🎉"), React.createElement("div", {
    style: {
      fontSize: 13
    }
  }, "Sin turnos de picking registrados"))), tab === "asignaciones" && React.createElement("div", null, (() => {
    const vencidas = asigs.filter(a => a.estado === "en_proceso" && (new Date() - new Date(a.fecha_asignacion)) / 3600000 > 5);
    if (!vencidas.length) return null;
    return React.createElement("div", {
      style: {
        background: `${C.orange}12`,
        border: `1px solid ${C.orange}35`,
        borderRadius: 11,
        padding: "11px 13px",
        marginBottom: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        fontSize: 11,
        color: C.orange,
        fontWeight: 800
      }
    }, "⚠ ", vencidas.length, " pedido", vencidas.length !== 1 ? "s" : "", " sin cerrar (+5h)"), React.createElement("div", {
      style: {
        fontSize: 9,
        color: C.t3,
        marginTop: 2
      }
    }, "Se completarán solos en el próximo refresh")), React.createElement("button", {
      onClick: completarVencidos,
      style: {
        flexShrink: 0,
        padding: "8px 12px",
        background: `${C.green}20`,
        border: `1px solid ${C.green}40`,
        borderRadius: 8,
        color: C.green,
        fontSize: 11,
        fontWeight: 800,
        cursor: "pointer"
      }
    }, "✅ Completar ahora"));
  })(), ["en_proceso", "liberado", "completado"].map(est => {
    const lista = asigs.filter(a => a.estado === est).sort((a, b) => new Date(b.fecha_asignacion) - new Date(a.fecha_asignacion));
    if (lista.length === 0) return null;
    const col = estadoCol[est] || C.t3;
    const lbl = {
      en_proceso: "🔄 En proceso",
      liberado: "🔓 Liberados",
      completado: "✅ Completados"
    }[est];
    return React.createElement("div", {
      key: est,
      style: {
        marginBottom: 16
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        marginBottom: 7
      }
    }, React.createElement("span", {
      style: {
        fontSize: 10,
        color: col,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1
      }
    }, lbl), React.createElement("span", {
      style: {
        background: `${col}20`,
        color: col,
        borderRadius: 10,
        padding: "1px 7px",
        fontSize: 9,
        fontWeight: 700
      }
    }, lista.length)), lista.map(a => {
      const horas = est === "en_proceso" ? (new Date() - new Date(a.fecha_asignacion)) / 3600000 : 0;
      const vencida = horas > 5;
      const demorada = horas > 2 && !vencida;
      const alertaCol = vencida ? C.red : demorada ? C.orange : col;
      return React.createElement("div", {
        key: a.id,
        style: {
          background: C.bg2,
          borderRadius: 11,
          marginBottom: 6,
          border: `1px solid ${vencida ? C.red + "40" : demorada ? C.orange + "35" : C.b0}`,
          borderLeft: `4px solid ${alertaCol}`,
          animation: "fadeUp .2s ease both",
          padding: "10px 13px"
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 4
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
          color: vencida ? C.red : demorada ? C.orange : C.teal,
          fontWeight: 800,
          fontSize: 13
        }
      }, a.picking), a.pedido_siesa && React.createElement("span", {
        style: {
          fontFamily: "'JetBrains Mono',monospace",
          color: C.t4,
          fontSize: 10
        }
      }, "#", a.pedido_siesa), vencida && React.createElement("span", {
        style: {
          background: `${C.red}20`,
          color: C.red,
          borderRadius: 4,
          padding: "1px 5px",
          fontSize: 7,
          fontWeight: 800
        }
      }, "VENCIDO"), demorada && React.createElement("span", {
        style: {
          background: `${C.orange}20`,
          color: C.orange,
          borderRadius: 4,
          padding: "1px 5px",
          fontSize: 7,
          fontWeight: 800
        }
      }, "DEMORADO")), React.createElement("span", {
        style: {
          background: `${alertaCol}18`,
          color: alertaCol,
          borderRadius: 4,
          padding: "1px 6px",
          fontSize: 8,
          fontWeight: 700,
          flexShrink: 0
        }
      }, estadoLbl[est])), React.createElement("div", {
        style: {
          color: C.t2,
          fontSize: 11,
          marginBottom: 4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, a.cliente), React.createElement("div", {
        style: {
          display: "flex",
          gap: 10,
          fontSize: 10,
          color: C.t3,
          flexWrap: "wrap",
          marginBottom: est === "en_proceso" ? 6 : 0
        }
      }, React.createElement("span", null, "👷 ", a.operario), React.createElement("span", null, "📍 ", a.ciudad), React.createElement("span", null, "🕐 ", fmtFecha(a.fecha_asignacion)), est === "en_proceso" && React.createElement("span", {
        style: {
          color: vencida ? C.red : demorada ? C.orange : C.t4,
          fontWeight: vencida || demorada ? 700 : 400
        }
      }, "⏱ ", transcurrido(a.fecha_asignacion))), est === "en_proceso" && (editando === `asig-${a.id}` ? React.createElement(ReasignarForm, {
        operarioActual: a.operario,
        operariosDisp: [...new Set([...operariosActivos.map(o => o.nombre), ...usuarios.filter(u => u.rol === "operario").map(u => u.nombre)])].filter(Boolean).sort(),
        onGuardar: n => reasignarPedido(a.id, n),
        onCancelar: () => setEditando(null)
      }) : React.createElement("div", {
        style: {
          display: "flex",
          gap: 5
        }
      }, !vencida && React.createElement("button", {
        onClick: () => setEditando(`asig-${a.id}`),
        style: {
          flex: 1,
          padding: "6px",
          background: C.bg3,
          border: `1px solid ${C.b0}`,
          borderRadius: 7,
          color: C.t2,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer"
        }
      }, "✏️ Reasignar"), vencida ? React.createElement("button", {
        onClick: () => completarPedido(a.id),
        disabled: !!procesando[a.id],
        style: {
          flex: 1,
          padding: "8px",
          background: `${C.green}20`,
          border: `1px solid ${C.green}40`,
          borderRadius: 7,
          color: C.green,
          fontSize: 11,
          fontWeight: 800,
          cursor: "pointer"
        }
      }, "✅ Completar") : React.createElement("button", {
        onClick: () => liberarPedido(a.id),
        disabled: !!procesando[a.id],
        style: {
          flex: 1,
          padding: "6px",
          background: `${C.orange}15`,
          border: `1px solid ${C.orange}30`,
          borderRadius: 7,
          color: C.orange,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer"
        }
      }, "🔓 Liberar"))));
    }));
  }), asigs.length === 0 && React.createElement("div", {
    style: {
      textAlign: "center",
      color: C.t3,
      padding: "40px 20px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 36,
      marginBottom: 10
    }
  }, "📋"), React.createElement("div", {
    style: {
      fontSize: 13
    }
  }, "Sin asignaciones registradas"))), tab === "metricas" && (() => {
    const compHoy = turnos.filter(t => t.estado === "completado" && t.fecha_completado && new Date(t.fecha_completado) >= hoyCut);
    const porHora = Array.from({
      length: 24
    }, (_, h) => ({
      h,
      n: compHoy.filter(t => new Date(t.fecha_completado).getHours() === h).length
    }));
    const maxHora = Math.max(...porHora.map(x => x.n), 1);
    const horaActual = new Date().getHours();
    const horasActivas = porHora.filter(x => x.n > 0 || x.h <= horaActual);
    const rankMc = (() => {
      const map = {};
      compHoy.forEach(t => {
        if (t.montacarguista) {
          if (!map[t.montacarguista]) map[t.montacarguista] = 0;
          map[t.montacarguista]++;
        }
      });
      return Object.entries(map).sort((a, b) => b[1] - a[1]);
    })();
    const asigHoy = asigs.filter(a => a.estado === "completado" && a.fecha_completado && new Date(a.fecha_completado) >= hoyCut);
    const rankOp = (() => {
      const map = {};
      asigHoy.forEach(a => {
        if (a.operario) {
          if (!map[a.operario]) map[a.operario] = 0;
          map[a.operario]++;
        }
      });
      return Object.entries(map).sort((a, b) => b[1] - a[1]);
    })();
    const masLargo = compHoy.filter(t => t.fecha_solicitud).sort((a, b) => new Date(b.fecha_completado) - new Date(b.fecha_solicitud) - (new Date(a.fecha_completado) - new Date(a.fecha_solicitud)))[0];
    const masLargoMin = masLargo ? Math.round((new Date(masLargo.fecha_completado) - new Date(masLargo.fecha_solicitud)) / 60000) : null;
    return React.createElement("div", null, React.createElement("div", {
      style: {
        background: C.bg2,
        borderRadius: 12,
        padding: "13px",
        marginBottom: 12,
        border: `1px solid ${C.b0}`
      }
    }, React.createElement("div", {
      style: {
        fontSize: 10,
        color: C.accent,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: .5,
        marginBottom: 10
      }
    }, "📈 Completados por hora"), compHoy.length === 0 ? React.createElement("div", {
      style: {
        textAlign: "center",
        color: C.t4,
        fontSize: 12,
        padding: "20px 0"
      }
    }, "Sin completados hoy") : React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-end",
        gap: 3,
        height: 60
      }
    }, horasActivas.map(({
      h,
      n
    }) => React.createElement("div", {
      key: h,
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2
      }
    }, n > 0 && React.createElement("div", {
      style: {
        fontSize: 7,
        color: C.accent,
        fontWeight: 700
      }
    }, n), React.createElement("div", {
      style: {
        width: "100%",
        background: n > 0 ? C.accent : C.bg3,
        borderRadius: "3px 3px 0 0",
        height: n > 0 ? `${Math.max(Math.round(n / maxHora * 44), 4)}px` : "4px",
        transition: "height .3s",
        opacity: h === horaActual ? 1 : .7
      }
    }), React.createElement("div", {
      style: {
        fontSize: 6,
        color: C.t4
      }
    }, h, "h")))), React.createElement("div", {
      style: {
        marginTop: 8,
        fontSize: 9,
        color: C.t4,
        textAlign: "right"
      }
    }, compHoy.length, " turno", compHoy.length !== 1 ? "s" : "", " completado", compHoy.length !== 1 ? "s" : "", " hoy")), React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        marginBottom: 12
      }
    }, React.createElement("div", {
      style: {
        background: C.bg2,
        borderRadius: 12,
        padding: "11px",
        border: `1px solid ${C.b0}`
      }
    }, React.createElement("div", {
      style: {
        fontSize: 9,
        color: C.purple,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: .5,
        marginBottom: 8
      }
    }, "🏗️ Montacarguistas"), rankMc.length === 0 ? React.createElement("div", {
      style: {
        color: C.t4,
        fontSize: 10,
        textAlign: "center",
        padding: "8px 0"
      }
    }, "—") : rankMc.slice(0, 5).map(([nom, cnt], ri) => React.createElement("div", {
      key: nom,
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "3px 0",
        borderTop: ri > 0 ? `1px solid ${C.b0}` : "none"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, React.createElement("span", {
      style: {
        fontSize: 9,
        color: ri === 0 ? C.yellow : C.t4,
        fontWeight: 700
      }
    }, "#", ri + 1), React.createElement("span", {
      style: {
        fontSize: 10,
        color: C.t2,
        textTransform: "capitalize",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 60
      }
    }, nom)), React.createElement("span", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 12,
        fontWeight: 800,
        color: ri === 0 ? C.yellow : C.green
      }
    }, cnt)))), React.createElement("div", {
      style: {
        background: C.bg2,
        borderRadius: 12,
        padding: "11px",
        border: `1px solid ${C.b0}`
      }
    }, React.createElement("div", {
      style: {
        fontSize: 9,
        color: C.teal,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: .5,
        marginBottom: 8
      }
    }, "👷 Operarios"), rankOp.length === 0 ? React.createElement("div", {
      style: {
        color: C.t4,
        fontSize: 10,
        textAlign: "center",
        padding: "8px 0"
      }
    }, "—") : rankOp.slice(0, 5).map(([nom, cnt], ri) => React.createElement("div", {
      key: nom,
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "3px 0",
        borderTop: ri > 0 ? `1px solid ${C.b0}` : "none"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, React.createElement("span", {
      style: {
        fontSize: 9,
        color: ri === 0 ? C.yellow : C.t4,
        fontWeight: 700
      }
    }, "#", ri + 1), React.createElement("span", {
      style: {
        fontSize: 10,
        color: C.t2,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 60
      }
    }, nom)), React.createElement("span", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 12,
        fontWeight: 800,
        color: ri === 0 ? C.yellow : C.teal
      }
    }, cnt))))), masLargo && React.createElement("div", {
      style: {
        background: C.bg2,
        borderRadius: 12,
        padding: "13px",
        border: `1px solid ${C.orange}30`,
        borderLeft: `4px solid ${C.orange}`
      }
    }, React.createElement("div", {
      style: {
        fontSize: 9,
        color: C.orange,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: .5,
        marginBottom: 6
      }
    }, "⏱ Turno más largo del día"), React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        color: C.teal,
        fontWeight: 800,
        fontSize: 14
      }
    }, masLargo.picking), React.createElement("div", {
      style: {
        fontSize: 10,
        color: C.t3,
        marginTop: 2
      }
    }, "🏗️ ", masLargo.montacarguista || "—", " · ", fmtHora(masLargo.fecha_solicitud), " → ", fmtHora(masLargo.fecha_completado))), React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, React.createElement("div", {
      style: {
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 22,
        fontWeight: 800,
        color: C.orange,
        lineHeight: 1
      }
    }, masLargoMin), React.createElement("div", {
      style: {
        fontSize: 8,
        color: C.t4,
        textTransform: "uppercase"
      }
    }, "minutos")))));
  })()));
}
function ReasignarForm({
  operarioActual,
  operariosDisp,
  onGuardar,
  onCancelar
}) {
  const [nombre, setNombre] = useState(operarioActual);
  const todos = [...new Set([operarioActual, ...operariosDisp])].filter(Boolean);
  return React.createElement("div", {
    style: {
      background: C.bg3,
      borderRadius: 9,
      padding: "10px",
      marginTop: 6,
      border: `1px solid ${C.b1}`
    }
  }, React.createElement("div", {
    style: {
      color: C.t3,
      fontSize: 10,
      marginBottom: 6
    }
  }, "Reasignar a:"), React.createElement("input", {
    value: nombre,
    onChange: e => setNombre(e.target.value),
    placeholder: "Nombre del operario...",
    style: {
      width: "100%",
      background: C.bg0,
      border: `1px solid ${C.b1}`,
      borderRadius: 7,
      padding: "8px 10px",
      fontSize: 13,
      color: C.t1,
      marginBottom: 6
    }
  }), todos.length > 1 && React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      flexWrap: "wrap",
      marginBottom: 7
    }
  }, todos.map(n => React.createElement("button", {
    key: n,
    onClick: () => setNombre(n),
    style: {
      padding: "3px 9px",
      background: nombre === n ? `${C.accent}25` : C.bg2,
      border: `1px solid ${nombre === n ? C.accent : C.b0}`,
      borderRadius: 5,
      color: nombre === n ? C.accent : C.t3,
      fontSize: 10,
      cursor: "pointer"
    }
  }, n))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 5
    }
  }, React.createElement("button", {
    onClick: () => nombre.trim() && onGuardar(nombre.trim()),
    style: {
      flex: 1,
      padding: "7px",
      background: `${C.accent}20`,
      border: `1px solid ${C.accent}40`,
      borderRadius: 7,
      color: C.accent,
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "Guardar"), React.createElement("button", {
    onClick: onCancelar,
    style: {
      flex: 1,
      padding: "7px",
      background: C.bg2,
      border: `1px solid ${C.b0}`,
      borderRadius: 7,
      color: C.t3,
      fontSize: 11,
      cursor: "pointer"
    }
  }, "Cancelar")));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(AdminApp, null));