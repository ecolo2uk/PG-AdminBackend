// routes/paymentRoutes.js - UPDATED VERSION
import express from 'express';
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
  getTransactionByShortLink  // ✅ ADD THIS
} from '../controllers/paymentLinkController.js';

const router = express.Router();

// ==================== PAYMENT LINK GENERATION ====================
router.post('/generate-link', generatePaymentLink);

// ==================== MERCHANT & CONNECTOR ROUTES ====================
router.get('/merchants', getMerchants);
router.get('/methods', getPaymentMethods);
router.get('/:merchantId/connector-accounts', getMerchantConnectors);

// ==================== TRANSACTION ROUTES ====================
router.get('/transaction/:shortLinkId', getTransactionByShortLink); // ✅ ADD THIS

// ==================== CASHFREE SPECIFIC ROUTES ====================
router.get('/cashfree/return', handleCashfreeReturn);
router.post('/cashfree/webhook', handleCashfreeWebhook);
router.get('/cashfree/test/:merchantId', testCashfreeConnection);
router.get('/cashfree/test-enhanced/:merchantId', testCashfreeConnectionEnhanced);
router.get('/cashfree/check-environment/:merchantId', checkCashfreeEnvironment);
router.get('/cashfree/debug-setup/:merchantId', debugCashfreeSetup);
router.get('/cashfree/debug-credentials/:merchantId', debugCashfreeCredentials);
router.get('/cashfree/validate-session/:sessionId', validatePaymentSession);

// ==================== ENPAY SPECIFIC ROUTES ====================
router.get('/enpay/test-direct', testEnpayDirect);
router.get('/enpay/debug-credentials/:merchantId', debugEnpayCredentials);

// ==================== DEBUG & TESTING ROUTES ====================
router.get('/debug/connector/:merchantId', debugConnectorAccount);
router.get('/debug/credentials/:merchantId', debugCashfreeCredentials);

// ==================== PAYMENT PROCESSING ROUTES ====================
router.get('/process/:shortLinkId', processShortLink);
router.get('/success', handleSuccess);
router.get('/return', handleReturn);

export default router;