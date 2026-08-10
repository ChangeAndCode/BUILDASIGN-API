const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");
const ExcelJS = require("exceljs");

const {
  MASTER_TYPES,
} = require("../data/masterFileRegistry");
const {
  parseMasterFileBuffer,
} = require("../utils/masterFileParser");
const {
  parseMasterFileStream,
} = require("../utils/masterFileStreamParser");

const temporaryDirectories = [];

const createWorkbookFile = async ({
  sheetName = "FS E",
  headers = ["Part Number", "Description"],
  rows = [],
} = {}) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "buildasign-master-stream-"),
  );
  temporaryDirectories.push(directory);

  const filePath = path.join(directory, "master.xlsx");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));
  await workbook.xlsx.writeFile(filePath);

  return filePath;
};

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) =>
      fs.rm(directory, { recursive: true, force: true }),
    ),
  );
});

test("rechaza rutas vacias o inexistentes", async () => {
  await assert.rejects(
    parseMasterFileStream(""),
    (error) => error.code === "MASTER_FILE_PATH_INVALID",
  );

  await assert.rejects(
    parseMasterFileStream(
      path.join(os.tmpdir(), "buildasign-no-existe.xlsx"),
    ),
    (error) => error.code === "MASTER_FILE_PATH_INVALID",
  );
});

test("procesa Finished Goods en lotes sin cambiar las reglas BUILDASIGN", async () => {
  const filePath = await createWorkbookFile({
    rows: [
      ["fg-001", "Producto 1"],
      ["fg-002", "Producto 2"],
      ["fg-003", "Producto 3"],
      ["fg-004", "Producto 4"],
      ["fg-005", "Producto 5"],
    ],
  });
  const batches = [];
  let initialMetadata = null;

  const result = await parseMasterFileStream(filePath, {
    originalFileName: "finished-goods.xlsx",
    expectedMasterType: MASTER_TYPES.FINISHED_PRODUCT,
    batchSize: 2,
    onMetadata: async (metadata) => {
      initialMetadata = metadata;
    },
    onBatch: async (records) => {
      batches.push(records);
    },
  });

  assert.equal(initialMetadata.masterType, MASTER_TYPES.FINISHED_PRODUCT);
  assert.equal(initialMetadata.sourceSheet, "FS E");
  assert.equal(initialMetadata.partNumberColumn, "A");
  assert.deepEqual(
    batches.map((batch) => batch.length),
    [2, 2, 1],
  );
  assert.equal(result.recordCount, 5);
  assert.equal(result.metadata.recordCount, 5);
  assert.match(result.metadata.checksum, /^[a-f0-9]{64}$/);
  assert.equal(batches[0][0].partNumber, "FG-001");
  assert.equal(
    batches[0][0].normalizedValues.description,
    "Producto 1",
  );
});

test("streaming conserva los registros producidos por el parser en memoria", async () => {
  const filePath = await createWorkbookFile({
    rows: [
      ["FG-100", "Producto A"],
      ["FG-200", "Producto B"],
    ],
  });
  const fileBuffer = await fs.readFile(filePath);
  const parsedBuffer = await parseMasterFileBuffer(fileBuffer, {
    originalFileName: "comparacion.xlsx",
  });
  const streamedRecords = [];
  const parsedStream = await parseMasterFileStream(filePath, {
    originalFileName: "comparacion.xlsx",
    onBatch: async (records) => {
      streamedRecords.push(...records);
    },
  });

  assert.equal(parsedStream.metadata.masterType, parsedBuffer.metadata.masterType);
  assert.equal(parsedStream.metadata.sourceSheet, parsedBuffer.metadata.sourceSheet);
  assert.equal(parsedStream.metadata.checksum, parsedBuffer.metadata.checksum);
  assert.deepEqual(streamedRecords, parsedBuffer.records);
});

test("respeta el tipo de master file solicitado", async () => {
  const filePath = await createWorkbookFile({
    rows: [["FG-300", "Producto C"]],
  });

  await assert.rejects(
    parseMasterFileStream(filePath, {
      expectedMasterType: MASTER_TYPES.RAW_MATERIAL,
    }),
    (error) => error.code === "MASTER_TYPE_MISMATCH",
  );
});

test("reporta filas sin Part Number y grupos duplicados", async () => {
  const filePath = await createWorkbookFile({
    rows: [
      ["FG-400", "Producto original"],
      ["", "Fila sin part number"],
      ["FG-400", "Producto repetido"],
    ],
  });
  const records = [];

  const result = await parseMasterFileStream(filePath, {
    warningSampleLimit: 10,
    onBatch: async (batch) => records.push(...batch),
  });

  assert.equal(records.length, 2);
  assert.equal(result.metadata.warningCount, 2);
  assert.equal(result.metadata.warningSamplesTruncated, false);
  assert.equal(
    result.metadata.importWarnings.some((warning) =>
      warning.includes("sin Part Number"),
    ),
    true,
  );
  assert.equal(
    result.metadata.importWarnings.some((warning) =>
      warning.includes("aparecen repetidos"),
    ),
    true,
  );
});

test("detecta los tres formatos de master files BUILDASIGN", async () => {
  const cases = [
    {
      sheetName: "FS E",
      headers: ["Part Number", "Description"],
      row: ["FG-900", "Finished product"],
      expectedType: MASTER_TYPES.FINISHED_PRODUCT,
      verify(record) {
        assert.equal(record.partNumber, "FG-900");
        assert.equal(
          record.normalizedValues.description,
          "Finished product",
        );
      },
    },
    {
      sheetName: "RM E",
      headers: ["Part Number", "Description"],
      row: ["RM-900", "Raw material"],
      expectedType: MASTER_TYPES.RAW_MATERIAL,
      verify(record) {
        assert.equal(record.partNumber, "RM-900");
        assert.equal(
          record.normalizedValues.description,
          "Raw material",
        );
      },
    },
    {
      sheetName: "BOM E",
      headers: [
        "Finished Good Part Number",
        "Component Part Number",
        "Type",
        "Quantity",
        "Unit of Measure",
      ],
      row: ["FG-900", "RM-900", "Material", 2, "EA"],
      expectedType: MASTER_TYPES.BILL_OF_MATERIALS,
      verify(record) {
        assert.equal(record.partNumber, "FG-900");
        assert.equal(
          record.normalizedValues.componentPartNumber,
          "RM-900",
        );
        assert.equal(record.normalizedValues.quantity, 2);
      },
    },
  ];

  for (const testCase of cases) {
    const filePath = await createWorkbookFile({
      sheetName: testCase.sheetName,
      headers: testCase.headers,
      rows: [testCase.row],
    });
    const records = [];

    const result = await parseMasterFileStream(filePath, {
      expectedMasterType: testCase.expectedType,
      onBatch: async (batch) => records.push(...batch),
    });

    assert.equal(result.metadata.masterType, testCase.expectedType);
    assert.equal(records.length, 1);
    testCase.verify(records[0]);
  }
});
