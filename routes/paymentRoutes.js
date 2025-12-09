import express from "express";
import {
  generatePaymentLink,
  getMerchants,
  getMerchantConnectors,
  getPaymentMethods,
  debugCashfreeCredentials,
  testCashfreeConnection,
  debugConnectorAccount,
  debugEnpayCredentials,
  testEnpayDirect,
  processShortLink,
  handleSuccess,
  handleReturn,
  handleCashfreeReturn,
  handleCashfreeWebhook,
  checkCashfreeEnvironment,
  testCashfreeConnectionEnhanced,
  debugCashfreeSetup,
  validatePaymentSession,
  getTransactionByShortLink,
  debugEnpayIntegrationKeys,
  debugIntegrationKeys,
  enpayWebhook,
  redirectAfterPayment,
  checkTransactionStatus,
  updateTransactions,
  generatePaymentLinkTransaction,
} from "../controllers/paymentLinkController.js";

const router = express.Router();

router.post("/generate-link", generatePaymentLink);
// router.post("/generate-payment-link", generatePaymentLinkTransaction);

router.get("/merchants", getMerchants);
router.get("/methods", getPaymentMethods);
router.get("/:merchantId/connector-accounts", getMerchantConnectors);

router.get("/transaction/:shortLinkId", getTransactionByShortLink);

router.get("/cashfree/return", handleCashfreeReturn);
router.post("/cashfree/webhook", handleCashfreeWebhook);
router.get("/cashfree/test/:merchantId", testCashfreeConnection);
router.get(
  "/cashfree/test-enhanced/:merchantId",
  testCashfreeConnectionEnhanced
);
router.get("/cashfree/check-environment/:merchantId", checkCashfreeEnvironment);
router.get("/cashfree/debug-setup/:merchantId", debugCashfreeSetup);
router.get("/cashfree/debug-credentials/:merchantId", debugCashfreeCredentials);
router.get("/cashfree/validate-session/:sessionId", validatePaymentSession);

router.get("/enpay/test-direct", testEnpayDirect);
router.get("/enpay/debug-credentials/:merchantId", debugEnpayCredentials);

router.get("/debug/connector/:merchantId", debugConnectorAccount);
router.get("/debug/credentials/:merchantId", debugCashfreeCredentials);
router.get("/debug/integration-keys/:merchantId", debugIntegrationKeys);
router.get("/debug/enpay-keys/:merchantId", debugEnpayIntegrationKeys);
router.get("/process/:shortLinkId", processShortLink);
router.get("/success", handleSuccess);
router.get("/return", handleReturn);
router.post("/status", checkTransactionStatus);
router.get("/updateTransactions", updateTransactions);
router.get("/redirect", redirectAfterPayment);
router.get("/enpay-webhook", enpayWebhook);
export default router;
