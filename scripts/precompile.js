/* Pre-compila el JSX inline (type="text/babel") de montacargas.html y admin.html
 * a archivos .js (React.createElement), para eliminar Babel en el navegador.
 * Correr:  node scripts/precompile.js
 * Salida:  montacargas.app.js, admin.app.js  (cablear en el <head> de noche). */
const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const ROOT = path.resolve(__dirname, "..");

function extractBabel(html) {
  const open = html.indexOf('<script type="text/babel"');
  if (open < 0) throw new Error("no se encontró <script type=text/babel>");
  const gt = html.indexOf(">", open) + 1;
  const close = html.indexOf("</script>", gt);
  return html.slice(gt, close);
}

function compile(srcHtml, outJs) {
  const html = fs.readFileSync(path.join(ROOT, srcHtml), "utf8");
  const jsx = extractBabel(html);
  const out = babel.transformSync(jsx, {
    plugins: [["@babel/plugin-transform-react-jsx", {
      runtime: "classic", pragma: "React.createElement", pragmaFrag: "React.Fragment",
    }]],
    babelrc: false, configFile: false, comments: false, compact: false,
  });
  const banner = `/* PRECOMPILADO desde ${srcHtml} — NO editar a mano. Regenerar: node scripts/precompile.js */\n`;
  fs.writeFileSync(path.join(ROOT, outJs), banner + out.code);
  console.log(`${outJs} OK (${out.code.length} bytes)`);
}

compile("montacargas.html", "montacargas.app.js");
compile("admin.html", "admin.app.js");
