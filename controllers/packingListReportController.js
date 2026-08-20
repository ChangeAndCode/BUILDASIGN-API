const { VALID_SITES } = require("../data/siteConfig");
const packingListReportService = require("../services/packingListReportService");
const {
  createPackingListReportFileName,
} = require("../utils/packingListReportFileName");

const isAdmin = (user) => user?.role === "admin" || user?.isAdmin;
const getUserName = (user) =>
  String(user?.displayName || user?.email || "Usuario").trim();

const resolveSite = (req) => {
  const site = isAdmin(req.user)
    ? String(req.query.site || "").trim()
    : String(req.user?.site || "").trim();
  if (!VALID_SITES.includes(site)) {
    throw Object.assign(new Error("Selecciona una sede valida."), {
      statusCode: 400,
    });
  }
  return site;
};

const handleError = (res, error) => {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : 500;
  if (statusCode >= 500) {
    console.error("[PackingListReport] Error.", error);
  }
  return res.status(statusCode).json({
    message:
      statusCode < 500
        ? error.message
        : "No se pudo generar el reporte.",
  });
};

const listCustomers = async (req, res) => {
  try {
    const site = resolveSite(req);
    const customers =
      await packingListReportService.getCustomersForSite(site);
    return res.status(200).json({ site, customers });
  } catch (error) {
    return handleError(res, error);
  }
};

const listPeriods = async (req, res) => {
  try {
    const site = resolveSite(req);
    const customer = String(req.query.customer || "").trim();
    const periods = await packingListReportService.getAvailablePeriods({
      site,
      customer,
    });
    return res.status(200).json({ site, customer, periods });
  } catch (error) {
    return handleError(res, error);
  }
};

const downloadMonthlyReport = async (req, res) => {
  try {
    const site = resolveSite(req);
    const report = await packingListReportService.getMonthlyReportData({
      site,
      customer: req.query.customer,
      month: req.query.month,
      year: req.query.year,
    });
    if (!report.fileCount || !report.rows.length) {
      return res.status(404).json({
        message:
          "No hay Packing Lists enviados para los filtros seleccionados.",
      });
    }

    const downloadedAt = new Date();
    const pdf =
      await packingListReportService.generateMonthlyReportPdf(report);
    const fileName = createPackingListReportFileName({
      customer: report.customer,
      month: report.month,
      year: report.year,
      downloadedAt,
    });

    console.info("[PackingListReport] Downloaded.", {
      site,
      customer: report.customer,
      month: report.month,
      year: report.year,
      fileCount: report.fileCount,
      consolidatedRows: report.rows.length,
      user: getUserName(req.user),
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": pdf.length,
      "Cache-Control": "private, no-store",
    });
    return res.send(pdf);
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  listCustomers,
  listPeriods,
  downloadMonthlyReport,
};