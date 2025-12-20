import express from "express";
import {
  createPaymentTransaction,
  updateTransactionStatus,
  getAllPaymentTransactions,
  getPaymentTransactionById,
  getMerchantPayoutBalance,
  getAllUPITransactions,
  getAllCardTransactions,
} from "../controllers/transactionController.js";

const router = express.Router();

router.post("/", createPaymentTransaction);
router.put("/:id", updateTransactionStatus);
router.get("/", getAllPaymentTransactions);
router.get("/upi", getAllUPITransactions);
router.get("/card", getAllCardTransactions);
router.get("/:id", getPaymentTransactionById);
router.get("/merchant-balance/:merchantId", getMerchantPayoutBalance);

export default router;
