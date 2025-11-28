// routes/paymentRoutes.js - Verify all routes
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
  handleCashfreeWebhook
} from '../controllers/paymentLinkController.js';

const router = express.Router();

// ✅ Verify all routes exist
router.get('/merchants', getMerchants);
router.get('/methods', getPaymentMethods);
router.get('/:merchantId/connector-accounts', getMerchantConnectors);
router.post('/generate-link', generatePaymentLink);
router.get('/debug/connector/:merchantId', debugConnectorAccount);
router.get('/debug/cashfree/:merchantId', debugCashfreeCredentials);
router.get('/debug/enpay/:merchantId', debugEnpayCredentials);
router.get('/test/cashfree/:merchantId', testCashfreeConnection);
router.get('/test-enpay-direct', testEnpayDirect);
router.get('/process/:shortLinkId', processShortLink);
router.get('/success', handleSuccess);
router.get('/return', handleReturn);
// Cashfree specific routes
router.get('/cashfree-return', handleCashfreeReturn);
router.post('/cashfree-webhook', handleCashfreeWebhook);
export default router;