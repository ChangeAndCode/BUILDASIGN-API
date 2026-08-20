const PDFDocument = require("pdfkit");
const SPLScrap = require("../models/SPLScrap");
const { VALID_SITES } = require("../data/siteConfig");

const CUSTOMER_FIELD = "Customer(southbound) / Ship to (northbound)";
const MAX_CUSTOMER_LENGTH = 250;

const createReportError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

const assertSite = (site) => {
  if (!VALID_SITES.includes(site)) {
    throw createReportError("La sede no es valida.");
  }
};

const normalizeCustomer = (customer) => {
  const normalized = typeof customer === "string" ? customer.trim() : "";
  if (!normalized) {
    throw createReportError("El customer es obligatorio.");
  }
  if (normalized.length > MAX_CUSTOMER_LENGTH) {
    throw createReportError("El customer excede la longitud permitida.");
  }
  return normalized;
};

const toNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const getMonthRange = (year, month) => {
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  if (
    !Number.isInteger(parsedYear) ||
    parsedYear < 2000 ||
    parsedYear > 2200 ||
    !Number.isInteger(parsedMonth) ||
    parsedMonth < 1 ||
    parsedMonth > 12
  ) {
    throw createReportError("El periodo no es valido.");
  }
  return {
    start: new Date(Date.UTC(parsedYear, parsedMonth - 1, 1)),
    end: new Date(Date.UTC(parsedYear, parsedMonth, 1)),
  };
};

const normalizeRow = (row = {}) => ({
  partNumber: String(row["Part Number"] ?? ""),
  description: String(row.Description ?? ""),
  unitOfMeasure: String(row["Unit Of Measure"] ?? ""),
  countryOfOrigin: String(row["Country of Origin"] ?? ""),
  quantity: toNumber(row.Quantity),
  totalValue: toNumber(row["Total Value (USD)"]),
});

const markPartNumberVariants = (rows = []) => {
  const counts = new Map();
  rows.forEach((row) => {
    counts.set(row.partNumber, (counts.get(row.partNumber) || 0) + 1);
  });
  return rows.map((row) => ({
    ...row,
    hasVariants: counts.get(row.partNumber) > 1,
  }));
};

const consolidatePackingListRows = (sourceRows = []) => {
  const groups = new Map();
  sourceRows.forEach((source) => {
    const row = normalizeRow(source);
    const key = JSON.stringify([
      row.partNumber,
      row.description,
      row.unitOfMeasure,
      row.countryOfOrigin,
    ]);
    const current = groups.get(key);
    if (current) {
      current.quantity += row.quantity;
      current.totalValue += row.totalValue;
    } else {
      groups.set(key, row);
    }
  });
  return markPartNumberVariants([...groups.values()]).sort(
    (a, b) =>
      a.partNumber.localeCompare(b.partNumber) ||
      a.description.localeCompare(b.description),
  );
};

const buildAvailablePeriods = (dates = []) => {
  const years = new Map();
  dates.forEach((value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return;
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    if (!years.has(year)) years.set(year, new Set());
    years.get(year).add(month);
  });
  return [...years.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => ({
      year,
      months: [...months].sort((a, b) => a - b),
    }));
};

const customerPath = `$rows.${CUSTOMER_FIELD}`;
const asText = (path) => ({
  $convert: { input: { $ifNull: [path, ""] }, to: "string", onError: "", onNull: "" },
});
const asNumber = (path) => ({
  $convert: {
    input: {
      $replaceAll: { input: asText(path), find: ",", replacement: "" },
    },
    to: "double",
    onError: 0,
    onNull: 0,
  },
});

const sentPackingListMatch = (site) => ({
  site,
  "sftpDelivery.status": "sent",
  "sftpDelivery.sentAt": { $ne: null },
});

const getCustomersForSite = async (site) => {
  assertSite(site);
  const customers = await SPLScrap.aggregate([
    { $match: sentPackingListMatch(site) },
    { $unwind: "$rows" },
    { $project: { customer: { $trim: { input: asText(customerPath) } } } },
    { $match: { customer: { $ne: "" } } },
    { $group: { _id: "$customer" } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, customer: "$_id" } },
  ]).allowDiskUse(true);
  return customers.map(({ customer }) => customer);
};

const getAvailablePeriods = async ({ site, customer }) => {
  assertSite(site);
  const normalizedCustomer = normalizeCustomer(customer);
  const periods = await SPLScrap.aggregate([
    {
      $match: {
        ...sentPackingListMatch(site),
        rows: { $elemMatch: { [CUSTOMER_FIELD]: normalizedCustomer } },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: { date: "$sftpDelivery.sentAt", timezone: "UTC" } },
          month: { $month: { date: "$sftpDelivery.sentAt", timezone: "UTC" } },
        },
      },
    },
    { $sort: { "_id.year": -1, "_id.month": 1 } },
  ]).allowDiskUse(true);

  const years = new Map();
  periods.forEach(({ _id }) => {
    if (!years.has(_id.year)) years.set(_id.year, []);
    years.get(_id.year).push(_id.month);
  });
  return [...years.entries()].map(([year, months]) => ({ year, months }));
};

