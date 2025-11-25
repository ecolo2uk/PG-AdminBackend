// routes/paymentLinkRoutes.js
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
router.get('/debug/connector/:merchantId', debugConnectorAccount);

// Payment processing routes
router.get('/process/:shortLinkId', processShortLink);
router.get('/success', handleSuccess);
router.get('/return', handleReturn);
// Add to your routes
router.get('/test-enpay-direct', testEnpayDirect);
export default router;