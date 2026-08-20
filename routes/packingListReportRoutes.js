const router = require("express").Router();
const controller = require("../controllers/packingListReportController");
const {
  authenticateRequest,
  ensureApiAccess,
} = require("../middleware/authMiddleware");

router.use(authenticateRequest, ensureApiAccess);
router.get("/customers", controller.listCustomers);
router.get("/periods", controller.listPeriods);
router.get("/monthly.pdf", controller.downloadMonthlyReport);

module.exports = router;