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
  getPayoutStatistics
} from "../controllers/payoutTransactionController.js";

const router = express.Router();

// Get all payout transactions with filters
router.get("/", getPayoutTransactions);

// Get payout transaction by ID
router.get("/:id", getPayoutTransactionById);

// Create new payout transaction
router.post("/", createPayoutTransaction);

// Update payout transaction status
router.patch("/:id/status", updatePayoutTransactionStatus);

// Get merchants for payout dropdown
router.get("/merchants/list", getMerchantsForPayout);

// Get connectors for payout dropdown
router.get("/connectors/list", getConnectorsForPayout);

// Get connector accounts for specific connector
router.get("/connector-accounts/:connectorId", getConnectorAccountsForPayout);

// Export to Excel
router.get("/export/excel", exportToExcel);

// Get payout statistics
router.get("/stats/summary", getPayoutStatistics);

export default router;