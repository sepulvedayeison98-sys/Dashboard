/* Tests de la lógica de negocio del CEDI (shared/helpers-cedi.js).
 * Sin framework: assert nativo de Node. Correr con:  node shared/helpers-cedi.test.js
 * Blinda las reglas que ya causaron bugs (501 SOLID/SP_S, tope de piso, calles). */
const assert = require("assert");
require("./helpers-cedi.js");
const C = globalThis.CEDI;

let pass = 0;
const t = (nombre, fn) => { fn(); console.log("  ✓", nombre); pass++; };

// ── familia ──────────────────────────────────────────────────────────────────
t("familia ICH-501 → 501", () => assert.strictEqual(C.familia("CASCO ICH ICH-501_SP HCI"), "501"));
t("familia ICH-3120 → 3120", () => assert.strictEqual(C.familia("CASCO ICH ICH-3120 WISH"), "3120"));
t("familia T-10 → T-10", () => assert.strictEqual(C.familia("REPUE VISOR TECH T-10 SM"), "T-10"));
t("familia desconocida → OTRO", () => assert.strictEqual(C.familia("ALGO RARO"), "OTRO"));

// ── esCalle2 (regla 501 SOLID / 501_SP_S → Calle 2) ──────────────────────────
t("esCalle2 501 SOLID → true", () => assert.strictEqual(C.esCalle2("ICH-501_SP SOLID NG"), true));
t("esCalle2 501 EXPO SOLID → true", () => assert.strictEqual(C.esCalle2("ICH-501_SP_EXPO_ICMS SOLID NG"), true));
t("esCalle2 501_SP_S → true", () => assert.strictEqual(C.esCalle2("ICH-501_SP_S CHAMPS NG"), true));
t("esCalle2 501_SP normal → false", () => assert.strictEqual(C.esCalle2("ICH-501_SP HCI NG"), false));
t("esCalle2 3120 SOLID → false (no es 501)", () => assert.strictEqual(C.esCalle2("ICH-3120 SOLID NG"), false));

// ── parseUbi ─────────────────────────────────────────────────────────────────
t("parseUbi D1041", () => assert.deepStrictEqual(C.parseUbi("D1041"),
  { calleKey: "C3", calleLetra: "D", modulo: 10, nivel: 4, pos: 1 }));
t("parseUbi B0552", () => assert.deepStrictEqual(C.parseUbi("B0552"),
  { calleKey: "C1", calleLetra: "B", modulo: 5, nivel: 5, pos: 2 }));
t("parseUbi inválida → null", () => assert.strictEqual(C.parseUbi("4PLca"), null));

// ── calles ───────────────────────────────────────────────────────────────────
t("CALLE_NOM D → Calle 3", () => assert.strictEqual(C.CALLE_NOM.D, "Calle 3"));
t("CALLE_ORD orden B<C<D<E", () => assert.ok(C.CALLE_ORD.B < C.CALLE_ORD.C && C.CALLE_ORD.C < C.CALLE_ORD.D));

// ── esMDE ────────────────────────────────────────────────────────────────────
t("esMDE MEDELLÍN → true", () => assert.strictEqual(C.esMDE("MEDELLÍN"), true));
t("esMDE ITAGUI → true", () => assert.strictEqual(C.esMDE("ITAGUI"), true));
t("esMDE BOGOTA → false", () => assert.strictEqual(C.esMDE("BOGOTA"), false));

// ── marcaDe / toNum ──────────────────────────────────────────────────────────
t("marcaDe extrae 3ra palabra", () => assert.strictEqual(C.marcaDe("CASCO INTEGRAL ICH ICH-501"), "ICH"));
t("toNum '21 u' → 21", () => assert.strictEqual(C.toNum("21 u"), 21));
t("toNum '1,234' (coma de miles) → 1234", () => assert.strictEqual(C.toNum("1,234"), 1234));
t("toNum '.' decimal: '1.5' → 1.5", () => assert.strictEqual(C.toNum("1.5"), 1.5));
t("toNum vacío → 0", () => assert.strictEqual(C.toNum(""), 0));

// ── coberturaLinea (SIN tope de piso) ────────────────────────────────────────
t("piso 100, cant 40 → hasPiso=true (NO viaje)", () => {
  const c = C.coberturaLinea(100, 50, 40);
  assert.strictEqual(c.hasPiso, true);
  assert.strictEqual(c.cubPiso, 40);
});
t("piso 5, alt 50, cant 40 → hasPiso=false, hasAlt=true (viaje)", () => {
  const c = C.coberturaLinea(5, 50, 40);
  assert.strictEqual(c.hasPiso, false);
  assert.strictEqual(c.hasAlt, true);
});
t("sin stock → sinStock=true", () => {
  const c = C.coberturaLinea(0, 0, 10);
  assert.strictEqual(c.sinStock, true);
});

// ── clasificar ───────────────────────────────────────────────────────────────
t("clasificar 100% → despachable", () => assert.strictEqual(C.clasificar(100, 0), "despachable"));
t("clasificar 60% → parcial", () => assert.strictEqual(C.clasificar(60, 10), "parcial"));
t("clasificar 0% con altura → reabasto", () => assert.strictEqual(C.clasificar(0, 20), "reabasto"));
t("clasificar 0% sin altura → ruptura", () => assert.strictEqual(C.clasificar(0, 0), "ruptura"));

// ── calleFamiliaMatch (filtro C1–C4 por familia) ─────────────────────────────
t("C1 incluye 3110", () => assert.strictEqual(C.calleFamiliaMatch("C1", "CASCO ICH ICH-3110 X"), true));
t("C2 incluye 501-SP", () => assert.strictEqual(C.calleFamiliaMatch("C2", "CASCO ICH ICH-501_SP HCI"), true));
t("C2 incluye 503", () => assert.strictEqual(C.calleFamiliaMatch("C2", "CASCO ICH ICH-503 X"), true));
t("C3 incluye 501_SP normal", () => assert.strictEqual(C.calleFamiliaMatch("C3", "CASCO ICH ICH-501_SP HCI"), true));
t("C3 EXCLUYE 501 SOLID", () => assert.strictEqual(C.calleFamiliaMatch("C3", "CASCO ICH ICH-501_SP SOLID"), false));
t("C3 EXCLUYE 501_SP_S", () => assert.strictEqual(C.calleFamiliaMatch("C3", "CASCO ICH ICH-501_SP_S CHAMPS"), false));
t("C4 incluye 3130", () => assert.strictEqual(C.calleFamiliaMatch("C4", "CASCO ICH ICH-3130 X"), true));
t("C1 NO incluye 501", () => assert.strictEqual(C.calleFamiliaMatch("C1", "CASCO ICH ICH-501_SP HCI"), false));

console.log(`\n${pass} pruebas OK`);
