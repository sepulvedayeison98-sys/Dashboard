# 🔍 Auditoría Técnica — INDUCASCOS Dashboard

> Snapshot al 30-Jun-2026. Análisis estático de 11.941 líneas (CEDI Live, Picking, Montacargas + soporte).

## Scores
| Dimensión | Score |
|---|---|
| Arquitectura | 42 / 100 |
| Seguridad | 35 / 100 |
| UX/UI | 70 / 100 |
| Rendimiento | 50 / 100 |
| Escalabilidad | 30 / 100 |
| Calidad de Código | 40 / 100 |
| Automatización | 40 / 100 |
| **General** | **44 / 100** |

## Hallazgos estructurales (causa raíz)
1. **Doble fuente de verdad:** inventario/pedidos en Excel manual + turnos/asignaciones en Supabase. CEDI Live no es "live": es un snapshot del último `.xlsx`.
2. **Lógica de negocio duplicada 2-3×** (familia, calles, cobertura, clasificación, esCalle2) → cada regla hay que cambiarla en varios archivos (ya causó bugs).
3. **God Components:** index.html = 614 KB, 67 useState en un componente.
4. **Seguridad:** clave VAPID privada versionada, RLS sin confirmar, DELETE desde el cliente, sin auth de usuario.
5. **Rendimiento:** Babel en navegador, parseo de 48k filas XLSX en el hilo principal, sin code-splitting.

## Roadmap priorizado
**P0 (seguridad, esta semana — ver `supabase/security/SECURITY-RUNBOOK.md`)**
- Confirmar/activar RLS · Rotar VAPID a secrets · Quitar DELETE del cliente.

**P1 (corto plazo)**
- Módulos compartidos (`config.js`, `theme.js`, `helpers-cedi.js`) → fin de la duplicación.
- Pre-compilar JSX · Web Worker para XLSX.

**P2 (mediano)**
- Ingesta automática WMS→Supabase (eliminar Excel) · Supabase Auth · componentizar.

**P3 (largo)**
- Build con Vite + CI/CD + tests · monorepo con capa de dominio compartida.

## Top 20 mejoras → ver detalle en el chat de auditoría
RLS · VAPID secrets · quitar DELETE cliente · Supabase Auth · ingesta WMS→DB ·
CEDI en vivo · módulo de lógica único · config/theme centralizados · Web Worker ·
pre-compilar JSX · code-splitting · componentizar · virtualización · Vite · CI/CD ·
tests de cobertura · trazabilidad de turnos · push por trigger · observabilidad ·
agente IA de planeación.

---
*Documento de referencia. No modifica el comportamiento de las apps.*
