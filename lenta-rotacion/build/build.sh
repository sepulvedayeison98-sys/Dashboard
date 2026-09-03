#!/bin/bash
# Compilación completa del dashboard en un solo archivo HTML autocontenido.
#
# IMPORTANTE: el CSS de Tailwind se genera escaneando el JSX, así que hay que
# regenerarlo SIEMPRE junto con el bundle. Compilar solo el JS deja el CSS
# desactualizado y las clases nuevas dejan de existir en silencio — sin error,
# sin aviso: el estilo simplemente no se aplica.
set -e
cd "$(dirname "$0")"
BASE=..          # lenta-rotacion/ — las fuentes
RAIZ=../..       # raíz del repo — donde queda el HTML publicable

# 1. Sincroniza las fuentes
cp "$BASE/DashboardLentaRotacion.jsx" "$BASE/exportExcel.js" .

# 2. CSS (escanea las clases usadas en el JSX)
npx --yes tailwindcss -i input.css -o tailwind.css --minify 2>&1 | grep -E "Done|error" || true

# 3. JS
npx --yes esbuild entry.jsx --bundle --minify --platform=browser --target=es2020 \
  --define:process.env.NODE_ENV='"production"' --outfile=bundle.js 2>&1 | grep -E "bundle|error" || true

# 4. Ensamblado — el HTML autocontenido queda en la raíz, servible por GitHub Pages
cat part1.html tailwind.css part2.html bundle.js part3.html > "$RAIZ/lenta-rotacion.html"

# 5. Red de seguridad: avisa si alguna clase del JSX no llegó al CSS
node -e '
const fs = require("fs");
const jsx = fs.readFileSync("DashboardLentaRotacion.jsx", "utf8");
const css = fs.readFileSync("tailwind.css", "utf8");
const usadas = new Set();
for (const m of jsx.matchAll(/className="([^"]+)"/g))
  for (const c of m[1].split(/\s+/)) if (/^(max-h|max-w|min-w|w|h|overflow)-/.test(c)) usadas.add(c);
const faltan = [...usadas].filter(c => !css.includes(c.replace(/([[\]().])/g, "\\$1")));
if (faltan.length) { console.error("AVISO — clases de tamaño ausentes en el CSS:", faltan.join(" ")); process.exit(1); }
console.log("CSS verificado: todas las clases de tamaño presentes");
'
echo "OK · lenta-rotacion.html · $(du -h "$RAIZ/lenta-rotacion.html" | cut -f1)"
