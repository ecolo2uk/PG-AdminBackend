import express from 'express';
import {
  getPayoutTransactions,
  // getMerchantList, // This function doesn't seem to be in the controller directly, will remove or adjust.
  // getConnectorList, // This function doesn't seem to be in the controller directly, will remove or adjust.
  createPayoutToMerchant, // Corrected export name
  createInternalPayoutTransaction, // Corrected export name
  // getMerchantTransactionsSummary, // This function doesn't seem to be in the controller directly, will remove or adjust.
  // exportPayoutTransactions, // This function doesn't seem to be in the controller directly, will remove or adjust.
  // updatePayoutTransactionStatus, // This function doesn't seem to be in the controller directly, will remove or adjust.

  // Add the actual exported functions from your controller:
  getAllMerchantsForPayout, // Equivalent to getMerchantList
  getPayoutSupportedConnectors, // Equivalent to getConnectorList
  getPayoutTransactionById, // For fetching single payout by ID
  getMerchantBankDetails, // New route for getting merchant bank details
  updateMerchantBankDetails, // New route for updating merchant bank details
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
// Route for creating a general internal payout (Debit/Credit)
router.post('/', (req, res, next) => {
  console.log('🎯 MAIN POST ROUTE (createInternalPayoutTransaction) HIT!', req.body);
  next();
}, createInternalPayoutTransaction);

// Route for admin/merchant to initiate a payout to another merchant
router.post('/to-merchant', (req, res, next) => {
    console.log('🎯 POST ROUTE (createPayoutToMerchant) HIT!', req.body);
    next();
}, createPayoutToMerchant);

// Get all payout transactions (with filters)
router.get('/', getPayoutTransactions);

// Get a single payout transaction by ID
router.get('/:id', getPayoutTransactionById); // Make sure this is AFTER generic '/' route

// Other routes...
// You don't have updatePayoutTransactionStatus exported directly.
// If you want to update the status, you'd need a controller function for it.
// Assuming for now you want to implement something similar to `updateTransactionStatus` from your payment controller.
// For now, I'll remove it as it's not in the controller you provided.
// router.patch('/:id/status', updatePayoutTransactionStatus);

router.get('/merchants/list', getAllMerchantsForPayout); // Using the correct function name
router.get('/connectors/list', getPayoutSupportedConnectors); // Using the correct function name

// New routes from your controller
router.get('/merchant-bank-details/:merchantId', getMerchantBankDetails);
router.put('/merchant-bank-details/:merchantId', updateMerchantBankDetails);


// You don't have getMerchantTransactionsSummary or exportPayoutTransactions in the controller
// If you need them, you must implement and export them in payoutTransactionController.js
// router.get('/merchant/:merchantId/transactions', getMerchantTransactionsSummary);
// router.get('/export/excel', exportPayoutTransactions);


export default router;