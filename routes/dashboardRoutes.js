import express from "express";
import {
  getDashboardAnalytics,
  getMerchantTransactionSummary,
  getAllMerchants,
  getTransactionsByMerchantStatus,
  getSalesReport,
  getAllTransactions,
  checkTransaction,
  debugTransactionStatus,
  checkPendingTransactions,
} from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/analytics", getDashboardAnalytics);
router.get("/merchant-transaction-summary", getMerchantTransactionSummary);
router.get("/merchants", getAllMerchants);
router.get("/transactions-by-merchant", getTransactionsByMerchantStatus);
router.get("/sales-report", getSalesReport);
router.get("/all-transactions", getAllTransactions);
router.get("/checkTransaction", checkTransaction);

router.get("/transactions/debug-status", debugTransactionStatus);
router.get("/transactions/check-pending", checkPendingTransactions);
export default router;
