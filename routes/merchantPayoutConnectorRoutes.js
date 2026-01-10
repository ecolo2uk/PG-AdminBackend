import express from "express";
import {
  addMerchantPayoutConnectorAccount,
  deleteMerchantPayoutConnectorAccount,
  getAccountDetails,
  getAccountLimits,
  getAccountRates,
  getAvailableConnectors,
  getMerchantPayoutConnectorAccounts,
  setPrimaryAccount,
  updateAccountLimits,
  updateAccountRates,
  updateMerchantPayoutConnectorAccount,
} from "../controllers/merchantPayoutConnectorController.js";

const router = express.Router();

router.get(
  "/:merchantId/connector-accounts",
  getMerchantPayoutConnectorAccounts
);
router.get("/:merchantId/available-connectors", getAvailableConnectors);
router.post(
  "/:merchantId/connector-accounts",
  addMerchantPayoutConnectorAccount
);
router.put(
  "/connector-accounts/:accountId",
  updateMerchantPayoutConnectorAccount
);
router.delete(
  "/connector-accounts/:accountId",
  deleteMerchantPayoutConnectorAccount
);
router.patch("/connector-accounts/:accountId/primary", setPrimaryAccount);

router.get("/connector-accounts/:accountId/limits", getAccountLimits);
router.put("/connector-accounts/:accountId/limits", updateAccountLimits);
router.get("/connector-accounts/:accountId/rates", getAccountRates);
router.put("/connector-accounts/:accountId/rates", updateAccountRates);
router.get("/connector-accounts/:accountId/details", getAccountDetails);

export default router;
