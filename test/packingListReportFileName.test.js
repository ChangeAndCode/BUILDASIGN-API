const test = require("node:test");
const assert = require("node:assert/strict");
const {
  compactCustomerName,
  createPackingListReportFileName,
} = require("../utils/packingListReportFileName");

test("crea la nomenclatura customer MM YYYY SS MM HH", () => {
  const downloadedAt = new Date(2026, 7, 15, 17, 30, 1);
  assert.equal(
    createPackingListReportFileName({
      customer: "Change and Code",
      month: 8,
      year: 2026,
      downloadedAt,
    }),
    "changeandcode082026013017.pdf",
  );
});

test("retira espacios, simbolos y acentos del customer", () => {
  assert.equal(compactCustomerName("Compañía, Norte S.A."), "companianortesa");
});