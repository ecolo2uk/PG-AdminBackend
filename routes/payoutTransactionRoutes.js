// In payoutTransactionRoutes.js - ADD THIS AT THE TOP
import express from 'express';
import {
  getPayoutTransactions,
  getMerchantList,
  getConnectorList,
  createPayoutTransaction,
  getMerchantTransactionsSummary,
  exportPayoutTransactions,
  updatePayoutTransactionStatus,
} from '../controllers/payoutTransactionController.js';

const router = express.Router();

// 🚨 ADD THIS DEBUG MIDDLEWARE FIRST
router.use((req, res, next) => {
  console.log('🛣️ PAYOUT ROUTES - Incoming request:', {
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    baseUrl: req.baseUrl,
    body: req.body
  });
  next();
});

// Test if the router is working
router.get('/debug-router', (req, res) => {
  console.log('✅ Router is working!');
  res.json({
    success: true,
    message: 'Payout router is functioning',
    routes: [
      'POST /',
      'GET /',
      'GET /merchants/list',
      'POST /test-create'
    ]
  });
});

// EXISTING TEST ROUTES
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Payout Transactions API is working!',
    timestamp: new Date().toISOString()
  });
});

router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Payout API is healthy',
    timestamp: new Date().toISOString()
  });
});

router.post('/test-create', (req, res) => {
  console.log("🧪 Test POST received:", req.body);
  res.json({ 
    success: true, 
    message: 'POST endpoint is working!',
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
});

// 🚨 MAIN ROUTES - FIX THE ORDER
router.post('/', (req, res, next) => {
  console.log('🎯 MAIN POST ROUTE HIT!', req.body);
  next();
}, createPayoutTransaction);

router.get('/', getPayoutTransactions);

// Other routes...
router.patch('/:id/status', updatePayoutTransactionStatus);
router.get('/merchants/list', getMerchantList);
router.get('/connectors/list', getConnectorList);
router.get('/merchant/:merchantId/transactions', getMerchantTransactionsSummary);
router.get('/export/excel', exportPayoutTransactions);

export default router;