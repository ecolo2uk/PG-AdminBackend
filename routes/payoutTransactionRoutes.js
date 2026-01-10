import express from "express";
import {
  createPayoutToMerchant,
  getPayoutTransactions,
  createInternalPayoutTransaction,
  getPayoutTransactionById,
  getMerchantBankDetails,
  getAllMerchantsForPayout,
  createPayoutTransaction,
  getConnectors,
  getPayoutSupportedConnectors,
  getMerchantPayoutConnectors,
} from "../controllers/payoutTransactionController.js";

const router = express.Router();

router.post("/to-merchant", createPayoutToMerchant);
router.post("/internal", createInternalPayoutTransaction);
router.post("/", createPayoutTransaction);

router.get("/", getPayoutTransactions);
router.get("/:merchantId/connector-accounts", getMerchantPayoutConnectors);
router.get("/merchants/list", getAllMerchantsForPayout);
router.get("/connectors/list", getConnectors);
router.get("/connectors/payout-supported", getPayoutSupportedConnectors);
router.get("/:id", getPayoutTransactionById);
router.get("/bank-details/:merchantId", getMerchantBankDetails);

export default router;
