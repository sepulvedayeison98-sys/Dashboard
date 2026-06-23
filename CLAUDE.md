# INDUCASCOS Dashboard — Contexto de desarrollo

## Repositorio
- GitHub Pages: `sepulvedayeison98-sys/Dashboard` → rama `main`
- Rama de trabajo: `claude/repo-file-replacement-4vccq1`
- Siempre hacer push a `main` tras cada cambio

## Stack
- HTML + React 18 (Babel JSX inline en montacargas/admin, pre-compilado en pipeline)
- Supabase REST API directa (sin SDK) — `https://rfysmwpdzlxmadobdvzh.supabase.co`
- GitHub Pages estático — sin servidor, sin build step

## Archivos principales

| Archivo | App | Usuarios |
|---|---|---|
| `pipeline.html` | Bandeja de planeación CEDI | Pickers / planeadores |
| `montacargas.html` | Turnos montacarguista | Montacarguistas |
| `admin.html` | Administración | Admins |
| `Bandejadeplaneacion.xlsx` | Datos de pedidos (cargado por pipeline) | — |
| `Inventario.xlsx` | Inventario por ubicación (cargado por pipeline) | — |

## Supabase — Tablas clave

### `turnos`
Estado: `pendiente` → `en_proceso` → `completado` / `fallido`
Columnas relevantes: `id`, `picking`, `estado`, `posiciones` (JSON array), `operario`, `montacarguista`, `fecha_solicitud`, `fecha_completado`

### `asignaciones`
Columnas: `picking`, `operario`, `estado` (`en_proceso` / `liberado`), `fecha_completado`

### `usuarios`
Columnas: `nombre`, `rol` (`picker` / `operario` / `admin`)

## Patrón `_go` (fetch con retry)
```javascript
const _go = async (url, opts = {}) => {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { cache: 'no-cache', headers: _H, ...opts });
      if (res.ok) { const t = await res.text(); return { data: t ? JSON.parse(t) : null, error: null }; }
      if ([400,403,404,409].includes(res.status)) { const t = await res.text(); return { data: null, error: { status: res.status, message: t } }; }
      if (i < 2) await new Promise(ok => setTimeout(ok, (i+1)*2000));
      else { const t = await res.text(); return { data: null, error: { status: res.status, message: t } }; }
    } catch (err) {
      if (i < 2) await new Promise(ok => setTimeout(ok, (i+1)*2000));
      else return { data: null, error: err };
    }
  }
};
```
**IMPORTANTE:** NO usar `_bust()` (agregar `_cb=timestamp` a URLs rompe PostgREST — lo trata como filtro de columna desconocida y devuelve 400). Usar solo `cache:'no-cache'`.

## Reglas PostgREST
- PATCH/DELETE: los query params son filtros de columna — no agregar params ajenos
- GET con `in.()`: la lista va sin `encodeURIComponent`, ej: `?picking=in.(123,456)`
- Upsert: `POST` con header `Prefer: resolution=merge-duplicates`

## Instrucción de trabajo del usuario
> "No analices durante más de 60 segundos. Si no encuentras una solución, detente y explícame el bloqueo. No entres en ciclos de revisión. Entrega una primera versión funcional rápidamente."

## Git
```bash
git config user.email noreply@anthropic.com
git config user.name Claude
# Siempre firmar antes de commitear
# Tras rebase: git push origin HEAD:main --force-with-lease
```
