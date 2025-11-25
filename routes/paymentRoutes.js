// routes/paymentLinkRoutes.js - Add the new debug route
import express from 'express';
import { 
  generatePaymentLink, 
  handleSuccess, 
  handleReturn, 
  getMerchants, 
  getPaymentMethods,
  getMerchantConnectors,
  processShortLink,
  debugEnpayCredentials,
  testCashfreeConnection,
  debugCashfreeCredentials, // Add this
  debugConnectorAccount,
  testEnpayDirect
} from '../controllers/paymentLinkController.js';

const router = express.Router();

// Public API endpoints
router.get('/merchants', getMerchants);
router.get('/methods', getPaymentMethods);
router.post('/generate-link', generatePaymentLink);
router.get('/:merchantId/connector-accounts', getMerchantConnectors);
router.get('/debug/enpay/:merchantId', debugEnpayCredentials);
router.get('/debug/cashfree/:merchantId', debugCashfreeCredentials); // Add this route
router.get('/debug/connector/:merchantId', debugConnectorAccount);
// routes/paymentRoutes.js मध्ये add करा
router.get('/test/cashfree/:merchantId', testCashfreeConnection);
// Payment processing routes
router.get('/process/:shortLinkId', processShortLink);
router.get('/success', handleSuccess);
router.get('/return', handleReturn);
router.get('/test-enpay-direct', testEnpayDirect);

export default router;