const getMonthlyReportData = async ({ site, customer, year, month }) => {
  assertSite(site);
  const normalizedCustomer = normalizeCustomer(customer);
  const { start, end } = getMonthRange(year, month);
  const [result = { files: [], rows: [] }] = await SPLScrap.aggregate([
    {
      $match: {
        site,
        "sftpDelivery.status": "sent",
        "sftpDelivery.sentAt": { $gte: start, $lt: end },
        rows: { $elemMatch: { [CUSTOMER_FIELD]: normalizedCustomer } },
      },
    },
    {
      $facet: {
        files: [{ $count: "count" }],
        rows: [
          { $unwind: "$rows" },
          { $match: { [customerPath.slice(1)]: normalizedCustomer } },
          {
            $group: {
              _id: {
                partNumber: asText("$rows.Part Number"),
                description: asText("$rows.Description"),
                unitOfMeasure: asText("$rows.Unit Of Measure"),
                countryOfOrigin: asText("$rows.Country of Origin"),
              },
              quantity: { $sum: asNumber("$rows.Quantity") },
              totalValue: { $sum: asNumber("$rows.Total Value (USD)") },
            },
          },
          {
            $project: {
              _id: 0,
              partNumber: "$_id.partNumber",
              description: "$_id.description",
              unitOfMeasure: "$_id.unitOfMeasure",
              countryOfOrigin: "$_id.countryOfOrigin",
              quantity: 1,
              totalValue: 1,
            },
          },
          { $sort: { partNumber: 1, description: 1 } },
        ],
      },
    },
  ]).allowDiskUse(true);

  return {
    site,
    customer: normalizedCustomer,
    year: Number(year),
    month: Number(month),
    start,
    end,
    fileCount: Number(result.files?.[0]?.count || 0),
    rows: markPartNumberVariants(result.rows || []),
  };
};

const columns = [
  ["partNumber", "Part Number", 105],
  ["description", "Description", 245],
  ["unitOfMeasure", "Unit Of Measure", 75],
  ["countryOfOrigin", "Country of Origin", 70],
  ["quantity", "Quantity", 80, true],
  ["totalValue", "Total Value (USD)", 95, true],
];

const drawHeader = (doc, y) => {
  let x = 35;
  doc.save().fillColor("#1f4e78").rect(x, y, 670, 34).fill()
    .fillColor("white").font("Helvetica-Bold").fontSize(7);
  columns.forEach(([, label, width, numeric]) => {
    doc.text(label, x + 4, y + 9, {
      width: width - 8,
      align: numeric ? "right" : "left",
    });
    x += width;
  });
  doc.restore();
  return y + 34;
};

const generateMonthlyReportPdf = (report) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 35 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const date = new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeZone: "UTC",
    });
    doc.font("Helvetica-Bold").fontSize(17).fillColor("#1f4e78")
      .text("Reporte mensual de Packing List");
    doc.font("Helvetica").fontSize(9).fillColor("#222").moveDown(0.5)
      .text(`Customer: ${report.customer}`)
      .text(`Site: ${report.site}`)
      .text(`Fecha de busqueda: ${date.format(report.start)} - ${date.format(new Date(report.end.getTime() - 1))}`)
      .text(`Fecha de impresion: ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`)
      .text(`Archivos enviados incluidos: ${report.fileCount}`);

    let y = drawHeader(doc, doc.y + 12);
    report.rows.forEach((row) => {
      if (y + 28 > 550) {
        doc.addPage();
        y = drawHeader(doc, 35);
      }
      let x = 35;
      doc.save().fillColor(row.hasVariants ? "#fff2cc" : "white")
        .rect(x, y, 670, 28).fill().strokeColor("#b7c9d6").lineWidth(0.4);
      columns.forEach(([key, , width, numeric]) => {
        doc.rect(x, y, width, 28).stroke();
        let value = numeric
          ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(row[key])
          : row[key];
        if (key === "partNumber" && row.hasVariants) value += " *";
        doc.fillColor("#111").font("Helvetica").fontSize(7).text(
          String(value),
          x + 4,
          y + 7,
          { width: width - 8, height: 20, ellipsis: true, align: numeric ? "right" : "left" },
        );
        x += width;
      });
      doc.restore();
      y += 28;
    });
    if (report.rows.some((row) => row.hasVariants)) {
      doc.font("Helvetica-Oblique").fontSize(8).fillColor("#6b5600")
        .text("* El Part Number aparece separado porque otra caracteristica de agrupacion es diferente.", 35, y + 8);
    }
    doc.end();
  });

module.exports = {
  CUSTOMER_FIELD,
  getMonthRange,
  consolidatePackingListRows,
  buildAvailablePeriods,
  getCustomersForSite,
  getAvailablePeriods,
  getMonthlyReportData,
  generateMonthlyReportPdf,
};