import express from "express";
import {
  getPayoutTransactions,
  getPayoutTransactionById,
  createPayoutTransaction,
  updatePayoutTransactionStatus,
  getMerchantsForPayout,
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

// Get payout statistics
router.get("/stats/summary", getPayoutStatistics);

export default router;