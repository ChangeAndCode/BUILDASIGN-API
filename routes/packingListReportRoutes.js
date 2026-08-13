const router = require("express").Router();
const controller = require("../controllers/packingListReportController");
const { authenticateRequest, ensureApiAccess } = require("../middleware/authMiddleware");
const protectedRoute = [authenticateRequest, ensureApiAccess];
router.get("/customers", protectedRoute, controller.listCustomers);
router.get("/periods", protectedRoute, controller.listPeriods);
router.get("/monthly.pdf", protectedRoute, controller.downloadMonthlyReport);
module.exports = router;
