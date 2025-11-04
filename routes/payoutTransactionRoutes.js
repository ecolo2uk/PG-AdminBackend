// routes/payoutTransactionRoutes.js
import express from "express";
import {
  getPayoutTransactions,
  getPayoutTransactionById,
  createPayoutTransaction,
  updatePayoutTransactionStatus,
  getMerchantsForPayout,
  getConnectorsForPayout,
  getConnectorAccountsForPayout,
  exportToExcel,
  getPayoutStatistics,
  getMerchantTransactions, // 🆕 ADDED
  createCreditTransaction // 🆕 ADDED
} from "../controllers/payoutTransactionController.js";

const router = express.Router();

// Existing routes
router.get("/", getPayoutTransactions);
router.get("/:id", getPayoutTransactionById);
router.post("/", createPayoutTransaction);
router.patch("/:id/status", updatePayoutTransactionStatus);
router.get("/merchants/list", getMerchantsForPayout);
router.get("/connectors/list", getConnectorsForPayout);
router.get("/connector-accounts/:connectorId", getConnectorAccountsForPayout);
router.get("/export/excel", exportToExcel);
router.get("/stats/summary", getPayoutStatistics);

// 🆕 NEW ROUTES for merchant transactions
router.get("/merchant/:merchantId/transactions", getMerchantTransactions);
router.post("/merchant/credit", createCreditTransaction);

export default router;