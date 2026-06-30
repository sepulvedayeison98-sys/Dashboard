# 🔌 Cableado de módulos compartidos — paso de noche (bodega cerrada)

Los módulos `shared/config.js` y `shared/helpers-cedi.js` ya existen, validados y probados,
pero **NO están cableados** a las apps (riesgo cero durante operación). Este es el plan para
conectarlos de noche, con prueba de humo. Es la ÚNICA parte que toca las apps en vivo.

## Por qué de noche
Conectar implica **quitar las definiciones inline** de cada app y apuntar a las del módulo.
Si quedan ambas (`const familia` inline + global) → error de redeclaración → app caída.
Por eso requiere editar cada archivo con cuidado y probar antes de que entren operarios.

## Procedimiento por app (idéntico para las 3)
1. Agregar en el `<head>`, ANTES del script de la app:
   ```html
   <script src="./shared/config.js"></script>
   <script src="./shared/helpers-cedi.js"></script>
   ```
2. Reemplazar las definiciones inline por referencias al módulo:
   - `const { SUPA_URL, SUPA_KEY, _H, _go } = window.CEDI_CONFIG;`
   - `const { familia, parseUbi, esMDE, marcaDe, esCalle2, CALLE_MAP, CALLE_NOM, CALLE_ORD, toNum, tieneNota, coberturaLinea, clasificar } = window.CEDI;`
   - Borrar los bloques `const familia=…`, `const parseUbi=…`, etc. que quedan duplicados.
3. Prueba de humo por app:
   - **Picking**: carga, lista pedidos, filtros, abre un pedido, viajes, agenda turno.
   - **Montacargas**: carga turnos, toma turno, marca bajada.
   - **CEDI**: carga Excel, KPIs, filtros de calle, plan de viajes.
4. Si algo falla → revertir el commit de esa app (los módulos quedan, solo se desconecta).

## Orden sugerido (de menor a mayor riesgo)
1. `montacargas.html` (más pequeño, 15 useState)
2. `admin.html`
3. `pipeline.html`
4. `index.html` (el más grande; opcional, hacerlo aparte)

> Nota: `index.html` (CEDI) NO usa Supabase, así que solo consume `helpers-cedi.js`.
> `simulacion.html` está huérfano: candidato a eliminar, no cablear.
