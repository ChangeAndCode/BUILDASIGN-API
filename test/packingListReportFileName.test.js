const test = require("node:test");
const assert = require("node:assert/strict");
const { createPackingListReportFileName } = require("../utils/packingListReportFileName");

test("crea la nomenclatura customer MM YYYY SS MM HH en horario de 24 horas", () => {
  const downloadedAt = new Date(2026, 7, 15, 17, 30, 1);
  assert.equal(createPackingListReportFileName({ customer: "Change and Code", month: 8, year: 2026, downloadedAt }), "changeandcode082026013017.pdf");
});

test("retira espacios, simbolos y acentos del customer", () => {
  const downloadedAt = new Date(2026, 0, 1, 5, 4, 3);
  assert.equal(createPackingListReportFileName({ customer: "Compañía, Norte S.A.", month: 1, year: 2026, downloadedAt }), "companianortesa012026030405.pdf");
});
