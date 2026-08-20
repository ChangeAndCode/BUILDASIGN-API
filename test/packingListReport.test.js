const test = require("node:test");
const assert = require("node:assert/strict");

const SPLScrap = require("../models/SPLScrap");
const {
  consolidatePackingListRows,
  getMonthRange,
  buildAvailablePeriods,
  getCustomersForSite,
  getAvailablePeriods,
  getMonthlyReportData,
  generateMonthlyReportPdf,
} = require("../services/packingListReportService");

const row = (overrides = {}) => ({
  "Part Number": "PN-1",
  Description: "Device",
  "Unit Of Measure": "EA",
  "Country of Origin": "MX",
  Quantity: 2,
  "Total Value (USD)": 10,
  ...overrides,
});

const withAggregateResult = async (result, operation) => {
  const originalAggregate = SPLScrap.aggregate;
  let capturedPipeline;
  SPLScrap.aggregate = (pipeline) => {
    capturedPipeline = pipeline;
    return {
      allowDiskUse: async (enabled) => {
        assert.equal(enabled, true);
        return result;
      },
    };
  };
  try {
    return await operation(() => capturedPipeline);
  } finally {
    SPLScrap.aggregate = originalAggregate;
  }
};

test("consolida filas iguales sumando quantity y total value", () => {
  const result = consolidatePackingListRows([
    row(),
    row({ Quantity: "3", "Total Value (USD)": "1,500.50" }),
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 5);
  assert.equal(result[0].totalValue, 1510.5);
});

test("separa y marca variantes del mismo part number", () => {
  const result = consolidatePackingListRows([
    row(),
    row({ "Country of Origin": "US" }),
  ]);
  assert.equal(result.length, 2);
  assert.ok(result.every((entry) => entry.hasVariants));
});

test("devuelve solo años y meses con envios disponibles", () => {
  assert.deepEqual(
    buildAvailablePeriods([
      "2020-05-10",
      "2024-08-01",
      "2026-05-01",
      "2026-08-02",
      "2026-12-03",
      "2026-08-20",
    ]),
    [
      { year: 2026, months: [5, 8, 12] },
      { year: 2024, months: [8] },
      { year: 2020, months: [5] },
    ],
  );
});

test("calcula el rango mensual en UTC", () => {
  const range = getMonthRange(2026, 8);
  assert.equal(range.start.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-09-01T00:00:00.000Z");
});

test("obtiene customers mediante agregacion con disco habilitado", async () => {
  await withAggregateResult(
    [{ customer: "ACME" }, { customer: "North" }],
    async (getPipeline) => {
      const customers = await getCustomersForSite("local-01");
      assert.deepEqual(customers, ["ACME", "North"]);
      assert.equal(getPipeline()[0].$match.site, "local-01");
      assert.ok(getPipeline().some((stage) => stage.$unwind === "$rows"));
    },
  );
});

test("agrupa periodos devueltos por MongoDB", async () => {
  await withAggregateResult(
    [
      { _id: { year: 2026, month: 5 } },
      { _id: { year: 2026, month: 8 } },
      { _id: { year: 2025, month: 12 } },
    ],
    async () => {
      const periods = await getAvailablePeriods({
        site: "local-02",
        customer: "ACME",
      });
      assert.deepEqual(periods, [
        { year: 2026, months: [5, 8] },
        { year: 2025, months: [12] },
      ]);
    },
  );
});

test("arma el reporte desde un resultado consolidado de MongoDB", async () => {
  await withAggregateResult(
    [{
      files: [{ count: 3 }],
      rows: [
        {
          partNumber: "PN-1",
          description: "Device A",
          unitOfMeasure: "EA",
          countryOfOrigin: "MX",
          quantity: 5,
          totalValue: 25,
        },
        {
          partNumber: "PN-1",
          description: "Device B",
          unitOfMeasure: "EA",
          countryOfOrigin: "MX",
          quantity: 1,
          totalValue: 7,
        },
      ],
    }],
    async (getPipeline) => {
      const report = await getMonthlyReportData({
        site: "local-01",
        customer: "ACME",
        year: 2026,
        month: 8,
      });
      assert.equal(report.fileCount, 3);
      assert.equal(report.rows.length, 2);
      assert.ok(report.rows.every((entry) => entry.hasVariants));
      assert.ok(getPipeline().some((stage) => stage.$facet));
    },
  );
});

test("genera un PDF valido", async () => {
  const { start, end } = getMonthRange(2026, 8);
  const pdf = await generateMonthlyReportPdf({
    site: "local-01",
    customer: "ACME",
    year: 2026,
    month: 8,
    start,
    end,
    fileCount: 2,
    rows: consolidatePackingListRows([row()]),
  });
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
});